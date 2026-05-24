import { createMemo, createSignal } from "solid-js";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import * as store from "@/stores/notes";
import { fromJSON, toJSON, type Note, type NoteJSON } from "@/models/Note";
import { debounce, emptyString, STORAGE_KEY } from "@/library";
import type { UUID } from "crypto";

const LEGACY_SYNC_FILENAME = "quick-pad-notes.json";
const LAST_SYNCED_TO_LOCAL_KEY = "quick-pad-last-synced-to-local";
const LAST_SYNCED_TO_CLOUD_KEY = "quick-pad-last-synced-to-cloud";
const AUTO_SYNC_KEY = "quick-pad-auto-sync";
const PENDING_PURGES_KEY = "quick-pad-pending-purges";
const DEBOUNCE_MS = 3000;
const [isSyncing, setIsSyncing] = createSignal(false);
const [lastSyncedToLocalAt, setLastSyncedToLocalAt] = createSignal<Date | null>(loadLastSyncedToLocal());
const [lastSyncedToCloudAt, setLastSyncedToCloudAt] = createSignal<Date | null>(loadLastSyncedToCloud());
const [autoSyncEnabled, setAutoSyncEnabled] = createSignal<boolean>(loadAutoSync());
const [lastSyncMessage, setLastSyncMessage] = createSignal<{
	text: string;
	type: "success" | "error";
	timeStamp: number;
} | null>(null);
const [syncError, setSyncError] = createSignal<string | null>(null);
const pendingPurges = loadPendingPurges();

function loadLastSyncedToLocal(): Date | null {
	const raw = localStorage.getItem(LAST_SYNCED_TO_LOCAL_KEY);
	return raw ? new Date(raw) : null;
}

function loadLastSyncedToCloud(): Date | null {
	const raw = localStorage.getItem(LAST_SYNCED_TO_CLOUD_KEY);
	return raw ? new Date(raw) : null;
}

function loadAutoSync(): boolean {
	const raw = localStorage.getItem(AUTO_SYNC_KEY);
	return raw === null ? true : raw === "true";
}

function persistAutoSync(val: boolean) {
	localStorage.setItem(AUTO_SYNC_KEY, String(val));
}

function persistLastSyncedToLocal(date: Date) {
	localStorage.setItem(LAST_SYNCED_TO_LOCAL_KEY, date.toISOString());
}

function persistLastSyncedToCloud(date: Date) {
	localStorage.setItem(LAST_SYNCED_TO_CLOUD_KEY, date.toISOString());
}

function loadPendingPurges(): Set<UUID> {
	try {
		const raw = localStorage.getItem(PENDING_PURGES_KEY);
		const ids: UUID[] = raw ? JSON.parse(raw) : [];
		return new Set(ids);
	} catch {
		return new Set();
	}
}

function persistPendingPurges(set: Set<UUID>) {
	if (set.size === 0) {
		localStorage.removeItem(PENDING_PURGES_KEY);
		return;
	}
	localStorage.setItem(PENDING_PURGES_KEY, JSON.stringify(Array.from(set)));
}

export function noteEffectiveTime(note: Note): number {
	return Math.max(note.createdAt.getTime(), note.modifiedAt?.getTime() ?? 0, note.archivedAt?.getTime() ?? 0, note.deletedAt?.getTime() ?? 0, note.purgedAt?.getTime() ?? 0, note.stateChangedAt?.getTime() ?? 0);
}

export function mergeNotesByModifiedAt(local: ReadonlyArray<Note>, remote: ReadonlyArray<Note>): Note[] {
	const localMap = new Map<string, Note>(local.map(note => [note.id, note]));
	const changes: Note[] = [];
	for (const remoteNote of remote) {
		const localNote = localMap.get(remoteNote.id);
		if (!localNote || noteEffectiveTime(remoteNote) > noteEffectiveTime(localNote)) {
			changes.push(remoteNote);
		}
	}
	return changes;
}

export function useNotesSync() {
	const { listFiles, findFile, readJSON, readJSONById, writeJSONById, writeJSON, deleteFile } = useGoogleDrive();
	const { isSignedIn } = useGoogleAuth();
	const getFileName = (id: UUID) => `${STORAGE_KEY}${id}.json`;

	async function migrateFromLegacy(): Promise<Note[]> {
		try {
			const data = await readJSON<NoteJSON[]>(LEGACY_SYNC_FILENAME);
			if (data && Array.isArray(data)) {
				return data.map(fromJSON);
			}
		} catch {
			void 0;
		}
		return [];
	}

	async function deleteFromLegacy() {
		try {
			await deleteFile(LEGACY_SYNC_FILENAME);
		} catch {
			void 0;
		}
	}

	async function readRemoteNotes(): Promise<Note[]> {
		const files = await listFiles(STORAGE_KEY);
		const notes: Note[] = [];
		await Promise.all(
			files.map(async file => {
				try {
					const data = await readJSONById<NoteJSON>(file.id);
					if (data) {
						notes.push(fromJSON(data));
					}
				} catch (err) {
					console.warn(`Failed to read note file ${file.name}:`, err);
				}
			})
		);
		return notes.concat(await migrateFromLegacy());
	}

	async function uploadNote(note: Note): Promise<"uploaded" | "conflict"> {
		const fileName = getFileName(note.id);
		const remoteFile = await findFile(fileName);
		if (remoteFile) {
			const remoteJSON = await readJSONById<NoteJSON>(remoteFile.id);
			if (remoteJSON) {
				const remoteNote = fromJSON(remoteJSON);
				const remoteEffectiveTime = noteEffectiveTime(remoteNote);
				const localEffectiveTime = noteEffectiveTime(note);
				if (localEffectiveTime > remoteEffectiveTime) {
					await writeJSONById(remoteFile.id, toJSON(note));
					return "uploaded";
				}
				if (remoteEffectiveTime > remoteEffectiveTime) {
					store.replaceNote(remoteNote);
					return "conflict";
				}
			}
		} else {
			await writeJSON(fileName, toJSON(note));
		}
		return "uploaded";
	}

	async function saveToCloud(purged: ReadonlyArray<UUID> = []): Promise<boolean> {
		if (isSyncing()) {
			return false;
		}
		setIsSyncing(true);
		setSyncError(null);
		let conflictCount = 0;
		if (purged.length > 0) {
			for (const id of purged) {
				pendingPurges.add(id);
			}
			persistPendingPurges(pendingPurges);
		}
		const purgeSnapshot = Array.from(pendingPurges);
		try {
			const syncStartedAt = new Date();
			await Promise.all(purgeSnapshot.map(getFileName).map(deleteFile));
			purgeSnapshot.forEach(id => pendingPurges.delete(id));
			persistPendingPurges(pendingPurges);
			const dirtyNotes = store.notes().filter(note => noteEffectiveTime(note) > (lastSyncedToCloudAt()?.getTime() ?? 0));
			const uploadResults = await Promise.all(dirtyNotes.map(uploadNote));
			conflictCount = uploadResults.filter(result => result === "conflict").length;
			if (lastSyncedToLocalAt()) {
				await deleteFromLegacy();
			}
			setLastSyncedToCloudAt(syncStartedAt);
			persistLastSyncedToCloud(syncStartedAt);
			setLastSyncMessage({
				text: `Notes saved to Drive${conflictCount > 0 ? ` with ${conflictCount} conflict${conflictCount > 1 ? "s" : emptyString} resolved` : emptyString}`,
				type: "success",
				timeStamp: Date.now()
			});
			return true;
		} catch (e: any) {
			setSyncError(e?.message ?? "Failed to save");
			setLastSyncMessage({
				text: `Sync failed: ${syncError()}`,
				type: "error",
				timeStamp: Date.now()
			});
			return false;
		} finally {
			setIsSyncing(false);
		}
	}

	async function loadFromCloud(): Promise<void> {
		if (isSyncing()) {
			return;
		}
		setIsSyncing(true);
		setSyncError(null);
		try {
			const syncStartedAt = new Date();
			const remoteNotes = await readRemoteNotes();
			if (remoteNotes.length === 0 && store.notes.length === 0) {
				setLastSyncMessage({
					text: "No notes found on Drive",
					type: "success",
					timeStamp: Date.now()
				});
				return;
			}
			const changes = mergeNotesByModifiedAt(store.notes(), remoteNotes);
			if (changes.length > 0) {
				store.replaceMultiple(changes);
			}
			const expiredIds = store.purgeExpiredTrash();
			if (expiredIds.length > 0) {
				for (const id of expiredIds) {
					pendingPurges.add(id);
				}
				persistPendingPurges(pendingPurges);
				await Promise.all(expiredIds.map(getFileName).map(deleteFile));
				expiredIds.forEach(id => pendingPurges.delete(id));
				persistPendingPurges(pendingPurges);
			}
			setLastSyncedToLocalAt(syncStartedAt);
			persistLastSyncedToLocal(syncStartedAt);
			setLastSyncMessage({
				text: remoteNotes.length === 0 ? "No notes found on Drive" : "Notes loaded from Drive",
				type: "success",
				timeStamp: Date.now()
			});
		} catch (e: any) {
			setSyncError(e?.message ?? "Failed to load");
			setLastSyncMessage({
				text: `Sync failed: ${syncError()}`,
				type: "error",
				timeStamp: Date.now()
			});
		} finally {
			setIsSyncing(false);
		}
	}

	const debouncedFlush = debounce(() => {
		if (isSignedIn() && autoSyncEnabled()) {
			saveToCloud();
		}
	}, DEBOUNCE_MS);

	const requestSync = Object.assign(
		function (purged: ReadonlyArray<UUID> = []) {
			if (purged.length > 0) {
				for (const id of purged) {
					pendingPurges.add(id);
				}
				persistPendingPurges(pendingPurges);
			}
			debouncedFlush();
		},
		{
			cancel() {
				debouncedFlush.cancel();
			}
		}
	);

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
		lastSyncedAt: createMemo(() => {
			const max = Math.max(lastSyncedToLocalAt()?.getTime() ?? 0, lastSyncedToCloudAt()?.getTime() ?? 0);
			return max > 0 ? new Date(max) : null;
		}),
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