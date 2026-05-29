import { createEffect, createSignal, on } from "solid-js";
import { getKV, setKV } from "@/storage/db";
import type { Note } from "@/models/Note";

export type SortField = "createdAt" | "modifiedAt" | "title" | "sentenceCount" | "wordCount" | "characterCount";
export type SortDirection = "asc" | "desc";

const SORT_BY_KEY = "sort-by";
const SORT_DIRECTION_KEY = "sort-direction";
const SORT_FIELDS: ReadonlyArray<SortField> = ["createdAt", "modifiedAt", "title", "characterCount"];
const SORT_DIRECTIONS: ReadonlyArray<SortDirection> = ["asc", "desc"];
const [sortBy, setSortBy] = createSignal<SortField>("modifiedAt");
const [sortDirection, setSortDirection] = createSignal<SortDirection>("desc");

export async function hydrateSortPrefs(): Promise<void> {
	const storedBy = await getKV<string>(SORT_BY_KEY);
	if (SORT_FIELDS.includes(storedBy as SortField)) {
		setSortBy(storedBy as SortField);
	}
	const storedDir = await getKV<string>(SORT_DIRECTION_KEY);
	if (SORT_DIRECTIONS.includes(storedDir as SortDirection)) {
		setSortDirection(storedDir as SortDirection);
	}
	createEffect(
		on(
			sortBy,
			async field => {
				await setKV(SORT_BY_KEY, field);
			},
			{ defer: true }
		)
	);
	createEffect(
		on(
			sortDirection,
			async direction => {
				await setKV(SORT_DIRECTION_KEY, direction);
			},
			{ defer: true }
		)
	);
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

export function useNoteSort() {
	function toggleSortDirection() {
		setSortDirection(sortDirection() === "asc" ? "desc" : "asc");
	}

	function getSortedNotes(notes: ReadonlyArray<Note>): Note[] {
		const multiplier = sortDirection() === "asc" ? 1 : -1;
		return (notes as Note[]).sort((a, b) => compareNotes(a, b, sortBy()) * multiplier);
	}

	return {
		sortBy,
		sortDirection,
		setSortBy,
		setSortDirection,
		toggleSortDirection,
		getSortedNotes
	};
}