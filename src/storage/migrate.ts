import { getKV, putNote, setKV } from "./db";
import { KV_MAPPINGS, MIGRATION_FLAG, LEGACY_NOTES_KEY, NOTE_PREFIX } from "@/constants/storage";
import { logWarn } from "@/utils/logger";
import type { NoteJSON } from "@/models/Note";

type Coercion = (typeof KV_MAPPINGS)[number][2];

function coerce(raw: string, type: Coercion): FromName<Coercion> {
	switch (type) {
		case "string":
			return raw;
		case "number":
			return Number(raw);
		case "boolean":
			return raw === "true";
		case "json":
			return JSON.parse(raw);
		default:
			throw new Error(`Unsupported coercion type: ${type}`);
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
		} catch (err) {
			logWarn(`Failed to migrate legacy notes array from "${LEGACY_NOTES_KEY}"`, err);
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
		} catch (err) {
			logWarn(`Failed to migrate note from localStorage key "${k}"`, err);
		}
	}
	for (const [lsKey, idbKey, type] of KV_MAPPINGS) {
		const raw = localStorage.getItem(lsKey);
		if (raw === null) {
			continue;
		}
		try {
			await setKV(idbKey, coerce(raw, type));
		} catch (err) {
			logWarn(`Failed to migrate localStorage key "${lsKey}" (type "${type}")`, err);
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