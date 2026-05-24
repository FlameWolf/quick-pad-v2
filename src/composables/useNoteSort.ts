import { createSignal } from "solid-js";
import { characterCount, sentenceCount, wordCount, type Note } from "@/models/Note";

export type SortField = "createdAt" | "modifiedAt" | "title" | "sentenceCount" | "wordCount" | "characterCount";
export type SortDirection = "asc" | "desc";

const SORT_BY_KEY = "quick-pad-sort-by";
const SORT_DIRECTION_KEY = "quick-pad-sort-direction";
const SORT_FIELDS: ReadonlyArray<SortField> = ["createdAt", "modifiedAt", "title", "characterCount"];
const SORT_DIRECTIONS: ReadonlyArray<SortDirection> = ["asc", "desc"];

function loadSortBy(): SortField {
	const raw = localStorage.getItem(SORT_BY_KEY);
	return SORT_FIELDS.includes(raw as SortField) ? (raw as SortField) : "modifiedAt";
}

function loadSortDirection(): SortDirection {
	const raw = localStorage.getItem(SORT_DIRECTION_KEY);
	return SORT_DIRECTIONS.includes(raw as SortDirection) ? (raw as SortDirection) : "desc";
}

const [sortBy, setSortByInternal] = createSignal<SortField>(loadSortBy());
const [sortDirection, setSortDirectionInternal] = createSignal<SortDirection>(loadSortDirection());

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
			return sentenceCount(a) - sentenceCount(b);
		case "wordCount":
			return wordCount(a) - wordCount(b);
		case "characterCount":
			return characterCount(a) - characterCount(b);
	}
}

export function useNoteSort() {
	function setSortBy(field: SortField) {
		setSortByInternal(field);
		localStorage.setItem(SORT_BY_KEY, field);
	}

	function setSortDirection(direction: SortDirection) {
		setSortDirectionInternal(direction);
		localStorage.setItem(SORT_DIRECTION_KEY, direction);
	}

	function toggleSortDirection() {
		setSortDirection(sortDirection() === "asc" ? "desc" : "asc");
	}

	function getSortedNotes(notes: ReadonlyArray<Note>): Note[] {
		const multiplier = sortDirection() === "asc" ? 1 : -1;
		return [...notes].sort((a, b) => compareNotes(a, b, sortBy()) * multiplier);
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