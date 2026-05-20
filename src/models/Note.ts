import { getCharacterCount, getSentenceCount, getSummary, getWordCount } from "@/library";
import type { UUID } from "crypto";

export interface NoteJSON {
	id: string;
	title: string;
	content: string;
	createdAt: string;
	modifiedAt?: string;
	archivedAt?: string;
	deletedAt?: string;
}

export interface Note {
	id: UUID;
	title: string;
	content: string;
	createdAt: Date;
	modifiedAt?: Date;
	archivedAt?: Date;
	deletedAt?: Date;
}

export function createNote(title: string, content: string): Note {
	return {
		id: crypto.randomUUID() as UUID,
		title,
		content,
		createdAt: new Date()
	};
}

export function updateNoteValue(note: Note, title: string, content: string): Note {
	return { ...note, title, content, modifiedAt: new Date() };
}

export function archiveNoteValue(note: Note): Note {
	return { ...note, archivedAt: new Date() };
}

export function unarchiveNoteValue(note: Note): Note {
	return { ...note, archivedAt: undefined };
}

export function trashNoteValue(note: Note): Note {
	const now = new Date();
	return { ...note, deletedAt: now, modifiedAt: now };
}

export function restoreNoteValue(note: Note): Note {
	return { ...note, deletedAt: undefined, modifiedAt: new Date() };
}

export function toJSON(note: Note): NoteJSON {
	return {
		id: note.id,
		title: note.title,
		content: note.content,
		createdAt: note.createdAt.toISOString(),
		modifiedAt: note.modifiedAt?.toISOString(),
		archivedAt: note.archivedAt?.toISOString(),
		deletedAt: note.deletedAt?.toISOString()
	};
}

export function fromJSON(data: NoteJSON): Note {
	return {
		id: data.id as UUID,
		title: data.title,
		content: data.content,
		createdAt: new Date(data.createdAt),
		modifiedAt: data.modifiedAt ? new Date(data.modifiedAt) : undefined,
		archivedAt: data.archivedAt ? new Date(data.archivedAt) : undefined,
		deletedAt: data.deletedAt ? new Date(data.deletedAt) : undefined
	};
}

export const noteSummary = (note: Note): string => getSummary(note.content);

export const noteSentenceCount = (note: Note): number => getSentenceCount(note.content);

export const noteWordCount = (note: Note): number => getWordCount(note.content);

export const noteCharacterCount = (note: Note): number => getCharacterCount(note.content);