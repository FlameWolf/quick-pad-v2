import { emptyString } from "@/constants/common";
import { getSummary, getSentenceCount, getWordCount, getCharacterCount } from "@/utils/text-analysis";
import { parseValidDate } from "@/utils/dates";
import { isValidCount } from "@/utils/numbers";
import type { UUID } from "crypto";

export interface NoteMetaJSON {
	id: string;
	title: string;
	createdAt: string;
	modifiedAt?: string;
	favedAt?: string;
	pinnedAt?: string;
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
	favedAt?: Date;
	pinnedAt?: Date;
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
		createdAt: new Date()
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

export function fave(note: Note): void {
	if (note.deletedAt) {
		return;
	}
	const now = new Date();
	note.favedAt = now;
	note.stateChangedAt = now;
}

export function unfave(note: Note): void {
	note.favedAt = undefined;
	note.stateChangedAt = new Date();
}

export function pin(note: Note): void {
	if (note.archivedAt || note.deletedAt) {
		return;
	}
	const now = new Date();
	note.pinnedAt = now;
	note.stateChangedAt = now;
}

export function unpin(note: Note): void {
	note.pinnedAt = undefined;
	note.stateChangedAt = new Date();
}

export function archive(note: Note): void {
	const now = new Date();
	note.pinnedAt = undefined;
	note.archivedAt = now;
	note.stateChangedAt = now;
}

export function unarchive(note: Note): void {
	note.archivedAt = undefined;
	note.stateChangedAt = new Date();
}

export function trash(note: Note): void {
	const now = new Date();
	note.pinnedAt = undefined;
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
		favedAt: note.favedAt?.toISOString(),
		pinnedAt: note.pinnedAt?.toISOString(),
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
		createdAt: parseValidDate(data.createdAt) ?? new Date(),
		modifiedAt: parseValidDate(data.modifiedAt),
		favedAt: parseValidDate(data.favedAt),
		pinnedAt: parseValidDate(data.pinnedAt),
		archivedAt: parseValidDate(data.archivedAt),
		deletedAt: parseValidDate(data.deletedAt),
		stateChangedAt: parseValidDate(data.stateChangedAt)
	};
	if (typeof data.summary === "string" && isValidCount(data.sentenceCount) && isValidCount(data.wordCount) && isValidCount(data.characterCount)) {
		note.summary = data.summary;
		note.sentenceCount = data.sentenceCount;
		note.wordCount = data.wordCount;
		note.characterCount = data.characterCount;
	} else {
		computeDerived(note);
	}
	return note;
}