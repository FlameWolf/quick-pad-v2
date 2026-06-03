import { createStore, produce } from "solid-js/store";
import { createMemo, createSignal } from "solid-js";
import { archive, fromJSON, restore, toJSON, trash, unarchive, update, type Note } from "@/models/Note";
import { deleteNote, deleteNotes, getAllNotes, putNote, putNotes } from "@/storage/db";
import { contains, emptyString, TRASH_RETENTION_MS } from "@/library";
import type { UUID } from "crypto";

interface NotesState {
	notes: Note[];
	searchText: string;
}

let flushScheduled = false;
const pendingNotes = new Set<Note>();
const persistNote = async (note: Note) => {
	await putNote(toJSON(note));
};
const persistNotes = async (notes: Note[]) => {
	await putNotes(notes.map(toJSON));
};
const removeNote = async (id: UUID) => {
	await deleteNote(id);
};
const removeNotes = async (ids: UUID[]) => {
	await deleteNotes(ids);
};
const flushPending = async () => {
	const toFlush = Array.from(pendingNotes);
	if (toFlush.length > 0) {
		await persistNotes(toFlush);
	}
	pendingNotes.clear();
	flushScheduled = false;
};
const schedulePersist = (note: Note) => {
	pendingNotes.add(note);
	if (!flushScheduled) {
		queueMicrotask(flushPending);
		flushScheduled = true;
	}
};
const [store, setStore] = createStore<NotesState>({
	notes: [],
	searchText: emptyString
});
export const [isLoading, setIsLoading] = createSignal(true);
export const notes = () => store.notes;
export const searchText = () => store.searchText;
export const setSearchText = (value: string) => setStore("searchText", value);
const searchResults = createMemo(() => (store.searchText.trim() ? store.notes.filter(note => contains(note.title, store.searchText) || contains(note.content, store.searchText)) : store.notes));
export const activeNotes = createMemo(() => searchResults().filter(note => !note.archivedAt && !note.deletedAt));
export const archivedNotes = createMemo(() => searchResults().filter(note => note.archivedAt && !note.deletedAt));
export const trashedNotes = createMemo(() => searchResults().filter(note => note.deletedAt));

export async function hydrateNotes(): Promise<void> {
	try {
		const raw = await getAllNotes();
		setStore("notes", raw.map(fromJSON));
	} catch {
		setStore("notes", []);
	} finally {
		setIsLoading(false);
	}
}

export function getNote(id: UUID): Note | undefined {
	return store.notes.find(note => note.id === id);
}

export async function addNote(note: Note) {
	setStore("notes", items => items.concat([note]));
	await persistNote(note);
}

export function updateNote(id: UUID, title: string, content: string) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			update(note, title, content);
			await persistNote(note);
		})
	);
}

export function archiveNote(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			archive(note);
			await persistNote(note);
		})
	);
}

export function archiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore(
		"notes",
		produce(async notes => {
			const toArchive = notes.filter(note => idSet.has(note.id));
			toArchive.forEach(archive);
			await persistNotes(toArchive);
		})
	);
}

export function unarchiveNote(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			unarchive(note);
			await persistNote(note);
		})
	);
}

export function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore(
		"notes",
		produce(async notes => {
			const toUnarchive = notes.filter(note => idSet.has(note.id));
			toUnarchive.forEach(unarchive);
			await persistNotes(toUnarchive);
		})
	);
}

export function trashNote(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			trash(note);
			await persistNote(note);
		})
	);
}

export function trashMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore(
		"notes",
		produce(async notes => {
			const toTrash = notes.filter(note => idSet.has(note.id));
			toTrash.forEach(trash);
			await persistNotes(toTrash);
		})
	);
}

export function restoreFromTrash(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			restore(note);
			await persistNote(note);
		})
	);
}

export function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore(
		"notes",
		produce(async notes => {
			const toRestore = notes.filter(note => idSet.has(note.id));
			toRestore.forEach(restore);
			await persistNotes(toRestore);
		})
	);
}

export async function permanentlyDelete(id: UUID) {
	const index = store.notes.findIndex(note => note.id === id);
	if (index === -1) {
		return;
	}
	setStore("notes", items => items.toSpliced(index, 1));
	await removeNote(id);
}

export async function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore("notes", items => items.filter(note => !idSet.has(note.id)));
	await removeNotes(ids as UUID[]);
}

export async function purgeExpiredTrash() {
	const cutoff = Date.now() - TRASH_RETENTION_MS;
	const expiredIds = store.notes
		.filter(note => {
			if (!note.deletedAt) {
				return false;
			}
			const tombstoneTime = note.deletedAt.getTime();
			return tombstoneTime > 0 && tombstoneTime < cutoff;
		})
		.map(expired => expired.id);
	if (expiredIds.length > 0) {
		const expiredSet = new Set<UUID>(expiredIds);
		setStore("notes", ns => ns.filter(note => !expiredSet.has(note.id)));
		await removeNotes(Array.from(expiredSet));
	}
	return expiredIds;
}

export async function replaceNote(updatedNote: Note) {
	const index = store.notes.findIndex(note => note.id === updatedNote.id);
	switch (index) {
		case -1:
			addNote(updatedNote);
			break;
		default:
			setStore("notes", index, updatedNote);
			await persistNote(updatedNote);
			break;
	}
}

export async function replaceMultiple(updatedNotes: Note[]) {
	if (updatedNotes.length === 0) {
		return;
	}
	await Promise.all(updatedNotes.map(replaceNote));
}