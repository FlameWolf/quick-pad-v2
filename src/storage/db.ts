import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, NOTES_STORE, KV_STORE } from "@/library";
import type { NoteJSON } from "@/models/Note";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(NOTES_STORE)) {
					db.createObjectStore(NOTES_STORE, { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains(KV_STORE)) {
					db.createObjectStore(KV_STORE);
				}
			}
		});
	}
	return dbPromise;
}

export async function getAllNotes(): Promise<NoteJSON[]> {
	const db = await getDB();
	return (await db.getAll(NOTES_STORE)) as NoteJSON[];
}

export async function putNote(note: NoteJSON): Promise<void> {
	const db = await getDB();
	await db.put(NOTES_STORE, note);
}

export async function putNotes(notes: NoteJSON[]): Promise<void> {
	if (notes.length === 0) {
		return;
	}
	const db = await getDB();
	const tx = db.transaction(NOTES_STORE, "readwrite");
	await Promise.all(notes.map(note => tx.store.put(note)).concat(tx.done as Promise<any>));
}

export async function deleteNote(id: string): Promise<void> {
	const db = await getDB();
	await db.delete(NOTES_STORE, id);
}

export async function deleteNotes(ids: string[]): Promise<void> {
	if (ids.length === 0) {
		return;
	}
	const db = await getDB();
	const tx = db.transaction(NOTES_STORE, "readwrite");
	await Promise.all(ids.map(id => tx.store.delete(id)).concat(tx.done));
}

export async function getKV<T>(key: string): Promise<T | undefined> {
	const db = await getDB();
	return (await db.get(KV_STORE, key)) as T | undefined;
}

export async function setKV<T>(key: string, value: T): Promise<void> {
	const db = await getDB();
	await db.put(KV_STORE, value as unknown, key);
}

export async function deleteKV(key: string): Promise<void> {
	const db = await getDB();
	await db.delete(KV_STORE, key);
}