import { createSignal, createMemo, createEffect, on, onMount, onCleanup, Show } from "solid-js";
import { A, useNavigate, useLocation, useParams, useBeforeLeave } from "@solidjs/router";
import * as store from "@/stores/notes";
import { useUndoRedo } from "@/composables/useUndoRedo";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { useNotesSync } from "@/composables/useNotesSync";
import { useFileIO } from "@/composables/useFileIO";
import { create } from "@/models/Note";
import { emptyString } from "@/constants/common";
import { getSentenceCount, getWordCount, getCharacterCount } from "@/utils/text-analysis";
import { debounce } from "@/utils/timing";
import Toast from "@/components/Toast";
import type { UUID } from "crypto";
import { useAutoResize } from "@/composables/useAutoResize";

export default function EditNote() {
	let editTextArea!: HTMLTextAreaElement;
	let bypassGuard = false;
	const navigate = useNavigate();
	const location = useLocation();
	const params = useParams<{ id?: UUID }>();
	const { exportNote } = useFileIO();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const isCreateMode = createMemo(() => location.pathname === "/notes/new");
	const existingNote = createMemo(() => (params.id && !isCreateMode() ? store.getNote(params.id) : undefined));
	const [isCopying, setIsCopying] = createSignal(false);
	const [copyResult, setCopyResult] = createSignal<{
		status: "success" | "error";
		message: string;
	}>({
		status: "success",
		message: emptyString
	});
	const [isEditing, setIsEditing] = createSignal(isCreateMode());
	const [editTitle, setEditTitle] = createSignal(existingNote()?.title ?? emptyString);
	const [editContent, setEditContent] = createSignal(emptyString);
	const [loadedContent, setLoadedContent] = createSignal(emptyString);
	const [isContentLoaded, setIsContentLoaded] = createSignal(false);
	const { adjustHeight } = useAutoResize(editTextArea, editContent, isEditing);
	const undoRedo = useUndoRedo<string>(editContent());
	const sentenceCount = createMemo(() => (isEditing() ? getSentenceCount(editContent()) : (existingNote()?.sentenceCount ?? 0)));
	const wordCount = createMemo(() => (isEditing() ? getWordCount(editContent()) : (existingNote()?.wordCount ?? 0)));
	const characterCount = createMemo(() => (isEditing() ? getCharacterCount(editContent()) : (existingNote()?.characterCount ?? 0)));
	const hasContent = createMemo(() => !!sentenceCount() || !!wordCount() || !!characterCount());
	const isArchived = createMemo(() => !!existingNote()?.archivedAt && !existingNote()?.deletedAt);
	const isTrashed = createMemo(() => !!existingNote()?.deletedAt);
	const backRoute = createMemo(() => {
		if (isTrashed()) {
			return "/notes/trash";
		}
		if (isArchived()) {
			return "/notes/archive";
		}
		return "/notes";
	});
	const hasUnsavedChanges = createMemo(() => {
		if (!isEditing()) {
			return false;
		}
		if (isCreateMode()) {
			return editTitle().trim().length > 0 || editContent().length > 0;
		}
		const note = existingNote();
		if (!note) {
			return false;
		}
		return editTitle() !== note.title || editContent() !== loadedContent();
	});

	const debouncedPushUndo = debounce((value: string) => undoRedo.push(value), 300);

	function onContentInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		setEditContent(value);
		debouncedPushUndo(value);
	}

	function doUndo() {
		undoRedo.undo();
		setEditContent(undoRedo.current());
	}

	function doRedo() {
		undoRedo.redo();
		setEditContent(undoRedo.current());
	}

	function copyToClipboard() {
		setIsCopying(true);
		navigator.clipboard
			.writeText(loadedContent())
			.then(() => {
				setCopyResult({
					status: "success",
					message: "Copied to clipboard"
				});
			})
			.catch(err => {
				setCopyResult({
					status: "error",
					message: `Failed to copy: ${(err as Error).message}`
				});
			});
	}

	function startEditing() {
		const note = existingNote();
		setEditTitle(note?.title ?? emptyString);
		setEditContent(loadedContent());
		undoRedo.push(editContent());
		setIsEditing(true);
		setTimeout(adjustHeight);
	}

	async function confirmDiscardChanges(): Promise<boolean> {
		return confirm({
			title: "Discard unsaved changes?",
			message: "You have unsaved changes that will be lost if you leave this note.",
			confirmText: "Discard",
			cancelText: "Keep editing",
			variant: "danger"
		});
	}

	async function cancelEditing() {
		if (hasUnsavedChanges()) {
			const ok = await confirmDiscardChanges();
			if (!ok) {
				return;
			}
		}
		if (isCreateMode()) {
			setIsEditing(false);
			navigate("/notes");
		} else {
			const note = existingNote();
			setIsEditing(false);
			setEditTitle(note?.title ?? emptyString);
			setEditContent(loadedContent());
		}
	}

	async function saveNote() {
		const title = editTitle().trim() || "Untitled";
		const content = editContent();
		if (isCreateMode()) {
			const note = create(title, content);
			await store.addNote(note);
			setIsEditing(false);
			requestSync();
			navigate(`/notes/${note.id}`);
			return;
		}
		const note = existingNote();
		if (note) {
			store.updateNote(note.id, title, content);
			setLoadedContent(content);
			requestSync();
		}
		setIsEditing(false);
	}

	async function deleteNote() {
		const note = existingNote();
		if (!note) {
			return;
		}
		const returnTo = backRoute();
		const ok = await confirm({
			title: "Move note to Trash?",
			message: "This note will be moved to Trash. You can restore it within 30 days.",
			confirmText: "Move to Trash",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		store.trashNote(note.id);
		requestSync();
		navigate(returnTo);
	}

	function archiveCurrent() {
		const note = existingNote();
		if (!note) {
			return;
		}
		store.archiveNote(note.id);
		requestSync();
		navigate("/notes");
	}

	function unarchiveCurrent() {
		const note = existingNote();
		if (!note) {
			return;
		}
		store.unarchiveNote(note.id);
		requestSync();
		navigate("/notes/archive");
	}

	function restoreNote() {
		const note = existingNote();
		if (!note) {
			return;
		}
		store.restoreFromTrash(note.id);
		requestSync();
		navigate("/notes/trash");
	}

	async function permanentlyDeleteNote() {
		const note = existingNote();
		if (!note) {
			return;
		}
		const ok = await confirm({
			title: "Permanently delete note?",
			message: "This note will be permanently deleted. This action cannot be undone.",
			confirmText: "Delete Permanently",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		const noteId = note.id;
		await store.permanentlyDelete(noteId);
		requestSync([noteId]);
		navigate("/notes/trash");
	}

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		});
	}

	function onBeforeUnload(e: BeforeUnloadEvent) {
		if (hasUnsavedChanges()) {
			e.preventDefault();
		}
	}

	onMount(() => {
		window.addEventListener("beforeunload", onBeforeUnload);
	});

	onCleanup(() => {
		debouncedPushUndo.cancel();
		window.removeEventListener("beforeunload", onBeforeUnload);
	});

	useBeforeLeave(e => {
		if (bypassGuard || !hasUnsavedChanges()) {
			return;
		}
		e.preventDefault();
		(async () => {
			const ok = await confirmDiscardChanges();
			if (ok) {
				bypassGuard = true;
				e.retry(true);
			}
		})();
	});

	createEffect(
		on(
			() => params.id,
			async id => {
				setIsContentLoaded(isCreateMode());
				setLoadedContent(emptyString);
				setEditContent(emptyString);
				setIsEditing(isCreateMode());
				if (id && !isCreateMode()) {
					setLoadedContent((await store.getNoteContent(id)) ?? emptyString);
				} else {
					setLoadedContent(emptyString);
				}
				setIsContentLoaded(true);
				undoRedo.reset(loadedContent());
			}
		)
	);

	return (
		<>
			<div class="edit-note">
				<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
					<A href={backRoute()} class="btn btn-outline-secondary btn-sm" aria-label="Back to notes">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
							<path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/>
						</svg>
						<span>&#xA0;Back</span>
					</A>
					<Show when={!isCreateMode() && !isEditing() && isTrashed()}>
						<div class="d-flex flex-wrap gap-2">
							<button class="btn btn-outline-primary btn-sm" onClick={restoreNote} title="Restore" aria-label="Restore">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-reply" viewBox="0 0 16 16">
									<path d="M6.598 5.013a.144.144 0 0 1 .202.134V6.3a.5.5 0 0 0 .5.5c.667 0 2.013.005 3.3.822.984.624 1.99 1.76 2.595 3.876-1.02-.983-2.185-1.516-3.205-1.799a8.7 8.7 0 0 0-1.921-.306 7 7 0 0 0-.798.008h-.013l-.005.001h-.001L7.3 9.9l-.05-.498a.5.5 0 0 0-.45.498v1.153c0 .108-.11.176-.202.134L2.614 8.254l-.042-.028a.147.147 0 0 1 0-.252l.042-.028zM7.8 10.386q.103 0 .223.006c.434.02 1.034.086 1.7.271 1.326.368 2.896 1.202 3.94 3.08a.5.5 0 0 0 .933-.305c-.464-3.71-1.886-5.662-3.46-6.66-1.245-.79-2.527-.942-3.336-.971v-.66a1.144 1.144 0 0 0-1.767-.96l-3.994 2.94a1.147 1.147 0 0 0 0 1.946l3.994 2.94a1.144 1.144 0 0 0 1.767-.96z"/>
								</svg>
							</button>
							<Show when={existingNote()}>
								<button class="btn btn-outline-secondary btn-sm" onClick={() => exportNote(existingNote()!)} title="Export" aria-label="Export">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
										<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
										<path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
									</svg>
								</button>
							</Show>
							<button class="btn btn-outline-danger btn-sm" onClick={permanentlyDeleteNote} title="Delete Permanently" aria-label="Delete Permanently">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
									<path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
								</svg>
							</button>
						</div>
					</Show>
					<Show when={!isCreateMode() && !isEditing() && !isTrashed()}>
						<div class="d-flex flex-wrap gap-2">
							<button class="btn btn-outline-primary btn-sm" onClick={startEditing} title="Edit" aria-label="Edit">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pen" viewBox="0 0 16 16">
									<path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z"/>
								</svg>
							</button>
							<button class="btn btn-outline-secondary btn-sm" onClick={copyToClipboard} title="Copy to clipboard" aria-label="Copy to clipboard">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
									<path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
								</svg>
							</button>
							<Show when={existingNote()}>
								<button class="btn btn-outline-secondary btn-sm" onClick={() => exportNote(existingNote()!)} title="Export" aria-label="Export">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
										<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
										<path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
									</svg>
								</button>
							</Show>
							<Show
								when={isArchived()}
								fallback={
									<button class="btn btn-outline-secondary btn-sm" onClick={archiveCurrent} title="Archive" aria-label="Archive">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-archive" viewBox="0 0 16 16">
											<path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
										</svg>
									</button>
								}>
								<button class="btn btn-outline-secondary btn-sm" onClick={unarchiveCurrent} title="Unarchive" aria-label="Unarchive">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-up" viewBox="0 0 16 16">
										<path fill-rule="evenodd" d="M3.5 6a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1 0-1h2A1.5 1.5 0 0 1 14 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14.5v-8A1.5 1.5 0 0 1 3.5 5h2a.5.5 0 0 1 0 1z"/>
										<path fill-rule="evenodd" d="M7.646.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 1.707V10.5a.5.5 0 0 1-1 0V1.707L5.354 3.854a.5.5 0 1 1-.708-.708z"/>
									</svg>
								</button>
							</Show>
							<button class="btn btn-outline-danger btn-sm" onClick={deleteNote} title="Delete" aria-label="Delete">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
									<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
									<path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
								</svg>
							</button>
						</div>
					</Show>
					<Show when={isEditing()}>
						<div class="d-flex flex-wrap gap-2">
							<button class="btn btn-outline-secondary btn-sm" disabled={!undoRedo.canUndo()} onClick={doUndo} title="Undo" aria-label="Undo">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-counterclockwise" viewBox="0 0 16 16">
									<path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2z"/>
									<path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466"/>
								</svg>
							</button>
							<button class="btn btn-outline-secondary btn-sm" disabled={!undoRedo.canRedo()} onClick={doRedo} title="Redo" aria-label="Redo">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16">
									<path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
									<path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
								</svg>
							</button>
							<button class="btn btn-primary btn-sm" disabled={!hasUnsavedChanges()} onClick={saveNote} title="Save" aria-label="Save">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-floppy" viewBox="0 0 16 16">
									<path d="M11 2H9v3h2z"/>
									<path d="M1.5 0h11.586a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13A1.5 1.5 0 0 1 1.5 0M1 1.5v13a.5.5 0 0 0 .5.5H2v-4.5A1.5 1.5 0 0 1 3.5 9h9a1.5 1.5 0 0 1 1.5 1.5V15h.5a.5.5 0 0 0 .5-.5V2.914a.5.5 0 0 0-.146-.353l-1.415-1.415A.5.5 0 0 0 13.086 1H13v4.5A1.5 1.5 0 0 1 11.5 7h-7A1.5 1.5 0 0 1 3 5.5V1H1.5a.5.5 0 0 0-.5.5m3 4a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V1H4zM3 15h10v-4.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5z"/>
								</svg>
							</button>
							<button class="btn btn-outline-secondary btn-sm" onClick={cancelEditing} title="Cancel" aria-label="Cancel">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
									<path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
								</svg>
							</button>
						</div>
					</Show>
				</div>
				<Show when={!isEditing() && existingNote()}>
					<h2 class="mb-3">{existingNote()!.title}</h2>
					<Show when={existingNote()!.modifiedAt || existingNote()!.createdAt}>
						<div class="text-muted small mb-3">{existingNote()!.modifiedAt ? `Modified ${formatDate(existingNote()!.modifiedAt)}` : `Created ${formatDate(existingNote()!.createdAt)}`}</div>
					</Show>
					<Show when={!isContentLoaded()} fallback={<div class="note-content">{loadedContent()}</div>}>
						<div class="d-flex justify-content-center py-3">
							<div class="spinner-border" role="status" aria-label="Loading note"></div>
						</div>
					</Show>
				</Show>
				<Show when={isEditing()}>
					<input value={editTitle()} onInput={e => setEditTitle(e.currentTarget.value)} type="text" class="form-control form-control-lg mb-3" placeholder="Title"/>
					<textarea ref={editTextArea} value={editContent()} onInput={onContentInput} class="form-control note-textarea" placeholder="Start writing..." rows="12"></textarea>
				</Show>
				<Show when={hasContent()}>
					<div class="d-flex flex-wrap gap-2 mt-3">
						<Show when={sentenceCount()}>
							<span class="badge text-bg-secondary">{sentenceCount()} sentences</span>
						</Show>
						<Show when={wordCount()}>
							<span class="badge text-bg-secondary">{wordCount()} words</span>
						</Show>
						<Show when={characterCount()}>
							<span class="badge text-bg-secondary">{characterCount()} characters</span>
						</Show>
					</div>
				</Show>
			</div>
			<Toast message={copyResult().message} type={copyResult().status} visible={isCopying()} timeStamp={Date.now()} onDismiss={() => void 0}/>
		</>
	);
}