import { createStore, produce } from "solid-js/store";
import { createEffect, createMemo, createSignal, on } from "solid-js";
import { archive, fave, pin, restore, trash, unarchive, unfave, unpin, update, type Note } from "@/models/Note";
import { notesRepository } from "@/storage/NotesRepository";
import { emptyString } from "@/constants/common";
import { TRASH_RETENTION_MS } from "@/constants/notes";
import { contains } from "@/utils/text-analysis";
import type { UUID } from "crypto";

interface NotesState {
	notes: Note[];
	searchText: string;
}

let hydrated = false;
const [store, setStore] = createStore<NotesState>({
	notes: [],
	searchText: emptyString
});
const searchResults = createMemo(() => {
	const trimmed = store.searchText.trim();
	if (!trimmed) {
		return store.notes;
	}
	return store.notes.filter(note => contains(note.title, trimmed) || contentMatchedIds()?.has(note.id));
});
export const notes = () => store.notes;
export const searchText = () => store.searchText;
export const [isLoading, setIsLoading] = createSignal(true);
export const [isSearching, setIsSearching] = createSignal(false);
export const [contentMatchedIds, setContentMatchedIds] = createSignal<Set<UUID> | null>(null);
export const setSearchText = (value: string) => setStore("searchText", value);
export const activeNotes = createMemo(() => searchResults().filter(note => !note.archivedAt && !note.deletedAt));
export const favedNotes = createMemo(() => searchResults().filter(note => note.favedAt && !note.deletedAt));
export const archivedNotes = createMemo(() => searchResults().filter(note => note.archivedAt && !note.deletedAt));
export const trashedNotes = createMemo(() => searchResults().filter(note => note.deletedAt));

export async function hydrateNotes(): Promise<void> {
	if (hydrated) {
		return;
	}
	hydrated = true;
	try {
		setStore("notes", await notesRepository.loadAll());
	} catch (err) {
		setStore("notes", []);
		console.error("Failed to load notes from storage", err);
	} finally {
		setIsLoading(false);
	}
	createEffect(
		on(
			() => store.searchText,
			async query => {
				const trimmed = query.trim();
				setContentMatchedIds(null);
				if (!trimmed) {
					setIsSearching(false);
					return;
				}
				setIsSearching(true);
				const matches = await notesRepository.search(content => contains(content, trimmed));
				if (store.searchText.trim() === trimmed) {
					setContentMatchedIds(matches as Set<UUID>);
					setIsSearching(false);
				}
			}
		)
	);
}

export function getNote(id: UUID): Note | undefined {
	return store.notes.find(note => note.id === id);
}

export function getNoteContent(id: UUID): Promise<string | undefined> {
	return notesRepository.loadContent(id);
}

export async function addNote(note: Note) {
	setStore("notes", items => items.concat(note));
	await notesRepository.saveFull(note);
}

export function updateNote(id: UUID, title: string, content: string) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			update(note, title, content);
			await notesRepository.saveFull(note);
		})
	);
}

async function applyToNote(id: UUID, mutator: (note: Note) => void) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			mutator(note);
			await notesRepository.saveMeta(note);
		})
	);
}

async function applyToMany(ids: ReadonlyArray<UUID>, mutator: (note: Note) => void) {
	const idSet = new Set<UUID>(ids);
	setStore(
		"notes",
		produce(async notes => {
			const targetNotes = notes.filter(note => idSet.has(note.id));
			targetNotes.forEach(mutator);
			await notesRepository.saveManyMeta(targetNotes);
		})
	);
}

export function faveNote(id: UUID) {
	applyToNote(id, fave);
}

export function faveMultiple(ids: ReadonlyArray<UUID>) {
	applyToMany(ids, fave);
}

export function unfaveNote(id: UUID) {
	applyToNote(id, unfave);
}

export function unfaveMultiple(ids: ReadonlyArray<UUID>) {
	applyToMany(ids, unfave);
}

export function pinNote(id: UUID) {
	applyToNote(id, pin);
}

export function unpinNote(id: UUID) {
	applyToNote(id, unpin);
}

export function archiveNote(id: UUID) {
	applyToNote(id, archive);
}

export function archiveMultiple(ids: ReadonlyArray<UUID>) {
	applyToMany(ids, archive);
}

export function unarchiveNote(id: UUID) {
	applyToNote(id, unarchive);
}

export function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
	applyToMany(ids, unarchive);
}

export function trashNote(id: UUID) {
	applyToNote(id, trash);
}

export function trashMultiple(ids: ReadonlyArray<UUID>) {
	applyToMany(ids, trash);
}

export function restoreFromTrash(id: UUID) {
	applyToNote(id, restore);
}

export function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
	applyToMany(ids, restore);
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
		await permanentlyDeleteMultiple(expiredIds);
	}
	return expiredIds;
}

function addOrUpdate(note: Note) {
	const index = store.notes.findIndex(n => n.id === note.id);
	if (index === -1) {
		setStore("notes", items => items.concat(note));
	} else {
		setStore("notes", index, note);
	}
}

export async function replaceNote(updatedNote: Note) {
	addOrUpdate(updatedNote);
	await notesRepository.saveFull(updatedNote);
}

export async function replaceMultiple(updatedNotes: Note[]) {
	updatedNotes.forEach(addOrUpdate);
	await notesRepository.saveManyFull(updatedNotes);
}