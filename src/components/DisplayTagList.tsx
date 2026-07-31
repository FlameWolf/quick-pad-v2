import { createEffect, createMemo, createSignal, For, on, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useNavigate } from "@solidjs/router";
import { emptyString } from "@/constants/common";
import { areSetsEqual, normaliseTag, titleCase } from "@/utils/common";
import { getTime } from "@/utils/dates";
import { contains, equals } from "@/utils/text-analysis";
import * as notesStore from "@/stores/notes";
import { confirm } from "@/composables/useConfirmDialogue";
import { useDropdown } from "@/composables/useDropdown";
import { exitSelectionMode, isSelecting, selectedCount, selectedIds } from "@/composables/useNoteSelection";
import { requestSync } from "@/composables/useNotesSync";
import Icon from "@/components/Icon";

interface Props {
	activeTags?: string[];
	allowCreate?: boolean;
	allowDelete?: boolean;
	allowEdit?: boolean;
	allowManage?: boolean;
	class?: string;
	onSelectionChanged?: (tags: string[]) => void;
}

export default function DisplayTagList(props: Props) {
	let syncingUp = false;
	let syncingDown = false;
	let lastSelected: string[] = [];
	const navigate = useNavigate();
	const [dropdownToggle, setDropdownToggle] = createSignal<HTMLElement | undefined>();
	const [dropdownMenu, setDropdownMenu] = createSignal<HTMLElement | undefined>();
	const [searchText, setSearchText] = createSignal(emptyString);
	const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
	const { show, toggle } = useDropdown(dropdownToggle, {
		autoClose: false,
		dropdown: dropdownMenu
	});
	const filteredTags = createMemo(() => {
		if (!searchText()) {
			return notesStore.tags();
		}
		return notesStore.tags().filter(tag => contains(tag, searchText()));
	});
	const allSelected = createMemo(() => filteredTags().every(tag => selectedTags().includes(tag)));
	const hasExactMatch = createMemo(() => {
		if (!searchText()) {
			return true;
		}
		return notesStore.tags().some(tag => equals(tag, normaliseTag(searchText())));
	});
	const enableActions = createMemo(() => !!(selectedCount() && selectedTags().length));

	function syncState(direction: "up" | "down") {
		if (!props.allowEdit || isSelecting()) {
			return;
		}
		if (areSetsEqual(new Set(selectedTags()), notesStore.searchTags())) {
			return;
		}
		switch (direction) {
			case "up": {
				syncingUp = true;
				notesStore.setSearchTags(selectedTags());
				break;
			}
			case "down": {
				syncingDown = true;
				setSelectedTags(Array.from(notesStore.searchTags()));
				break;
			}
		}
	}

	function isTagSelected(tag: string) {
		return selectedTags().includes(tag);
	}

	function toggleTagSelection(tag: string) {
		if (isTagSelected(tag)) {
			setSelectedTags(tags => tags.toSpliced(tags.indexOf(tag), 1));
			return;
		}
		setSelectedTags(selectedTags().concat(tag));
	}

	function toggleSelectAll() {
		if (!allSelected()) {
			setSelectedTags(Array.from(filteredTags()));
			return;
		}
		setSelectedTags([]);
	}

	function unselectTag(tag: string) {
		const index = selectedTags().indexOf(tag);
		if (index !== -1) {
			setSelectedTags(tags => tags.toSpliced(index, 1));
		}
	}

	async function createTag(tag: string) {
		const normalised = normaliseTag(tag);
		await notesStore.createTag(normalised);
		setSelectedTags(tags => tags.concat(normalised));
	}

	async function deleteTags(tags: string[]) {
		const hasMany = tags.length > 1;
		const suffix = hasMany ? "s" : emptyString;
		const ok = await confirm({
			title: `Delete selected tag${suffix} permanently?`,
			message: `The selected tag${suffix} will be deleted permanently. ${hasMany ? "They" : "It"} will also be removed from any notes that use ${hasMany ? "them" : "it"}.`,
			confirmText: "Delete Tags",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (ok) {
			setSelectedTags(selected => selected.filter(tag => !tags.includes(tag)));
			const affectedCount = await notesStore.deleteTags(tags.map(normaliseTag));
			if (affectedCount) {
				requestSync();
			}
		}
	}

	async function updateNoteTags(action: "add" | "remove") {
		const now = Date.now();
		const isAdding = action === "add";
		const ok = await confirm({
			title: `${titleCase(action)} tags`,
			message: `The selected tags will be ${isAdding ? "added" : "removed"} ${isAdding ? "to" : "from"} the selected notes. Do you want to proceed?`,
			confirmText: "Confirm",
			cancelText: "Cancel",
			variant: "warning"
		});
		if (!ok) {
			return;
		}
		switch (action) {
			case "add": {
				notesStore.addTagsMultiple(Array.from(selectedIds()), selectedTags());
				break;
			}
			case "remove": {
				notesStore.removeTagsMultiple(Array.from(selectedIds()), selectedTags());
				break;
			}
		}
		if (notesStore.notes().some(note => selectedIds().has(note.id) && getTime(note.stateChangedAt) > now)) {
			requestSync();
		}
		exitSelectionMode();
	}

	function addToSearchTags(tag: string) {
		if (props.allowEdit) {
			return;
		}
		notesStore.addSearchTag(tag);
		navigate("/");
	}

	onMount(() => {
		setSelectedTags(props.activeTags ?? []);
	});

	createEffect(
		on(
			isSelecting,
			(curr, prev) => {
				if (!prev) {
					lastSelected = selectedTags();
				}
				if (!curr) {
					setSelectedTags(lastSelected);
				}
			},
			{ defer: true }
		)
	);

	createEffect(
		on(
			() => props.allowEdit,
			value => {
				if (!value) {
					setSelectedTags(props.activeTags ?? []);
				}
			},
			{ defer: true }
		)
	);

	createEffect(
		on(
			selectedTags,
			tags => {
				props.onSelectionChanged?.(tags);
				if (!syncingDown && props.allowManage) {
					syncState("up");
				}
				syncingDown = false;
			},
			{ defer: true }
		)
	);

	createEffect(
		on(
			notesStore.searchTags,
			() => {
				if (!syncingUp) {
					syncState("down");
				}
				syncingUp = false;
			},
			{ defer: true }
		)
	);

	return (
		<div class="d-flex flex-wrap gap-2 p-1 border rounded" classList={{ [props.class as string]: !!props.class }}>
			<div class="dropdown">
				<Show when={props.allowEdit} fallback={<label class="small border border-secondary rounded px-2 py-1">Tags</label>}>
					<button ref={setDropdownToggle} class="btn btn-sm btn-outline-secondary dropdown-toggle" onClick={toggle}>Tags</button>
				</Show>
				<Show when={props.allowEdit && show()}>
					<ul ref={setDropdownMenu} class="dropdown-menu show mt-1 ms-n1">
						<Show when={props.allowManage}>
							<li class="dropdown-item">
								<label class="btn btn-sm btn-outline-secondary">
									<input type="checkbox" class="form-check-input" checked={allSelected()} disabled={!filteredTags().length} onChange={toggleSelectAll}/>
									<span class="ms-2">{allSelected() ? "Deselect All" : "Select All"}</span>
								</label>
								<Show when={props.allowDelete}>
									<button class="btn btn-sm btn-outline-danger ms-2" disabled={!selectedTags().length} onClick={() => deleteTags(selectedTags())}>Delete Selected</button>
								</Show>
							</li>
							<li class="dropdown-divider"></li>
						</Show>
						<li class="dropdown-item">
							<div class="flex-nowrap" classList={{ "input-group": props.allowCreate }}>
								<input value={searchText()} onInput={e => setSearchText(e.currentTarget.value.trim())} type="text" class="form-control form-control-sm" placeholder="Search"/>
								<Show when={props.allowCreate}>
									<button class="btn btn-sm btn-outline-secondary" disabled={hasExactMatch()} onClick={() => createTag(searchText())}>
										<Icon type="plusLg"/>
									</button>
								</Show>
							</div>
						</li>
						<li class="dropdown-divider"></li>
						<For each={filteredTags()}>
							{tag => (
								<li>
									<label class="dropdown-item">
										<input type="checkbox" class="form-check-input" checked={isTagSelected(tag)} onChange={() => toggleTagSelection(tag)}/>
										<span class="text-wrap text-break ms-2">{tag}</span>
									</label>
								</li>
							)}
						</For>
					</ul>
				</Show>
			</div>
			<Show when={selectedTags().length}>
				<div class="d-flex flex-wrap gap-2">
					<For each={selectedTags()}>
						{tag => (
							<Dynamic component={props.allowEdit ? "div" : "a"} class="badge align-self-center text-bg-secondary" classList={{ "py-2": !props.allowEdit }} onClick={() => addToSearchTags(tag)} {...(props.allowEdit ? {} : { role: "button" })}>
								<span>{tag}</span>
								<Show when={props.allowEdit}>
									<button class="small btn-close ms-2" onClick={() => unselectTag(tag)}></button>
								</Show>
							</Dynamic>
						)}
					</For>
				</div>
			</Show>
			<Show when={isSelecting()}>
				<div class="d-flex gap-2 ms-auto">
					<button class="btn btn-sm btn-outline-primary" disabled={!enableActions()} onClick={() => updateNoteTags("add")}>Apply</button>
					<button class="btn btn-sm btn-outline-danger" disabled={!enableActions()} onClick={() => updateNoteTags("remove")}>Remove</button>
				</div>
			</Show>
		</div>
	);
}