import { createStore, produce } from "solid-js/store";
import { createEffect, createMemo, createSignal, on } from "solid-js";
import { archive, restore, trash, unarchive, update, type Note } from "@/models/Note";
import { notesRepository } from "@/storage/NotesRepository";
import { emptyString } from "@/constants/common";
import { TRASH_RETENTION_MS } from "@/constants/notes";
import { contains } from "@/utils/text-analysis";
import type { UUID } from "crypto";

interface NotesState {
	notes: Note[];
	searchText: string;
}

const [store, setStore] = createStore<NotesState>({
	notes: [],
	searchText: emptyString
});
export const [isLoading, setIsLoading] = createSignal(true);
export const [isSearching, setIsSearching] = createSignal(false);
export const [contentMatchedIds, setContentMatchedIds] = createSignal<Set<UUID> | null>(null);
export const notes = () => store.notes;
export const searchText = () => store.searchText;
export const setSearchText = (value: string) => setStore("searchText", value);
const searchResults = createMemo(() => {
	const trimmed = store.searchText.trim();
	if (!trimmed) {
		return store.notes;
	}
	return store.notes.filter(note => contains(note.title, trimmed) || contentMatchedIds()?.has(note.id));
});
export const activeNotes = createMemo(() => searchResults().filter(note => !note.archivedAt && !note.deletedAt));
export const archivedNotes = createMemo(() => searchResults().filter(note => note.archivedAt && !note.deletedAt));
export const trashedNotes = createMemo(() => searchResults().filter(note => note.deletedAt));

createEffect(
	on(
		() => store.searchText,
		async text => {
			const trimmed = text.trim();
			setContentMatchedIds(null);
			if (!trimmed) {
				setIsSearching(false);
				return;
			}
			setIsSearching(true);
			const matches = await notesRepository.search(content => contains(content, trimmed));
			if (searchText().trim() === trimmed) {
				setContentMatchedIds(matches as Set<UUID>);
				setIsSearching(false);
			}
		}
	)
);

export async function hydrateNotes(): Promise<void> {
	try {
		setStore("notes", await notesRepository.loadAll());
	} catch (err) {
		setStore("notes", []);
		console.error("Failed to load notes from storage", err);
	} finally {
		setIsLoading(false);
	}
}

export function getNote(id: UUID): Note | undefined {
	return store.notes.find(note => note.id === id);
}

export function getNoteContent(id: UUID): Promise<string | undefined> {
	return notesRepository.loadContent(id);
}

export async function addNote(note: Note) {
	await notesRepository.saveFull(note);
	setStore("notes", items => items.concat([note]));
}

export function updateNote(id: UUID, title: string, content: string) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			await notesRepository.saveFull(note);
			update(note, title, content);
		})
	);
}

export function archiveNote(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			archive(note);
			await notesRepository.saveMeta(note);
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
			await notesRepository.saveManyMeta(toArchive);
		})
	);
}

export function unarchiveNote(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			unarchive(note);
			await notesRepository.saveMeta(note);
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
			await notesRepository.saveManyMeta(toUnarchive);
		})
	);
}

export function trashNote(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			trash(note);
			await notesRepository.saveMeta(note);
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
			await notesRepository.saveManyMeta(toTrash);
		})
	);
}

export function restoreFromTrash(id: UUID) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			restore(note);
			await notesRepository.saveMeta(note);
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
			await notesRepository.saveManyMeta(toRestore);
		})
	);
}

export async function permanentlyDelete(id: UUID) {
	const index = store.notes.findIndex(note => note.id === id);
	if (index === -1) {
		return;
	}
	setStore("notes", items => items.toSpliced(index, 1));
	await notesRepository.remove(id);
}

export async function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	setStore("notes", items => items.filter(note => !idSet.has(note.id)));
	await notesRepository.removeMany(ids as UUID[]);
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
		await notesRepository.removeMany(expiredIds);
	}
	return expiredIds;
}

function addOrUpdate(note: Note) {
	const index = store.notes.findIndex(n => n.id === note.id);
	if (index === -1) {
		setStore("notes", items => items.concat([note]));
	} else {
		setStore("notes", index, note);
	}
}

export async function replaceNote(updatedNote: Note) {
	await notesRepository.saveFull(updatedNote);
	addOrUpdate(updatedNote);
}

export async function replaceMultiple(updatedNotes: Note[]) {
	await notesRepository.saveManyFull(updatedNotes);
	updatedNotes.forEach(addOrUpdate);
}