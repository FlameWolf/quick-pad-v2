import { createMemo, createEffect, on, onMount, Show, For, Switch, Match } from "solid-js";
import { A } from "@solidjs/router";
import * as store from "@/stores/notes";
import { useFileIO } from "@/composables/useFileIO";
import { useNoteSelection } from "@/composables/useNoteSelection";
import { useNoteSort, type SortField } from "@/composables/useNoteSort";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { useNotesSync } from "@/composables/useNotesSync";
import { emptyString } from "@/library";
import SelectionActionBar, { type SelectionAction } from "./SelectionActionBar";
import Toast from "./Toast";
import type { Note } from "@/models/Note";
import type { UUID } from "crypto";

type View = "active" | "archived" | "trash";

interface Props {
	view?: View;
}

export default function DisplayNoteList(props: Props) {
	const view = createMemo<View>(() => props.view ?? "active");
	const { importFiles, importErrors, dismissErrors, exportNotes, exportAllNotes } = useFileIO();
	const { isSelectionMode, selectedCount, enterSelectionMode, exitSelectionMode, toggleSelection, isSelected, selectAll, clearSelection } = useNoteSelection();
	const { sortBy, sortDirection, setSortBy, toggleSortDirection, getSortedNotes } = useNoteSort();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const isSearchMode = createMemo(() => !!store.searchText());
	const sourceNotes = createMemo<Note[]>(() => {
		switch (view()) {
			case "archived":
				return store.archivedNotes();
			case "trash":
				return store.trashedNotes();
			default:
				return store.activeNotes();
		}
	});
	const sortedNotes = createMemo(() => getSortedNotes(sourceNotes()));
	const hasNotes = createMemo(() => sourceNotes().length > 0);
	const allSelected = createMemo(() => sourceNotes().length > 0 && selectedCount() === sourceNotes().length);
	const pageTitle = createMemo(() => {
		switch (view()) {
			case "archived":
				return "Archived Notes";
			case "trash":
				return "Trash";
			default:
				return "Notes";
		}
	});
	const emptyMessage = createMemo(() => {
		if (isSearchMode()) {
			return `No results found for "${store.searchText()}"`;
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
		return ["Import failed for the following file", errs.length === 1 ? emptyString : "s", ":<hr/>", `<ul>${errs.map(err => `<li>${err.fileName}: ${err.message}</li>`).join(emptyString)}</ul>`].join(emptyString);
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

	async function handleImport() {
		const importedCount = await importFiles();
		if (importedCount > 0) {
			requestSync();
		}
	}

	async function handleSelectionAction(key: string) {
		const ids = getSelectedIds();
		if (ids.length === 0) {
			return;
		}
		let syncNotes = true;
		let purgeNotes = false;
		const noun = ids.length === 1 ? "note" : "notes";
		switch (key) {
			case "export": {
				const selected = sourceNotes().filter(n => isSelected(n.id));
				await exportNotes(selected);
				syncNotes = false;
				break;
			}
			case "archive": {
				store.archiveMultiple(ids);
				break;
			}
			case "unarchive": {
				store.unarchiveMultiple(ids);
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
				store.trashMultiple(ids);
				break;
			}
			case "restore": {
				store.restoreFromTrashMultiple(ids);
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
				await store.permanentlyDeleteMultiple(ids);
				purgeNotes = true;
				break;
			}
		}
		if (syncNotes) {
			requestSync(purgeNotes ? ids : undefined);
		}
		exitSelectionMode();
	}

	async function handleEmptyTrash() {
		const trashed = store.trashedNotes();
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
		const trashedNoteIds = trashed.map(n => n.id);
		await store.permanentlyDeleteMultiple(trashedNoteIds);
		requestSync(trashedNoteIds);
	}

	onMount(() => {
		exitSelectionMode();
	});

	createEffect(on(view, exitSelectionMode, { defer: true }));

	return (
		<>
			<Show when={view() !== "active"}>
				<div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
					<h2 class="mb-0">{pageTitle()}</h2>
					<A href="/notes" class="btn btn-outline-secondary btn-sm">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
							<path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/>
						</svg>
						<span>&#xA0;Back to Notes</span>
					</A>
				</div>
			</Show>
			<Switch>
				<Match when={store.isLoading() || store.isSearching()}>
					<div class="d-flex flex-column justify-content-center align-items-center">
						<div class="spinner-border" aria-hidden="true"></div>
						<div class="mt-3" role="status">{store.isSearching() ? "Searching..." : "Loading notes..."}</div>
					</div>
				</Match>
				<Match when={!hasNotes()}>
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
									<A href="/notes/new" class="btn btn-primary">Create a note</A>
									<button class="btn btn-outline-secondary" onClick={handleImport}>Import from files</button>
								</div>
								<div class="d-flex gap-3 justify-content-center flex-wrap">
									<A href="/notes/archive" class="btn btn-link btn-sm text-decoration-none">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-archive me-1" viewBox="0 0 16 16">
											<path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
										</svg>
										<span>Archived</span>
									</A>
									<A href="/notes/trash" class="btn btn-link btn-sm text-decoration-none">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash me-1" viewBox="0 0 16 16">
											<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
											<path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
										</svg>
										<span>Trash</span>
									</A>
								</div>
							</div>
						</Show>
					</div>
				</Match>
				<Match when={hasNotes()}>
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
											<select id="sort-by-select" class="form-select form-select-sm sort-select" value={sortBy()} onChange={onSortFieldChange} aria-label="Sort notes by">
												<option value="modifiedAt">Updated</option>
												<option value="createdAt">Created</option>
												<option value="title">Title</option>
												<option value="sentenceCount">Sentences</option>
												<option value="wordCount">Words</option>
												<option value="characterCount">Characters</option>
											</select>
											<button class="btn btn-outline-secondary btn-sm" onClick={toggleSortDirection} aria-label={sortDirection() === "asc" ? "Sort ascending, click to switch to descending" : "Sort descending, click to switch to ascending"} title={sortDirection() === "asc" ? "Ascending" : "Descending"}>
												<Show
													when={sortDirection() === "asc"}
													fallback={
														<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sort-down" viewBox="0 0 16 16">
															<path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5M7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z"/>
														</svg>
													}>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sort-up" viewBox="0 0 16 16">
														<path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.5.5 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5M7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z"/>
													</svg>
												</Show>
											</button>
										</div>
										<button class="btn btn-outline-secondary btn-sm" onClick={enterSelectionMode}>Select</button>
										<Show when={view() === "active"}>
											<button class="btn btn-outline-secondary btn-sm" onClick={handleImport}>Import</button>
											<button class="btn btn-outline-secondary btn-sm" onClick={exportAllNotes}>Export All</button>
											<A href="/notes/archive" class="btn btn-outline-secondary btn-sm">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-archive me-1" viewBox="0 0 16 16">
													<path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
												</svg>
												<span>Archived</span>
											</A>
											<A href="/notes/trash" class="btn btn-outline-secondary btn-sm">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash me-1" viewBox="0 0 16 16">
													<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
													<path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
												</svg>
												<span>Trash</span>
											</A>
										</Show>
										<Show when={view() === "trash"}>
											<button class="btn btn-outline-danger btn-sm" onClick={handleEmptyTrash}>
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill me-1" viewBox="0 0 16 16">
													<path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
												</svg>
												<span>Empty Trash</span>
											</button>
										</Show>
									</>
								}>
								<button class="btn btn-outline-secondary btn-sm" onClick={toggleSelectAll}>{allSelected() ? "Deselect All" : "Select All"}</button>
								<button class="btn btn-outline-secondary btn-sm" onClick={exitSelectionMode}>Cancel</button>
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
									<A href={`/notes/${note.id}`} class="card note-card text-decoration-none position-relative" classList={{ selected: isSelectionMode() && isSelected(note.id) }} onClick={e => onTileClick(e, note.id)}>
										<div class="card-body d-flex flex-column">
											<Show when={isSelectionMode()}>
												<input type="checkbox" class="form-check-input selection-checkbox rounded-circle" checked={isSelected(note.id)}/>
											</Show>
											<div class="d-flex gap-1 mb-2">
												<div class="text-truncate">{note.title}</div>
												<div class="badge align-self-center text-muted border ms-auto">{formatDate(note.modifiedAt ?? note.createdAt)}</div>
											</div>
											<p class="card-text text-muted small overflow-hidden">{note.summary}</p>
										</div>
										<div class="d-flex gap-1 bg-body small w-100 position-absolute bottom-0 px-2 py-2 border-top">
											<Show when={note.sentenceCount}>
												<div class="badge text-bg-secondary">{note.sentenceCount} sentences</div>
											</Show>
											<Show when={note.wordCount}>
												<div class="badge text-bg-secondary">{note.wordCount} words</div>
											</Show>
											<Show when={note.characterCount}>
												<div class="badge text-bg-secondary">{note.characterCount} characters</div>
											</Show>
										</div>
									</A>
								)}
							</For>
						</div>
						<Show when={isSelectionMode() && selectedCount() > 0}>
							<SelectionActionBar selectedCount={selectedCount()} actions={selectionActions()} onAction={handleSelectionAction} onCancel={exitSelectionMode}/>
						</Show>
					</div>
				</Match>
			</Switch>
			<Toast message={formatImportErrors()} type="error" visible={importErrors().length > 0} timeStamp={Date.now()} onDismiss={dismissErrors}/>
		</>
	);
}