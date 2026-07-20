import { createEffect, createMemo, on, runWithOwner } from "solid-js";
import { createStore } from "solid-js/store";
import { SORT_FIELDS, SORT_DIRECTIONS, SORT_BY_KEY, SORT_DIRECTION_KEY } from "@/constants/sort";
import { getKV, setKV } from "@/storage/db";
import { getAppOwner } from "@/composables/useAppOwner";
import type { Note } from "@/models/Note";

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_DIRECTIONS)[number];
interface SortState {
	sortField: SortField;
	sortOrder: SortOrder;
}

let hydrated = false;
const [state, setState] = createStore<SortState>({
	sortField: "modifiedAt",
	sortOrder: "desc"
});
export const sortField = createMemo(() => state.sortField);
export const sortOrder = createMemo(() => state.sortOrder);

export async function hydrateSortPrefs(): Promise<void> {
	if (hydrated) {
		return;
	}
	hydrated = true;
	const storedBy = await getKV(SORT_BY_KEY);
	if (SORT_FIELDS.includes(storedBy as SortField)) {
		setState("sortField", storedBy as SortField);
	}
	const storedDir = await getKV(SORT_DIRECTION_KEY);
	if (SORT_DIRECTIONS.includes(storedDir as SortOrder)) {
		setState("sortOrder", storedDir as SortOrder);
	}
	runWithOwner(getAppOwner(), () => {
		createEffect(
			on(
				() => state.sortField,
				async field => {
					await setKV(SORT_BY_KEY, field);
				},
				{ defer: true }
			)
		);
		createEffect(
			on(
				() => state.sortOrder,
				async order => {
					await setKV(SORT_DIRECTION_KEY, order);
				},
				{ defer: true }
			)
		);
	});
}

function compareNotes(a: Note, b: Note, field: SortField): number {
	switch (field) {
		case "title":
			return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
		case "createdAt":
			return a.createdAt.getTime() - b.createdAt.getTime();
		case "modifiedAt": {
			const aTime = (a.modifiedAt ?? a.createdAt).getTime();
			const bTime = (b.modifiedAt ?? b.createdAt).getTime();
			return aTime - bTime;
		}
		case "sentenceCount":
			return (a.sentenceCount ?? 0) - (b.sentenceCount ?? 0);
		case "wordCount":
			return (a.wordCount ?? 0) - (b.wordCount ?? 0);
		case "characterCount":
			return (a.characterCount ?? 0) - (b.characterCount ?? 0);
	}
}

export function setSortField(field: SortField) {
	setState("sortField", field);
}

export function setSortOrder(order: SortOrder) {
	setState("sortOrder", order);
}

export function toggleSortDirection() {
	setSortOrder(state.sortOrder === "asc" ? "desc" : "asc");
}

export function getSortedNotes(notes: ReadonlyArray<Note>): Note[] {
	const multiplier = state.sortOrder === "asc" ? 1 : -1;
	return notes.toSorted((a, b) => {
		if (a.pinnedAt && !b.pinnedAt) {
			return -1;
		}
		if (b.pinnedAt && !a.pinnedAt) {
			return 1;
		}
		if (a.pinnedAt && b.pinnedAt) {
			return b.pinnedAt.getTime() - a.pinnedAt.getTime();
		}
		return compareNotes(a, b, state.sortField) * multiplier;
	});
}