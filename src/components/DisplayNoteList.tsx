import { createMemo, createEffect, on, onMount, Show, For, Switch, Match } from "solid-js";
import { A } from "@solidjs/router";
import * as store from "@/stores/notes";
import { useFileIO } from "@/composables/useFileIO";
import { useNoteSelection } from "@/composables/useNoteSelection";
import { useNoteSort, type SortField } from "@/composables/useNoteSort";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { useNotesSync } from "@/composables/useNotesSync";
import { emptyString } from "@/constants/common";
import { bulkActions } from "@/constants/actions";
import EmptyState from "@/components/EmptyState";
import SortControls from "@/components/SortControls";
import NoteCard from "@/components/NoteCard";
import SelectionActionBar from "./SelectionActionBar";
import Toast from "./Toast";
import type { Note } from "@/models/Note";
import type { UUID } from "crypto";

type View = "active" | "favourited" | "archived" | "trash";
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
			case "favourited":
				return store.favedNotes();
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
			case "favourited":
				return "Favourited";
			case "archived":
				return "Archived";
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
			case "favourited":
				return "No favourited notes";
			case "archived":
				return "No archived notes";
			case "trash":
				return "Trash is empty";
			default:
				return "No notes yet";
		}
	});
	const selectionActions = createMemo<SelectionAction[]>(() => {
		if (view() === "trash") {
			return bulkActions.filter(action => action.key === "restore" || action.key === "permanent");
		}
		const actionKeys = new Set<SelectionAction["key"]>(["export", "trash"]);
		switch (view()) {
			case "favourited": {
				actionKeys.add("unfave");
				break;
			}
			case "archived": {
				actionKeys.add("unarchive");
				break;
			}
			default: {
				actionKeys.add("fave");
				actionKeys.add("archive");
				break;
			}
		}
		return bulkActions.filter(action => actionKeys.has(action.key));
	});

	function onSortFieldChange(e: Event) {
		setSortBy((e.target as HTMLSelectElement).value as SortField);
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

	function getSelectedNotes(): Note[] {
		return sourceNotes().filter(n => isSelected(n.id));
	}

	function getSelectedIds(): UUID[] {
		return getSelectedNotes().map(n => n.id);
	}

	async function handleImport() {
		const importedCount = await importFiles();
		if (importedCount > 0) {
			requestSync();
		}
	}

	async function handleSelectionAction(key: SelectionAction["key"]) {
		const ids = getSelectedIds();
		if (ids.length === 0) {
			return;
		}
		let syncNotes = true;
		let purgeNotes = false;
		const noun = ids.length === 1 ? "note" : "notes";
		switch (key) {
			case "export": {
				await exportNotes(getSelectedNotes());
				syncNotes = false;
				break;
			}
			case "fave": {
				store.faveMultiple(ids);
				break;
			}
			case "unfave": {
				store.unfaveMultiple(ids);
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
						<span class="ms-2">Back to Notes</span>
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
					<EmptyState message={emptyMessage()} showActions={view() === "active" && !isSearchMode()} importAction={handleImport}/>
				</Match>
				<Match when={hasNotes()}>
					<div>
						<div class="d-flex gap-2 mb-3 justify-content-end flex-wrap">
							<Show
								when={isSelectionMode()}
								fallback={
									<>
										<SortControls sortBy={sortBy()} sortDirection={sortDirection()} sortAction={onSortFieldChange} toggleAction={toggleSortDirection}/>
										<button class="btn btn-outline-secondary btn-sm" onClick={enterSelectionMode}>Select</button>
										<Show when={view() === "active"}>
											<button class="btn btn-outline-secondary btn-sm" onClick={handleImport}>Import</button>
											<button class="btn btn-outline-secondary btn-sm" onClick={exportAllNotes}>Export All</button>
											<A href="/notes/favourite" class="btn btn-outline-secondary btn-sm">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star me-1" viewBox="0 0 16 16">
													<path d="M2.866 14.85c-.078.444.36.791.746.593l4.39-2.256 4.389 2.256c.386.198.824-.149.746-.592l-.83-4.73 3.522-3.356c.33-.314.16-.888-.282-.95l-4.898-.696L8.465.792a.513.513 0 0 0-.927 0L5.354 5.12l-4.898.696c-.441.062-.612.636-.283.95l3.523 3.356-.83 4.73zm4.905-2.767-3.686 1.894.694-3.957a.56.56 0 0 0-.163-.505L1.71 6.745l4.052-.576a.53.53 0 0 0 .393-.288L8 2.223l1.847 3.658a.53.53 0 0 0 .393.288l4.052.575-2.906 2.77a.56.56 0 0 0-.163.506l.694 3.957-3.686-1.894a.5.5 0 0 0-.461 0z"/>
												</svg>
												<span>Favourited</span>
											</A>
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
							<For each={sortedNotes()}>{note => <NoteCard note={note} selectionMode={isSelectionMode()} selected={isSelected(note.id)} clickAction={onTileClick}/>}</For>
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