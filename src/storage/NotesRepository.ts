import * as db from "./db";
import { fromJSON, toJSON, toMetaJSON, type Note } from "@/models/Note";
import type { UUID } from "crypto";

class NotesRepository {
	async loadAll(): Promise<Note[]> {
		const raw = await db.getAllNotes();
		return raw.map(fromJSON);
	}

	loadContent(id: UUID): Promise<string | undefined> {
		return db.getNoteContent(id);
	}

	search(predicate: (content: string) => boolean): Promise<Set<string>> {
		return db.searchContents(predicate);
	}

	async saveFull(note: Note): Promise<void> {
		await db.putNote(toJSON(note));
		note.content = undefined;
	}

	async saveManyFull(notes: Note[]): Promise<void> {
		await db.putNotes(notes.map(toJSON));
		notes.forEach(note => (note.content = undefined));
	}

	saveMeta(note: Note): Promise<void> {
		return db.putNoteMeta(toMetaJSON(note));
	}

	saveManyMeta(notes: Note[]): Promise<void> {
		return db.putNotesMeta(notes.map(toMetaJSON));
	}

	remove(id: UUID): Promise<void> {
		return db.deleteNote(id);
	}

	removeMany(ids: UUID[]): Promise<void> {
		return db.deleteNotes(ids);
	}
}

export const notesRepository = new NotesRepository();