import { createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import type { UUID } from "crypto";

interface SelectionState {
	isSelecting: boolean;
	selectedIds: Set<UUID>;
}

const [state, setState] = createStore<SelectionState>({
	isSelecting: false,
	selectedIds: new Set<UUID>()
});
export const isSelecting = createMemo(() => state.isSelecting);
export const selectedIds = createMemo(() => state.selectedIds);
export const selectedCount = createMemo(() => state.selectedIds.size);

export function enterSelectionMode() {
	setState("isSelecting", true);
}

export function exitSelectionMode() {
	setState("selectedIds", new Set<UUID>());
	setState("isSelecting", false);
}

export function toggleSelection(id: UUID) {
	const next = new Set(state.selectedIds);
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	setState("selectedIds", next);
}

export function isSelected(id: UUID): boolean {
	return state.selectedIds.has(id);
}

export function selectAll(ids: UUID[]) {
	setState("selectedIds", new Set(ids));
}

export function clearSelection() {
	setState("selectedIds", new Set<UUID>());
}