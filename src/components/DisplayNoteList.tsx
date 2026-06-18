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
import Icon from "@/components/Icon";
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
						<Icon type="chevronLeft"/>
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
										<button class="btn btn-outline-secondary btn-sm" onClick={enterSelectionMode}>
											<Icon type="check2Square"/>
											<span class="d-none d-sm-inline ms-2">Select</span>
										</button>
										<Show when={view() === "active"}>
											<button class="btn btn-outline-secondary btn-sm" onClick={handleImport}>
												<Icon type="boxArrowDownRight"/>
												<span class="d-none d-sm-inline ms-2">Import</span>
											</button>
											<button class="btn btn-outline-secondary btn-sm" onClick={exportAllNotes}>
												<Icon type="boxArrowUpRight"/>
												<span class="d-none d-sm-inline ms-2">Export All</span>
											</button>
											<A href="/notes/favourite" class="btn btn-outline-secondary btn-sm">
												<Icon type="star"/>
												<span class="d-none d-sm-inline ms-2">Favourited</span>
											</A>
											<A href="/notes/archive" class="btn btn-outline-secondary btn-sm">
												<Icon type="archive"/>
												<span class="d-none d-sm-inline ms-2">Archived</span>
											</A>
											<A href="/notes/trash" class="btn btn-outline-secondary btn-sm">
												<Icon type="trash"/>
												<span class="d-none d-sm-inline ms-2">Trash</span>
											</A>
										</Show>
										<Show when={view() === "trash"}>
											<button class="btn btn-outline-danger btn-sm" onClick={handleEmptyTrash}>
												<Icon type="trashFill"/>
												<span class="d-none d-sm-inline ms-2">Empty Trash</span>
											</button>
										</Show>
									</>
								}>
								<button class="btn btn-outline-secondary btn-sm" onClick={toggleSelectAll}>
									<Icon type="listCheck"/>
									<span class="d-none d-sm-inline ms-2">{allSelected() ? "Deselect All" : "Select All"}</span>
								</button>
								<button class="btn btn-outline-secondary btn-sm" onClick={exitSelectionMode}>
									<Icon type="xCircle"/>
									<span class="d-none d-sm-inline ms-2">Cancel</span>
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