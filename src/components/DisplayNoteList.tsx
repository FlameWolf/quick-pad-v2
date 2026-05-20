import { createMemo, createEffect, on, onMount, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import {
	activeNotes,
	archivedNotes,
	trashedNotes,
	searchText,
	archiveMultiple,
	unarchiveMultiple,
	trashMultiple,
	restoreFromTrashMultiple,
	permanentlyDeleteMultiple
} from "@/stores/notes";
import { useFileIO } from "@/composables/useFileIO";
import { useNoteSelection } from "@/composables/useNoteSelection";
import { useNoteSort, type SortField } from "@/composables/useNoteSort";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { useNotesSync } from "@/composables/useNotesSync";
import { emptyString } from "@/library";
import { noteCharacterCount, noteSentenceCount, noteSummary, noteWordCount, type Note } from "@/models/Note";
import SelectionActionBar, { type SelectionAction } from "./SelectionActionBar";
import Toast from "./Toast";
import type { UUID } from "crypto";

type View = "active" | "archived" | "trash";

interface Props {
	view?: View;
}

export default function DisplayNoteList(props: Props) {
	const view = createMemo<View>(() => props.view ?? "active");
	const { importFiles, importErrors, dismissErrors, exportNotes, exportAllNotes } = useFileIO();
	const {
		isSelectionMode,
		selectedCount,
		enterSelectionMode,
		exitSelectionMode,
		toggleSelection,
		isSelected,
		selectAll,
		clearSelection
	} = useNoteSelection();
	const { sortBy, sortDirection, setSortBy, toggleSortDirection, getSortedNotes } = useNoteSort();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const isSearchMode = createMemo(() => !!searchText());
	const sourceNotes = createMemo<Note[]>(() => {
		switch (view()) {
			case "archived":
				return archivedNotes();
			case "trash":
				return trashedNotes();
			default:
				return activeNotes();
		}
	});
	const sortedNotes = createMemo(() => getSortedNotes(sourceNotes()));
	const hasNotes = createMemo(() => sourceNotes().length > 0);
	const allSelected = createMemo(() => sourceNotes().length > 0 && selectedCount() === sourceNotes().length);
	const pageTitle = createMemo(() => {
		if (view() === "archived") {
			return "Archived";
		}
		if (view() === "trash") {
			return "Trash";
		}
		return "Notes";
	});
	const emptyMessage = createMemo(() => {
		if (isSearchMode()) {
			return `No results found for "${searchText()}"`;
		}
		switch (view()) {
			case "archived":
				return "No archived notes";
			case "trash":
				return "Trash is empty";
			default:
				return "No notes yet";
		}
	});
	const selectionActions = createMemo<SelectionAction[]>(() => {
		if (view() === "archived") {
			return [
				{ key: "export", label: "Export Selected", variant: "primary" },
				{ key: "unarchive", label: "Unarchive Selected", variant: "outline-primary" },
				{ key: "trash", label: "Delete Selected", variant: "outline-danger" }
			];
		}
		if (view() === "trash") {
			return [
				{ key: "restore", label: "Restore Selected", variant: "outline-primary" },
				{ key: "permanent", label: "Delete Permanently", variant: "outline-danger" }
			];
		}
		return [
			{ key: "export", label: "Export Selected", variant: "primary" },
			{ key: "archive", label: "Archive Selected", variant: "outline-primary" },
			{ key: "trash", label: "Delete Selected", variant: "outline-danger" }
		];
	});

	function onSortFieldChange(e: Event) {
		setSortBy((e.target as HTMLSelectElement).value as SortField);
	}

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function formatImportErrors(): string {
		const errs = importErrors();
		return [
			"Import failed for the following file",
			errs.length === 1 ? emptyString : "s",
			":<hr/>",
			`<ul>${errs.map(err => `<li>${err.fileName}: ${err.message}</li>`).join(emptyString)}</ul>`
		].join(emptyString);
	}

	function onTileClick(e: MouseEvent, noteId: UUID) {
		if (isSelectionMode()) {
			e.preventDefault();
			toggleSelection(noteId);
		}
	}

	function toggleSelectAll() {
		if (allSelected()) {
			clearSelection();
		} else {
			selectAll(sourceNotes().map(n => n.id));
		}
	}

	function getSelectedIds(): UUID[] {
		return sourceNotes()
			.filter(n => isSelected(n.id))
			.map(n => n.id);
	}

	async function handleSelectionAction(key: string) {
		const ids = getSelectedIds();
		if (ids.length === 0) {
			return;
		}
		const noun = ids.length === 1 ? "note" : "notes";
		switch (key) {
			case "export": {
				const selected = sourceNotes().filter(n => isSelected(n.id));
				await exportNotes(selected);
				exitSelectionMode();
				break;
			}
			case "archive": {
				archiveMultiple(ids);
				requestSync();
				exitSelectionMode();
				break;
			}
			case "unarchive": {
				unarchiveMultiple(ids);
				requestSync();
				exitSelectionMode();
				break;
			}
			case "trash": {
				const ok = await confirm({
					title: `Move ${ids.length} ${noun} to Trash?`,
					message: `${ids.length === 1 ? "This note" : "These notes"} can be restored from Trash within 30 days.`,
					confirmText: "Move to Trash",
					cancelText: "Cancel",
					variant: "danger"
				});
				if (!ok) {
					return;
				}
				trashMultiple(ids);
				requestSync();
				exitSelectionMode();
				break;
			}
			case "restore": {
				restoreFromTrashMultiple(ids);
				requestSync();
				exitSelectionMode();
				break;
			}
			case "permanent": {
				const ok = await confirm({
					title: `Permanently delete ${ids.length} ${noun}?`,
					message: "This action cannot be undone.",
					confirmText: "Delete Permanently",
					cancelText: "Cancel",
					variant: "danger"
				});
				if (!ok) {
					return;
				}
				permanentlyDeleteMultiple(ids);
				requestSync(ids);
				exitSelectionMode();
				break;
			}
		}
	}

	async function handleEmptyTrash() {
		const trashed = trashedNotes();
		const count = trashed.length;
		if (count === 0) {
			return;
		}
		const ok = await confirm({
			title: "Empty Trash?",
			message: `${count} ${count === 1 ? "note" : "notes"} will be permanently deleted. This cannot be undone.`,
			confirmText: "Empty Trash",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		const idsToPurge = trashed.map(n => n.id);
		permanentlyDeleteMultiple(idsToPurge);
		requestSync(idsToPurge);
	}

	onMount(() => {
		exitSelectionMode();
	});

	createEffect(on(view, () => exitSelectionMode(), { defer: true }));

	return (
		<>
			<Show when={view() !== "active"}>
				<div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
					<h2 class="mb-0">{pageTitle()}</h2>
					<A href="/notes" class="btn btn-outline-secondary btn-sm">
						<i class="bi bi-chevron-left"></i>
						<span>&#xA0;Back to Notes</span>
					</A>
				</div>
			</Show>
			<Show
				when={hasNotes()}
				fallback={
					<div class="empty-state text-center py-5">
						<div class="text-muted mb-3">
							<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
								<path d="M5 0h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2 2 2 0 0 1-2 2H3a2 2 0 0 1-2-2h1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1H1a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1H3a2 2 0 0 1 2-2z"/>
								<path d="M1 6v-.5a.5.5 0 0 1 1 0V6h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0V9h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1z"/>
							</svg>
						</div>
						<p class="text-muted mb-3">{emptyMessage()}</p>
						<Show when={view() === "active" && !isSearchMode()}>
							<div class="d-flex flex-column gap-2 align-items-center">
								<div class="d-flex gap-2 justify-content-center flex-wrap">
									<A href="/notes/new" class="btn btn-primary">
										Create a note
									</A>
									<button class="btn btn-outline-secondary" onClick={() => importFiles()}>
										Import from files
									</button>
								</div>
								<div class="d-flex gap-3 justify-content-center flex-wrap">
									<A href="/notes/archive" class="btn btn-link btn-sm text-decoration-none">
										<i class="bi bi-archive me-1" aria-hidden="true"></i>Archived
									</A>
									<A href="/notes/trash" class="btn btn-link btn-sm text-decoration-none">
										<i class="bi bi-trash me-1" aria-hidden="true"></i>Trash
									</A>
								</div>
							</div>
						</Show>
					</div>
				}
			>
				<div>
					<div class="d-flex gap-2 mb-3 justify-content-end flex-wrap">
						<Show
							when={isSelectionMode()}
							fallback={
								<>
									<div class="d-flex gap-1 align-items-center sort-controls">
										<label for="sort-by-select" class="form-label text-muted small mb-0 me-1">
											Sort:
										</label>
										<select
											id="sort-by-select"
											class="form-select form-select-sm sort-select"
											value={sortBy()}
											onChange={onSortFieldChange}
											aria-label="Sort notes by"
										>
											<option value="modifiedAt">Updated</option>
											<option value="createdAt">Created</option>
											<option value="title">Title</option>
											<option value="sentenceCount">Sentences</option>
											<option value="wordCount">Words</option>
											<option value="characterCount">Characters</option>
										</select>
										<button
											class="btn btn-outline-secondary btn-sm"
											onClick={() => toggleSortDirection()}
											aria-label={
												sortDirection() === "asc"
													? "Sort ascending, click to switch to descending"
													: "Sort descending, click to switch to ascending"
											}
											title={sortDirection() === "asc" ? "Ascending" : "Descending"}
										>
											<i
												class={`bi ${sortDirection() === "asc" ? "bi-sort-up" : "bi-sort-down"}`}
												aria-hidden="true"
											></i>
										</button>
									</div>
									<button class="btn btn-outline-secondary btn-sm" onClick={() => enterSelectionMode()}>
										Select
									</button>
									<Show when={view() === "active"}>
										<button class="btn btn-outline-secondary btn-sm" onClick={() => importFiles()}>
											Import
										</button>
										<button class="btn btn-outline-secondary btn-sm" onClick={() => exportAllNotes()}>
											Export All
										</button>
										<A href="/notes/archive" class="btn btn-outline-secondary btn-sm">
											<i class="bi bi-archive me-1" aria-hidden="true"></i>Archived
										</A>
										<A href="/notes/trash" class="btn btn-outline-secondary btn-sm">
											<i class="bi bi-trash me-1" aria-hidden="true"></i>Trash
										</A>
									</Show>
									<Show when={view() === "trash"}>
										<button class="btn btn-outline-danger btn-sm" onClick={() => handleEmptyTrash()}>
											<i class="bi bi-trash me-1" aria-hidden="true"></i>Empty Trash
										</button>
									</Show>
								</>
							}
						>
							<button class="btn btn-outline-secondary btn-sm" onClick={() => toggleSelectAll()}>
								{allSelected() ? "Deselect All" : "Select All"}
							</button>
							<button class="btn btn-outline-secondary btn-sm" onClick={() => exitSelectionMode()}>
								Cancel
							</button>
						</Show>
					</div>
					<div class="notes-grid">
						<Show when={view() === "active" && !isSelectionMode()}>
							<A href="/notes/new" class="card note-card new-note-card text-decoration-none">
								<div class="card-body d-flex align-items-center justify-content-center">
									<span class="fs-1 text-muted">+</span>
								</div>
							</A>
						</Show>
						<For each={sortedNotes()}>
							{note => (
								<A
									href={`/notes/${note.id}`}
									class="card note-card text-decoration-none"
									classList={{ selected: isSelectionMode() && isSelected(note.id) }}
									onClick={e => onTileClick(e, note.id)}
								>
									<div class="card-body d-flex flex-column position-relative">
										<Show when={isSelectionMode()}>
											<input
												type="checkbox"
												class="form-check-input selection-checkbox"
												checked={isSelected(note.id)}
												onClick={e => {
													e.stopPropagation();
													e.preventDefault();
													toggleSelection(note.id);
												}}
											/>
										</Show>
										<h6 class="card-title text-truncate mb-1">{note.title}</h6>
										<small class="text-muted mb-2">{formatDate(note.modifiedAt ?? note.createdAt)}</small>
										<div class="d-flex gap-2 flex-wrap small">
											<Show when={noteSentenceCount(note)}>
												<div class="badge text-bg-secondary">{noteSentenceCount(note)} sentences</div>
											</Show>
											<Show when={noteWordCount(note)}>
												<div class="badge text-bg-secondary">{noteWordCount(note)} words</div>
											</Show>
											<Show when={noteCharacterCount(note)}>
												<div class="badge text-bg-secondary">{noteCharacterCount(note)} characters</div>
											</Show>
										</div>
										<p class="card-text text-muted small flex-grow-1 overflow-hidden">{noteSummary(note)}</p>
									</div>
								</A>
							)}
						</For>
					</div>
					<Show when={isSelectionMode() && selectedCount() > 0}>
						<SelectionActionBar
							selectedCount={selectedCount()}
							actions={selectionActions()}
							onAction={handleSelectionAction}
							onCancel={() => exitSelectionMode()}
						/>
					</Show>
				</div>
			</Show>
			<Toast
				message={formatImportErrors()}
				type="error"
				visible={importErrors().length > 0}
				timeStamp={Date.now()}
				onDismiss={() => dismissErrors()}
			/>
		</>
	);
}