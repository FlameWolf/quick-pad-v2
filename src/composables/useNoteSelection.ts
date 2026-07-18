import { createSignal, createMemo } from "solid-js";
import type { UUID } from "crypto";

const [selecting, setSelecting] = createSignal(false);
const [selectedNoteIds, setSelectedNoteIds] = createSignal<Set<UUID>>(new Set<UUID>());
export const isSelecting = selecting;
export const selectedIds = selectedNoteIds;
export const selectedCount = createMemo(() => selectedNoteIds().size);

export function enterSelectionMode() {
	setSelecting(true);
}

export function exitSelectionMode() {
	setSelectedNoteIds(new Set<UUID>());
	setSelecting(false);
}

export function toggleSelection(id: UUID) {
	const next = new Set(selectedNoteIds());
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	setSelectedNoteIds(next);
}

export function isSelected(id: UUID): boolean {
	return selectedNoteIds().has(id);
}

export function selectAll(ids: UUID[]) {
	setSelectedNoteIds(new Set(ids));
}

export function clearSelection() {
	setSelectedNoteIds(new Set<UUID>());
}