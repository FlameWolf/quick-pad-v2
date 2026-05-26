import { createStore, produce } from "solid-js/store";
import { createMemo, createEffect, on, mapArray, createSignal } from "solid-js";
import { archive, fromJSON, purge, restore, toJSON, trash, unarchive, update, type Note } from "@/models/Note";
import { noteEffectiveTime } from "@/composables/useNotesSync";
import { contains, emptyString, LEGACY_STORAGE_KEY, STORAGE_KEY } from "@/library";
import type { UUID } from "crypto";

interface NotesState {
	notes: Note[];
	searchText: string;
}

const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const [isLoading, setIsLoading] = createSignal(true);
const noteKey = (id: UUID) => `${STORAGE_KEY}${id}`;
const migrateFromLegacy = () => {
	const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (!raw) {
		return [];
	}
	try {
		return JSON.parse(raw).map(fromJSON);
	} catch {
		return [];
	} finally {
		localStorage.removeItem(LEGACY_STORAGE_KEY);
	}
};
const loadFromStorage = () => {
	const storedNotes: Note[] = migrateFromLegacy();
	for (let index = 0; index < localStorage.length; index++) {
		const key = localStorage.key(index);
		if (!key?.startsWith(STORAGE_KEY)) {
			continue;
		}
		try {
			storedNotes.push(fromJSON(JSON.parse(localStorage.getItem(key) as string)));
		} catch {
			void 0;
		}
	}
	setIsLoading(false);
	return storedNotes;
};
const persistNote = (note: Note) => {
	if (note.purgedAt) {
		removeNote(note.id);
		return;
	}
	localStorage.setItem(noteKey(note.id), JSON.stringify(toJSON(note)));
};
const removeNote = (id: UUID) => {
	localStorage.removeItem(noteKey(id));
};
const [store, setStore] = createStore<NotesState>({
	notes: loadFromStorage(),
	searchText: emptyString
});
createEffect(
	mapArray(
		() => store.notes,
		note => {
			createEffect(
				on(
					() => noteEffectiveTime(note),
					() => persistNote(note),
					{
						defer: true
					}
				)
			);
		}
	)
);
export const notes = () => store.notes;
export const searchText = () => store.searchText;
export const setSearchText = (value: string) => setStore("searchText", value);
const searchResults = createMemo(() => (store.searchText.trim() ? store.notes.filter(note => contains(note.title, store.searchText) || contains(note.content, store.searchText)) : store.notes));
export const activeNotes = createMemo(() => searchResults().filter(note => !note.archivedAt && !note.deletedAt && !note.purgedAt));
export const archivedNotes = createMemo(() => searchResults().filter(note => note.archivedAt && !note.deletedAt && !note.purgedAt));
export const trashedNotes = createMemo(() => searchResults().filter(note => note.deletedAt && !note.purgedAt));

export function getNote(id: UUID): Note | undefined {
	return store.notes.find(note => note.id === id);
}

export function addNote(note: Note) {
	setStore("notes", items => items.concat([note]));
	persistNote(note);
}

export function updateNote(id: UUID, title: string, content: string) {
	setStore(
		"notes",
		note => note.id === id,
		produce(note => update(note, title, content))
	);
}

export function archiveNote(id: UUID) {
	setStore("notes", note => note.id === id, produce(archive));
}

export function archiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore("notes", note => idSet.has(note.id), produce(archive));
}

export function unarchiveNote(id: UUID) {
	setStore("notes", note => note.id === id, produce(unarchive));
}

export function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore("notes", note => idSet.has(note.id), produce(unarchive));
}

export function trashNote(id: UUID) {
	setStore("notes", note => note.id === id, produce(trash));
}

export function trashMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore("notes", note => idSet.has(note.id), produce(trash));
}

export function restoreFromTrash(id: UUID) {
	setStore("notes", note => note.id === id, produce(restore));
}

export function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore("notes", note => idSet.has(note.id), produce(restore));
}

export function permanentlyDelete(id: UUID) {
	const index = store.notes.findIndex(note => note.id === id);
	if (index === -1) {
		return;
	}
	purge(store.notes[index] as Note);
	setStore("notes", items => items.toSpliced(index, 1));
	removeNote(id);
}

export function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	store.notes.filter(note => idSet.has(note.id)).forEach(purge);
	setStore("notes", items => items.filter(note => !idSet.has(note.id)));
	idSet.forEach(removeNote);
}

export function purgeExpiredTrash() {
	const cutoff = Date.now() - TRASH_RETENTION_MS;
	const expiredIds = store.notes
		.filter(note => {
			if (!note.deletedAt) {
				return false;
			}
			if (note.purgedAt) {
				return true;
			}
			const tombstoneTime = note.deletedAt.getTime();
			return tombstoneTime > 0 && tombstoneTime < cutoff;
		})
		.map(expired => expired.id);
	if (expiredIds.length > 0) {
		const expiredSet = new Set<UUID>(expiredIds);
		setStore("notes", ns => ns.filter(note => !expiredSet.has(note.id)));
		expiredSet.forEach(removeNote);
	}
	return expiredIds;
}

export function replaceNote(updatedNote: Note) {
	const index = store.notes.findIndex(note => note.id === updatedNote.id);
	switch (index) {
		case -1:
			addNote(updatedNote);
			break;
		default:
			setStore("notes", index, updatedNote);
			break;
	}
}

export function replaceMultiple(updatedNotes: Note[]) {
	if (updatedNotes.length === 0) {
		return;
	}
	updatedNotes.forEach(replaceNote);
}

export function replaceAllNotes(newNotes: Note[]) {
	setStore("notes", newNotes);
}