import { createMemo, createSignal } from "solid-js";
import { createStore, produce, unwrap } from "solid-js/store";
import { emptyString } from "@/constants/common";
import { TRASH_RETENTION_MS } from "@/constants/notes";
import { mergeArrays } from "@/utils/common";
import { contains } from "@/utils/text-analysis";
import { applyTags, archive, fave, pin, clearTags, restore, trash, unarchive, unfave, unpin, update, type Note } from "@/models/Note";
import { notesRepository } from "@/storage/NotesRepository";
import { tagsRepository } from "@/storage/TagsRepository";
import type { UUID } from "crypto";

interface NotesState {
	notes: Note[];
	tags: string[];
	searchText: string;
	searchTags: Set<string>;
	isLoading: boolean;
	isSearching: boolean;
}

let hydrated = false;
const [store, setStore] = createStore<NotesState>({
	notes: [],
	tags: [],
	searchText: emptyString,
	searchTags: new Set<string>(),
	isLoading: true,
	isSearching: false
});
const [contentMatchedIds, setContentMatchedIds] = createSignal<Set<UUID> | null>(null);
export const notes = () => store.notes;
export const tags = () => store.tags;
export const searchText = createMemo(() => store.searchText);
export const searchTags = createMemo(() => store.searchTags);
export const isLoading = createMemo(() => store.isLoading);
export const isSearching = createMemo(() => store.isSearching);
export const searchResults = createMemo(() => {
	const trimmed = store.searchText.trim();
	const initial = trimmed ? store.notes.filter(note => contains(note.title, trimmed) || contentMatchedIds()?.has(note.id)) : store.notes;
	if (store.searchTags.size === 0) {
		return initial;
	}
	return initial.filter(note => note.tags?.some(tag => store.searchTags.has(tag)));
});
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
		setStore(
			"tags",
			mergeArrays(
				store.notes
					.map(note => note.tags)
					.filter(Boolean)
					.flat() as string[],
				await tagsRepository.loadAll()
			)
		);
	} catch (err) {
		setStore("notes", []);
		console.error("Failed to load notes from storage", err);
	} finally {
		setStore("isLoading", false);
	}
}

export function setSearchText(query: string) {
	const trimmed = query.trim();
	setStore("searchText", trimmed);
	if (!trimmed) {
		setStore("isSearching", false);
		setContentMatchedIds(null);
		return;
	}
	setStore("isSearching", true);
	notesRepository
		.search(content => contains(content, trimmed))
		.then(matches => {
			setContentMatchedIds(matches as Set<UUID>);
		})
		.finally(() => {
			setStore("isSearching", false);
		});
}

export function addSearchTag(tag: string) {
	setStore("searchTags", tags => new Set(Array.from(tags).concat(tag)));
}

export function setSearchTags(tags: string[]) {
	setStore("searchTags", new Set(tags));
}

export async function addNote(note: Note) {
	setStore("notes", items => items.concat(note));
	setStore("tags", mergeArrays(store.tags, note.tags));
	await notesRepository.saveFull(unwrap(note));
}

export function updateNote(id: UUID, title: string, content: string) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			update(note, title, content);
			setStore("tags", mergeArrays(store.tags, note.tags));
			await notesRepository.saveFull(unwrap(note));
		})
	);
}

export function getNote(id: UUID): Note | undefined {
	return store.notes.find(note => note.id === id);
}

export function getNoteContent(id: UUID): Promise<string | undefined> {
	return notesRepository.loadContent(id);
}

async function applyToNote(id: UUID, mutator: (note: Note) => void) {
	setStore(
		"notes",
		note => note.id === id,
		produce(async note => {
			mutator(note);
			await notesRepository.saveMeta(unwrap(note));
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
			await notesRepository.saveManyMeta(unwrap(targetNotes));
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

export async function addTags(id: UUID, tags: string[]) {
	await applyToNote(id, note => applyTags(note, tags));
	setStore("tags", mergeArrays(store.tags, tags));
}

export async function addTagsMultiple(ids: ReadonlyArray<UUID>, tags: string[]) {
	await applyToMany(ids, note => applyTags(note, tags));
	setStore("tags", mergeArrays(store.tags, tags));
}

export async function removeTags(id: UUID, tags: string[]) {
	await applyToNote(id, note => clearTags(note, tags));
}

export async function removeTagsMultiple(ids: ReadonlyArray<UUID>, tags: string[]) {
	await applyToMany(ids, note => clearTags(note, tags));
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

function addOrUpdate(updatedNote: Note) {
	const index = store.notes.findIndex(note => note.id === updatedNote.id);
	if (index === -1) {
		setStore("notes", items => items.concat(updatedNote));
	} else {
		setStore("notes", index, updatedNote);
	}
	setStore("tags", mergeArrays(store.tags, updatedNote.tags));
}

export async function replaceNote(updatedNote: Note) {
	addOrUpdate(updatedNote);
	await notesRepository.saveFull(unwrap(updatedNote));
}

export async function replaceMultiple(updatedNotes: Note[]) {
	updatedNotes.forEach(addOrUpdate);
	await notesRepository.saveManyFull(unwrap(updatedNotes));
}

export async function createTag(tag: string) {
	if (!store.tags.includes(tag)) {
		setStore("tags", tags => tags.concat(tag));
	}
	await tagsRepository.save(tag);
}

export async function createTags(tags: string[]) {
	setStore("tags", mergeArrays(store.tags, tags));
	await tagsRepository.saveMany(tags);
}

export async function deleteTags(tags: string[]) {
	const tagSet = new Set(tags);
	const affectedIds = store.notes.reduce((ids, note) => {
		if (note.tags?.some(tag => tagSet.has(tag))) {
			ids.push(note.id);
		}
		return ids;
	}, [] as UUID[]);
	await applyToMany(affectedIds, note => clearTags(note, tags));
	setStore("tags", tags => tags.filter(tag => !tagSet.has(tag)));
	await Promise.all(tags.map(tag => tagsRepository.remove(tag)));
	return affectedIds.length;
}