import { createSignal } from "solid-js";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import { notes, purgeExpiredTrash, replaceMultple } from "@/stores/notes";
import { fromJSON, toJSON, type Note, type NoteJSON } from "@/models/Note";
import { debounce } from "@/library";
import type { UUID } from "crypto";

const SYNC_FILENAME = "quick-pad-notes.json";
const LAST_SYNCED_KEY = "quick-pad-last-synced";
const AUTO_SYNC_KEY = "quick-pad-auto-sync";
const DEBOUNCE_MS = 5000;

const [isSyncing, setIsSyncing] = createSignal(false);
const [lastSyncedAt, setLastSyncedAt] = createSignal<Date | null>(loadLastSynced());
const [syncError, setSyncError] = createSignal<string | null>(null);
const [autoSyncEnabled, setAutoSyncEnabled] = createSignal<boolean>(loadAutoSync());
const [lastSyncMessage, setLastSyncMessage] = createSignal<{
	text: string;
	type: "success" | "error";
	timeStamp: number;
} | null>(null);

function loadLastSynced(): Date | null {
	const raw = localStorage.getItem(LAST_SYNCED_KEY);
	return raw ? new Date(raw) : null;
}

function loadAutoSync(): boolean {
	const raw = localStorage.getItem(AUTO_SYNC_KEY);
	return raw === null ? true : raw === "true";
}

function persistAutoSync(val: boolean) {
	localStorage.setItem(AUTO_SYNC_KEY, String(val));
}

function persistLastSynced(date: Date) {
	localStorage.setItem(LAST_SYNCED_KEY, date.toISOString());
}

function noteEffectiveTime(note: Note): number {
	return (note.modifiedAt ?? note.createdAt).getTime();
}

export function mergeNotesByModifiedAt(local: ReadonlyArray<Note>, remote: ReadonlyArray<Note>): Note[] {
	const merged = new Map<string, Note>();
	for (const note of local) {
		merged.set(note.id, note);
	}
	for (const remoteNote of remote) {
		const localNote = merged.get(remoteNote.id);
		if (!localNote || noteEffectiveTime(remoteNote) > noteEffectiveTime(localNote)) {
			remoteNote.updatedInRemote = true;
			merged.set(remoteNote.id, remoteNote);
		}
		if (localNote && noteEffectiveTime(localNote) > noteEffectiveTime(remoteNote)) {
			localNote.updatedInLocal = true;
		}
	}
	return Array.from(merged.values());
}

export function useNotesSync() {
	const { readJSON, writeJSON } = useGoogleDrive();
	const { isSignedIn } = useGoogleAuth();

	async function readRemoteNotes(): Promise<Note[]> {
		const data = await readJSON<NoteJSON[]>(SYNC_FILENAME);
		if (data && Array.isArray(data)) {
			return data.map(fromJSON);
		}
		return [];
	}

	async function saveToCloud(purged: Array<UUID> | undefined = undefined): Promise<void> {
		setIsSyncing(true);
		setSyncError(null);
		try {
			const remoteNotes = (await readRemoteNotes()).filter(note => !purged?.includes(note.id));
			const merged = mergeNotesByModifiedAt(notes(), remoteNotes);
			replaceMultple(merged.filter(note => note.updatedInRemote));
			purgeExpiredTrash();
			await writeJSON(SYNC_FILENAME, notes().map(toJSON));
			const now = new Date();
			setLastSyncedAt(now);
			persistLastSynced(now);
			setLastSyncMessage({
				text: "Notes saved to Drive",
				type: "success",
				timeStamp: Date.now()
			});
		} catch (e: any) {
			const message = e?.message ?? "Failed to save";
			setSyncError(message);
			setLastSyncMessage({
				text: `Sync failed: ${message}`,
				type: "error",
				timeStamp: Date.now()
			});
		} finally {
			setIsSyncing(false);
		}
	}

	async function loadFromCloud(): Promise<void> {
		setIsSyncing(true);
		setSyncError(null);
		try {
			const remoteNotes = await readRemoteNotes();
			if (remoteNotes.length === 0 && notes().length === 0) {
				setLastSyncMessage({
					text: "No notes found on Drive",
					type: "success",
					timeStamp: Date.now()
				});
				return;
			}
			const merged = mergeNotesByModifiedAt(notes(), remoteNotes);
			replaceMultple(merged.filter(note => note.updatedInRemote));
			purgeExpiredTrash();
			const now = new Date();
			setLastSyncedAt(now);
			persistLastSynced(now);
			setLastSyncMessage({
				text: remoteNotes.length === 0 ? "No notes found on Drive" : "Notes loaded from Drive",
				type: "success",
				timeStamp: Date.now()
			});
		} catch (e: any) {
			const message = e?.message ?? "Failed to load";
			setSyncError(message);
			setLastSyncMessage({
				text: `Sync failed: ${message}`,
				type: "error",
				timeStamp: Date.now()
			});
		} finally {
			setIsSyncing(false);
		}
	}

	const requestSync = debounce((purged: Array<UUID> | undefined = undefined) => {
		if (isSignedIn() && autoSyncEnabled()) {
			saveToCloud(purged);
		}
	}, DEBOUNCE_MS);

	function setAutoSync(enabled: boolean) {
		setAutoSyncEnabled(enabled);
		persistAutoSync(enabled);
		if (!enabled) {
			requestSync.cancel();
		}
	}

	function dismissMessage() {
		setLastSyncMessage(null);
	}

	return {
		isSyncing,
		lastSyncedAt,
		syncError,
		autoSyncEnabled,
		lastSyncMessage,
		saveToCloud,
		loadFromCloud,
		requestSync,
		setAutoSync,
		dismissMessage
	};
}