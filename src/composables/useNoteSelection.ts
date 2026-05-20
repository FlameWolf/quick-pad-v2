import { createSignal, createMemo } from "solid-js";
import type { UUID } from "crypto";

const [selectedIds, setSelectedIds] = createSignal<Set<UUID>>(new Set<UUID>());
const [isSelectionMode, setIsSelectionMode] = createSignal(false);
const selectedCount = createMemo(() => selectedIds().size);

export function useNoteSelection() {
	function enterSelectionMode() {
		setIsSelectionMode(true);
	}

	function exitSelectionMode() {
		setSelectedIds(new Set<UUID>());
		setIsSelectionMode(false);
	}

	function toggleSelection(id: UUID) {
		const next = new Set(selectedIds());
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		setSelectedIds(next);
	}

	function isSelected(id: UUID): boolean {
		return selectedIds().has(id);
	}

	function selectAll(ids: UUID[]) {
		setSelectedIds(new Set(ids));
	}

	function clearSelection() {
		setSelectedIds(new Set<UUID>());
	}

	return {
		isSelectionMode,
		selectedIds,
		selectedCount,
		enterSelectionMode,
		exitSelectionMode,
		toggleSelection,
		isSelected,
		selectAll,
		clearSelection
	};
}