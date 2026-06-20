import * as db from "./db";
import { fromJSON, toJSON, toMetaJSON, type Note } from "@/models/Note";
import type { UUID } from "crypto";

class NotesRepository {
	async loadAll(): Promise<Note[]> {
		return (await db.getAllNotes()).map(fromJSON);
	}

	async loadContent(id: UUID): Promise<string | undefined> {
		return await db.getNoteContent(id);
	}

	async search(predicate: (content: string) => boolean): Promise<Set<string>> {
		return await db.searchContents(predicate);
	}

	async saveFull(note: Note): Promise<void> {
		await db.putNote(toJSON(note));
		note.content = undefined;
	}

	async saveManyFull(notes: Note[]): Promise<void> {
		await db.putNotes(notes.map(toJSON));
		notes.forEach(note => (note.content = undefined));
	}

	async saveMeta(note: Note): Promise<void> {
		return await db.putNoteMeta(toMetaJSON(note));
	}

	async saveManyMeta(notes: Note[]): Promise<void> {
		return await db.putNotesMeta(notes.map(toMetaJSON));
	}

	async remove(id: UUID): Promise<void> {
		return await db.deleteNote(id);
	}

	async removeMany(ids: UUID[]): Promise<void> {
		return await db.deleteNotes(ids);
	}
}

export const notesRepository = new NotesRepository();