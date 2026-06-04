import { emptyString, getCharacterCount, getSentenceCount, getSummary, getWordCount } from "@/library";
import type { UUID } from "crypto";

export interface NoteMetaJSON {
	id: string;
	title: string;
	createdAt: string;
	modifiedAt?: string;
	archivedAt?: string;
	deletedAt?: string;
	stateChangedAt?: string;
	summary?: string;
	sentenceCount?: number;
	wordCount?: number;
	characterCount?: number;
}

export interface NoteJSON extends NoteMetaJSON {
	content?: string;
}

export interface Note {
	id: UUID;
	title: string;
	content?: string;
	createdAt: Date;
	modifiedAt?: Date;
	archivedAt?: Date;
	deletedAt?: Date;
	stateChangedAt?: Date;
	summary?: string;
	sentenceCount?: number;
	wordCount?: number;
	characterCount?: number;
}

function computeDerived(note: Note) {
	const content = note.content ?? emptyString;
	Object.assign(note, {
		summary: getSummary(content),
		sentenceCount: getSentenceCount(content),
		wordCount: getWordCount(content),
		characterCount: getCharacterCount(content)
	});
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
		stateChangedAt: undefined
	};
	if (content !== undefined) {
		computeDerived(note);
	}
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

export function toMetaJSON(note: Note): NoteMetaJSON {
	return {
		id: note.id,
		title: note.title,
		createdAt: note.createdAt.toISOString(),
		modifiedAt: note.modifiedAt?.toISOString(),
		archivedAt: note.archivedAt?.toISOString(),
		deletedAt: note.deletedAt?.toISOString(),
		stateChangedAt: note.stateChangedAt?.toISOString(),
		summary: note.summary,
		sentenceCount: note.sentenceCount,
		wordCount: note.wordCount,
		characterCount: note.characterCount
	};
}

export function toJSON(note: Note): NoteJSON {
	return Object.assign(toMetaJSON(note), {
		content: note.content
	});
}

export function fromJSON(data: NoteJSON): Note {
	const note: Note = {
		id: data.id as UUID,
		title: data.title,
		content: data.content,
		createdAt: new Date(data.createdAt),
		modifiedAt: data.modifiedAt ? new Date(data.modifiedAt) : undefined,
		archivedAt: data.archivedAt ? new Date(data.archivedAt) : undefined,
		deletedAt: data.deletedAt ? new Date(data.deletedAt) : undefined,
		stateChangedAt: data.stateChangedAt ? new Date(data.stateChangedAt) : undefined
	};
	if (data.summary !== undefined && data.sentenceCount !== undefined && data.wordCount !== undefined && data.characterCount !== undefined) {
		note.summary = data.summary;
		note.sentenceCount = data.sentenceCount;
		note.wordCount = data.wordCount;
		note.characterCount = data.characterCount;
	} else {
		computeDerived(note);
	}
	return note;
}