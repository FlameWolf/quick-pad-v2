import { createSignal, createMemo, createEffect, on, onMount, onCleanup, Show } from "solid-js";
import { A, useNavigate, useLocation, useParams, useBeforeLeave } from "@solidjs/router";
import { getNote, addNote, updateNote, archiveNote, unarchiveNote, trashNote, restoreFromTrash, permanentlyDelete } from "@/stores/notes";
import { useUndoRedo } from "@/composables/useUndoRedo";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { useNotesSync } from "@/composables/useNotesSync";
import { useFileIO } from "@/composables/useFileIO";
import { create } from "@/models/Note";
import { getSentenceCount, getWordCount, getCharacterCount, emptyString, debounce } from "@/library";
import Toast from "@/components/Toast";
import type { UUID } from "crypto";

export default function EditNote() {
	const navigate = useNavigate();
	const location = useLocation();
	const params = useParams<{ id?: UUID }>();
	const { exportNote } = useFileIO();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const isCreateMode = createMemo(() => location.pathname === "/notes/new");
	const existingNote = createMemo(() => (params.id && !isCreateMode() ? getNote(params.id) : undefined));
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
	const [editContent, setEditContent] = createSignal(existingNote()?.content ?? emptyString);
	let editTextArea!: HTMLTextAreaElement;
	const undoRedo = useUndoRedo<string>(editContent());
	const displayContent = createMemo(() => (isEditing() ? editContent() : (existingNote()?.content ?? emptyString)));
	const sentenceCount = createMemo(() => getSentenceCount(displayContent()));
	const wordCount = createMemo(() => getWordCount(displayContent()));
	const characterCount = createMemo(() => getCharacterCount(displayContent()));
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
		return editTitle() !== note.title || editContent() !== note.content;
	});

	function adjustTextAreaHeight() {
		if (CSS.supports("field-sizing", "content")) {
			return;
		}
		if (isEditing() && editTextArea) {
			const editor = editTextArea;
			const editorParent = editor.parentElement!;
			const editorClone = editor.cloneNode() as HTMLTextAreaElement;
			editorClone.classList.add("d-hidden");
			editorClone.style.setProperty("height", "auto");
			editorClone.value = editContent();
			editorParent.appendChild(editorClone);
			editor.style.setProperty("height", `calc(${editorClone.scrollHeight}px + 0.5rem)`);
			editorParent.removeChild(editorClone);
		}
	}

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
			.writeText(existingNote()?.content as string)
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
		setEditContent(note?.content ?? emptyString);
		undoRedo.push(editContent());
		setIsEditing(true);
		setTimeout(adjustTextAreaHeight);
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
			setEditContent(note?.content ?? emptyString);
		}
	}

	function saveNote() {
		const title = editTitle().trim() || "Untitled";
		const content = editContent();
		if (isCreateMode()) {
			const note = create(title, content);
			addNote(note);
			setIsEditing(false);
			requestSync();
			navigate(`/notes/${note.id}`);
			return;
		}
		const note = existingNote();
		if (note) {
			updateNote(note.id, title, content);
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
		trashNote(note.id);
		requestSync();
		navigate(returnTo);
	}

	function archiveCurrent() {
		const note = existingNote();
		if (!note) {
			return;
		}
		archiveNote(note.id);
		requestSync();
		navigate("/notes");
	}

	function unarchiveCurrent() {
		const note = existingNote();
		if (!note) {
			return;
		}
		unarchiveNote(note.id);
		requestSync();
		navigate("/notes/archive");
	}

	function restoreNote() {
		const note = existingNote();
		if (!note) {
			return;
		}
		restoreFromTrash(note.id);
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
		permanentlyDelete(note.id);
		requestSync();
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
		window.addEventListener("resize", adjustTextAreaHeight);
	});

	onCleanup(() => {
		debouncedPushUndo.cancel();
		window.removeEventListener("resize", adjustTextAreaHeight);
		window.removeEventListener("beforeunload", onBeforeUnload);
	});

	let bypassGuard = false;
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

	createEffect(on(editContent, adjustTextAreaHeight, { defer: true }));

	return (
		<>
			<div class="edit-note">
				<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
					<A href={backRoute()} class="btn btn-outline-secondary btn-sm" aria-label="Back to notes">
						<i class="bi bi-chevron-left"></i>
						<span>&#xA0;Back</span>
					</A>
					<Show when={!isCreateMode() && !isEditing() && isTrashed()}>
						<div class="d-flex flex-wrap gap-2">
							<button class="btn btn-outline-primary btn-sm" onClick={restoreNote} title="Restore" aria-label="Restore">
								<i class="bi bi-arrow-bar-up"></i>
							</button>
							<Show when={existingNote()}>
								<button class="btn btn-outline-secondary btn-sm" onClick={() => exportNote(existingNote()!)} title="Export" aria-label="Export">
									<i class="bi bi-download"></i>
								</button>
							</Show>
							<button class="btn btn-outline-danger btn-sm" onClick={permanentlyDeleteNote} title="Delete Permanently" aria-label="Delete Permanently">
								<i class="bi bi-trash-fill"></i>
							</button>
						</div>
					</Show>
					<Show when={!isCreateMode() && !isEditing() && !isTrashed()}>
						<div class="d-flex flex-wrap gap-2">
							<button class="btn btn-outline-primary btn-sm" onClick={startEditing} title="Edit" aria-label="Edit">
								<i class="bi bi-pen"></i>
							</button>
							<button class="btn btn-outline-secondary btn-sm" onClick={copyToClipboard} title="Copy to clipboard" aria-label="Copy to clipboard">
								<i class="bi bi-copy"></i>
							</button>
							<Show when={existingNote()}>
								<button class="btn btn-outline-secondary btn-sm" onClick={() => exportNote(existingNote()!)} title="Export" aria-label="Export">
									<i class="bi bi-download"></i>
								</button>
							</Show>
							<Show
								when={isArchived()}
								fallback={
									<button class="btn btn-outline-secondary btn-sm" onClick={archiveCurrent} title="Archive" aria-label="Archive">
										<i class="bi bi-archive"></i>
									</button>
								}>
								<button class="btn btn-outline-secondary btn-sm" onClick={unarchiveCurrent} title="Unarchive" aria-label="Unarchive">
									<i class="bi bi-box-arrow-up"></i>
								</button>
							</Show>
							<button class="btn btn-outline-danger btn-sm" onClick={deleteNote} title="Delete" aria-label="Delete">
								<i class="bi bi-trash"></i>
							</button>
						</div>
					</Show>
					<Show when={isEditing()}>
						<div class="d-flex flex-wrap gap-2">
							<button class="btn btn-outline-secondary btn-sm" disabled={!undoRedo.canUndo()} onClick={doUndo} title="Undo" aria-label="Undo">
								<i class="bi bi-arrow-counterclockwise"></i>
							</button>
							<button class="btn btn-outline-secondary btn-sm" disabled={!undoRedo.canRedo()} onClick={doRedo} title="Redo" aria-label="Redo">
								<i class="bi bi-arrow-clockwise"></i>
							</button>
							<button class="btn btn-primary btn-sm" onClick={saveNote} title="Save" aria-label="Save">
								<i class="bi bi-floppy"></i>
							</button>
							<button class="btn btn-outline-secondary btn-sm" onClick={cancelEditing} title="Cancel" aria-label="Cancel">
								<i class="bi bi-x-lg"></i>
							</button>
						</div>
					</Show>
				</div>
				<Show when={!isEditing() && existingNote()}>
					<h2 class="mb-3">{existingNote()!.title}</h2>
					<Show when={existingNote()!.modifiedAt || existingNote()!.createdAt}>
						<div class="text-muted small mb-3">{existingNote()!.modifiedAt ? `Modified ${formatDate(existingNote()!.modifiedAt)}` : `Created ${formatDate(existingNote()!.createdAt)}`}</div>
					</Show>
					<div class="note-content">{existingNote()!.content}</div>
				</Show>
				<Show when={isEditing()}>
					<input value={editTitle()} onInput={e => setEditTitle(e.currentTarget.value)} type="text" class="form-control form-control-lg mb-3" placeholder="Title"/>
					<textarea ref={editTextArea} value={editContent()} onInput={onContentInput} class="form-control note-textarea" placeholder="Start writing..." rows="12"></textarea>
				</Show>
				<Show when={displayContent()}>
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