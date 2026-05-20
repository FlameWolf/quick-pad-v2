import { createStore, produce } from "solid-js/store";
import { createMemo, createEffect } from "solid-js";
import { fromJSON, toJSON, type Note, type NoteJSON } from "@/models/Note";
import { contains, emptyString } from "@/library";
import type { UUID } from "crypto";

const STORAGE_KEY = "quick-pad-notes";
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function loadFromStorage(): Note[] {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return [];
	}
	try {
		const parsed: NoteJSON[] = JSON.parse(raw);
		return parsed.map(fromJSON);
	} catch {
		return [];
	}
}

interface NotesState {
	notes: Note[];
	searchText: string;
}

const [state, setState] = createStore<NotesState>({
	notes: loadFromStorage(),
	searchText: emptyString
});

export const notes = () => state.notes;
export const searchText = () => state.searchText;
export const setSearchText = (value: string) => setState("searchText", value);

const searchResults = createMemo(() =>
	state.searchText.trim()
		? state.notes.filter(note => contains(note.title, state.searchText) || contains(note.content, state.searchText))
		: state.notes
);

export const activeNotes = createMemo(() => searchResults().filter(note => !note.archivedAt && !note.deletedAt));
export const archivedNotes = createMemo(() => searchResults().filter(note => note.archivedAt && !note.deletedAt));
export const trashedNotes = createMemo(() => searchResults().filter(note => note.deletedAt));

let hydrated = false;
createEffect(() => {
	const serialized = JSON.stringify(state.notes.map(toJSON));
	if (!hydrated) {
		hydrated = true;
		return;
	}
	localStorage.setItem(STORAGE_KEY, serialized);
});

export function getNote(id: UUID): Note | undefined {
	return state.notes.find(note => note.id === id);
}

export function addNote(note: Note) {
	setState("notes", ns => [...ns, note]);
}

export function updateNote(id: UUID, title: string, content: string) {
	setState(
		"notes",
		note => note.id === id,
		produce(note => {
			note.title = title;
			note.content = content;
			note.modifiedAt = new Date();
		})
	);
}

export function archiveNote(id: UUID) {
	setState(
		"notes",
		note => note.id === id,
		produce(note => {
			note.archivedAt = new Date();
		})
	);
}

export function archiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setState(
		"notes",
		note => idSet.has(note.id),
		produce(note => {
			note.archivedAt = new Date();
		})
	);
}

export function unarchiveNote(id: UUID) {
	setState(
		"notes",
		note => note.id === id,
		produce(note => {
			note.archivedAt = undefined;
		})
	);
}

export function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setState(
		"notes",
		note => idSet.has(note.id),
		produce(note => {
			note.archivedAt = undefined;
		})
	);
}

export function trashNote(id: UUID) {
	setState(
		"notes",
		note => note.id === id,
		produce(note => {
			const now = new Date();
			note.deletedAt = now;
			note.modifiedAt = now;
		})
	);
}

export function trashMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setState(
		"notes",
		note => idSet.has(note.id),
		produce(note => {
			const now = new Date();
			note.deletedAt = now;
			note.modifiedAt = now;
		})
	);
}

export function restoreFromTrash(id: UUID) {
	setState(
		"notes",
		note => note.id === id,
		produce(note => {
			note.deletedAt = undefined;
			note.modifiedAt = new Date();
		})
	);
}

export function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setState(
		"notes",
		note => idSet.has(note.id),
		produce(note => {
			note.deletedAt = undefined;
			note.modifiedAt = new Date();
		})
	);
}

export function permanentlyDelete(id: UUID) {
	setState("notes", ns => ns.filter(note => note.id !== id));
}

export function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setState("notes", ns => ns.filter(note => !idSet.has(note.id)));
}

export function purgeExpiredTrash(): number {
	const cutoff = Date.now() - TRASH_RETENTION_MS;
	const before = state.notes.length;
	setState("notes", ns => ns.filter(note => !note.deletedAt || note.deletedAt.getTime() >= cutoff));
	return before - state.notes.length;
}

export function replaceAllNotes(newNotes: Note[]) {
	setState("notes", newNotes);
}