import { emptyString, getCharacterCount, getSentenceCount, getSummary, getWordCount } from "@/library";
import type { UUID } from "crypto";

export interface NoteJSON {
	id: string;
	title: string;
	content: string;
	createdAt: string;
	modifiedAt?: string;
	archivedAt?: string;
	deletedAt?: string;
	purgedAt?: string;
	stateChangedAt?: string;
}

export interface Note {
	id: UUID;
	title: string;
	content: string;
	createdAt: Date;
	modifiedAt?: Date;
	archivedAt?: Date;
	deletedAt?: Date;
	purgedAt?: Date;
	stateChangedAt?: Date;
}

export function create(title: string, content: string): Note {
	return {
		id: crypto.randomUUID() as UUID,
		title,
		content,
		createdAt: new Date()
	};
}

export function toJSON(note: Note): NoteJSON {
	return {
		id: note.id,
		title: note.title,
		content: note.content,
		createdAt: note.createdAt.toISOString(),
		modifiedAt: note.modifiedAt?.toISOString(),
		archivedAt: note.archivedAt?.toISOString(),
		deletedAt: note.deletedAt?.toISOString(),
		purgedAt: note.purgedAt?.toISOString(),
		stateChangedAt: note.stateChangedAt?.toISOString()
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
		deletedAt: data.deletedAt ? new Date(data.deletedAt) : undefined,
		purgedAt: data.purgedAt ? new Date(data.purgedAt) : undefined,
		stateChangedAt: data.stateChangedAt ? new Date(data.stateChangedAt) : undefined
	};
}

export const summary = (note: Note): string => getSummary(note.content);

export const sentenceCount = (note: Note): number => getSentenceCount(note.content);

export const wordCount = (note: Note): number => getWordCount(note.content);

export const characterCount = (note: Note): number => getCharacterCount(note.content);