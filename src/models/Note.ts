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
	summary?: string;
	sentenceCount?: number;
	wordCount?: number;
	characterCount?: number;
}

function computeDerived(note: Note): void {
	note.summary = getSummary(note.content);
	note.sentenceCount = getSentenceCount(note.content);
	note.wordCount = getWordCount(note.content);
	note.characterCount = getCharacterCount(note.content);
}

export function create(title: string, content: string): Note {
	const note: Note = {
		id: crypto.randomUUID() as UUID,
		title,
		content,
		createdAt: new Date(),
		modifiedAt: undefined,
		archivedAt: undefined,
		deletedAt: undefined,
		purgedAt: undefined,
		stateChangedAt: undefined
	};
	computeDerived(note);
	return note;
}

export function update(note: Note, title: string, content: string): void {
	note.title = title;
	note.content = content;
	note.modifiedAt = new Date();
	computeDerived(note);
}

export function archive(note: Note): void {
	const now = new Date();
	note.archivedAt = now;
	note.stateChangedAt = now;
}

export function unarchive(note: Note): void {
	note.archivedAt = undefined;
	note.stateChangedAt = new Date();
}

export function trash(note: Note): void {
	const now = new Date();
	note.deletedAt = now;
	note.stateChangedAt = now;
}

export function restore(note: Note): void {
	note.deletedAt = undefined;
	note.stateChangedAt = new Date();
}

export function purge(note: Note): void {
	const now = new Date();
	note.purgedAt = now;
	note.stateChangedAt = now;
	note.title = emptyString;
	note.content = emptyString;
	computeDerived(note);
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
	const note = {
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
	computeDerived(note);
	return note;
}