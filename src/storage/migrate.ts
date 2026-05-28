import { getKV, putNote, setKV } from "./db";
import type { NoteJSON } from "@/models/Note";

type Coercion = "string" | "number" | "boolean" | "json";

const MIGRATION_FLAG = "__migrated-to-idb";
const LEGACY_NOTES_KEY = "quick-pad-notes";
const NOTE_PREFIX = "qp-note:";
const KV_MAPPINGS: ReadonlyArray<readonly [string, string, Coercion]> = [
	["quick-pad-sort-by", "sort-by", "string"],
	["quick-pad-sort-direction", "sort-direction", "string"],
	["quick-pad-last-synced-to-local", "last-synced-to-local", "string"],
	["quick-pad-last-synced-to-cloud", "last-synced-to-cloud", "string"],
	["quick-pad-auto-sync", "auto-sync", "boolean"],
	["quick-pad-pending-purges", "pending-purges", "json"],
	["google_session_hint", "google-session-hint", "string"],
	["google_access_token", "google-access-token", "string"],
	["google_token_expires_at", "google-token-expires-at", "number"],
	["google_user_info", "google-user-info", "json"]
];

function coerce(raw: string, type: Coercion): unknown {
	switch (type) {
		case "string":
			return raw;
		case "number":
			return Number(raw);
		case "boolean":
			return raw === "true";
		case "json":
			return JSON.parse(raw);
	}
}

export async function runMigration(): Promise<void> {
	if (await getKV<boolean>(MIGRATION_FLAG)) {
		return;
	}
	const noteKeysToRemove: string[] = [];
	const legacyRaw = localStorage.getItem(LEGACY_NOTES_KEY);
	if (legacyRaw) {
		try {
			const arr = JSON.parse(legacyRaw) as NoteJSON[];
			if (Array.isArray(arr)) {
				for (const note of arr) {
					if (note && typeof note.id === "string") {
						await putNote(note);
					}
				}
			}
		} catch {
			void 0;
		}
	}
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (k?.startsWith(NOTE_PREFIX)) {
			noteKeysToRemove.push(k);
		}
	}
	for (const k of noteKeysToRemove) {
		const raw = localStorage.getItem(k);
		if (!raw) {
			continue;
		}
		try {
			const note = JSON.parse(raw) as NoteJSON;
			if (note && typeof note.id === "string") {
				await putNote(note);
			}
		} catch {
			void 0;
		}
	}
	for (const [lsKey, idbKey, type] of KV_MAPPINGS) {
		const raw = localStorage.getItem(lsKey);
		if (raw === null) {
			continue;
		}
		try {
			await setKV(idbKey, coerce(raw, type));
		} catch {
			void 0;
		}
	}
	for (const k of noteKeysToRemove) {
		localStorage.removeItem(k);
	}
	if (legacyRaw) {
		localStorage.removeItem(LEGACY_NOTES_KEY);
	}
	for (const [lsKey] of KV_MAPPINGS) {
		localStorage.removeItem(lsKey);
	}
	await setKV(MIGRATION_FLAG, true);
}