import { createStore, produce } from "solid-js/store";
import { createMemo, createEffect, on } from "solid-js";
import { fromJSON, toJSON, type Note, type NoteJSON } from "@/models/Note";
import { contains, emptyString } from "@/library";
import type { UUID } from "crypto";

interface NotesState {
	notes: Note[];
	searchText: string;
}

let hydrated = false;
const STORAGE_KEY = "quick-pad-notes";
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const loadFromStorage = () => {
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
};
const [store, setStore] = createStore<NotesState>({
	notes: loadFromStorage(),
	searchText: emptyString
});
export const notes = () => store.notes;
export const searchText = () => store.searchText;
export const setSearchText = (value: string) => setStore("searchText", value);
const searchResults = createMemo(() => (store.searchText.trim() ? store.notes.filter(note => contains(note.title, store.searchText) || contains(note.content, store.searchText)) : store.notes));
export const activeNotes = createMemo(() => searchResults().filter(note => !note.archivedAt && !note.deletedAt));
export const archivedNotes = createMemo(() => searchResults().filter(note => note.archivedAt && !note.deletedAt));
export const trashedNotes = createMemo(() => searchResults().filter(note => note.deletedAt));

createEffect(
	on(
		() => store.notes,
		notes => {
			const serialized = JSON.stringify(notes.map(toJSON));
			if (!hydrated) {
				hydrated = true;
				return;
			}
			localStorage.setItem(STORAGE_KEY, serialized);
		},
		{ defer: true }
	)
);

export function getNote(id: UUID): Note | undefined {
	return store.notes.find(note => note.id === id);
}

export function addNote(note: Note) {
	setStore("notes", ns => [...ns, note]);
}

export function updateNote(id: UUID, title: string, content: string) {
	setStore(
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
	setStore(
		"notes",
		note => note.id === id,
		produce(note => {
			note.archivedAt = new Date();
		})
	);
}

export function archiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore(
		"notes",
		note => idSet.has(note.id),
		produce(note => {
			note.archivedAt = new Date();
		})
	);
}

export function unarchiveNote(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(note => {
			note.archivedAt = undefined;
		})
	);
}

export function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore(
		"notes",
		note => idSet.has(note.id),
		produce(note => {
			note.archivedAt = undefined;
		})
	);
}

export function trashNote(id: UUID) {
	setStore(
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
	setStore(
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
	setStore(
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
	setStore(
		"notes",
		note => idSet.has(note.id),
		produce(note => {
			note.deletedAt = undefined;
			note.modifiedAt = new Date();
		})
	);
}

export function permanentlyDelete(id: UUID) {
	setStore("notes", ns => ns.filter(note => note.id !== id));
}

export function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore("notes", ns => ns.filter(note => !idSet.has(note.id)));
}

export function purgeExpiredTrash(): number {
	const cutoff = Date.now() - TRASH_RETENTION_MS;
	const before = store.notes.length;
	setStore("notes", ns => ns.filter(note => !note.deletedAt || note.deletedAt.getTime() >= cutoff));
	return before - store.notes.length;
}

export function replaceNote(updatedNote: Note) {
	setStore("notes", note => note.id === updatedNote.id, updatedNote);
}

export function replaceMultple(updatedNotes: Note[]) {
	if (updatedNotes.length === 0) {
		return;
	}
	setStore(
		"notes",
		produce(notes => {
			updatedNotes.forEach(updated => {
				const index = notes.findIndex(note => note.id === updated.id);
				if (index !== -1) {
					notes[index] = updated;
				}
			});
		})
	);
}

export function replaceAllNotes(newNotes: Note[]) {
	setStore("notes", newNotes);
}