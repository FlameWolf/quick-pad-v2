import { createEffect, createMemo, createSignal, on } from "solid-js";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import * as store from "@/stores/notes";
import { fromJSON, toJSON, type Note, type NoteJSON } from "@/models/Note";
import { getKV, setKV } from "@/storage/db";
import { AUTO_SYNC_KEY, debounce, DEBOUNCE_MS, emptyString, LAST_SYNCED_TO_CLOUD_KEY, LAST_SYNCED_TO_LOCAL_KEY, LEGACY_SYNC_FILENAME, NOTE_PREFIX } from "@/library";
import type { UUID } from "crypto";

const [isSyncing, setIsSyncing] = createSignal(false);
const [lastSyncedToLocalAt, setLastSyncedToLocalAt] = createSignal<Date | null>(null);
const [lastSyncedToCloudAt, setLastSyncedToCloudAt] = createSignal<Date | null>(null);
const [autoSyncEnabled, setAutoSyncEnabled] = createSignal<boolean>(true);
const [lastSyncMessage, setLastSyncMessage] = createSignal<{
	text: string;
	type: "success" | "error";
	timeStamp: number;
} | null>(null);
const [syncError, setSyncError] = createSignal<string | null>(null);
const pendingPurges = new Set<UUID>();

export async function hydrateSyncMetadata(): Promise<void> {
	const storedLocal = await getKV<string>(LAST_SYNCED_TO_LOCAL_KEY);
	const storedCloud = await getKV<string>(LAST_SYNCED_TO_CLOUD_KEY);
	const storedAutoSync = await getKV<boolean>(AUTO_SYNC_KEY);
	setLastSyncedToLocalAt(storedLocal ? new Date(storedLocal) : null);
	setLastSyncedToCloudAt(storedCloud ? new Date(storedCloud) : null);
	setAutoSyncEnabled(storedAutoSync === undefined ? true : storedAutoSync);
	createEffect(
		on(
			autoSyncEnabled,
			async flag => {
				await setKV(AUTO_SYNC_KEY, flag);
			},
			{ defer: true }
		)
	);
	createEffect(
		on(
			lastSyncedToLocalAt,
			async date => {
				await setKV(LAST_SYNCED_TO_LOCAL_KEY, date);
			},
			{ defer: true }
		)
	);
	createEffect(
		on(
			lastSyncedToCloudAt,
			async date => {
				await setKV(LAST_SYNCED_TO_CLOUD_KEY, date);
			},
			{ defer: true }
		)
	);
}

export function noteEffectiveTime(note: Note): number {
	return Math.max(note.createdAt.getTime(), note.modifiedAt?.getTime() ?? 0, note.archivedAt?.getTime() ?? 0, note.deletedAt?.getTime() ?? 0, note.stateChangedAt?.getTime() ?? 0);
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
	const getFileName = (id: UUID) => `${NOTE_PREFIX}${id}.json`;

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

	async function readRemoteNotes(force = false): Promise<Note[]> {
		const files = await listFiles(NOTE_PREFIX, force ? null : lastSyncedToLocalAt());
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

	async function purgeRemoteFiles(fileIdsToPurge: ReadonlyArray<UUID>) {
		fileIdsToPurge.forEach(Set.prototype.add, pendingPurges);
		if (pendingPurges.size > 0) {
			const purgeSnapshot = Array.from(pendingPurges);
			await Promise.all(purgeSnapshot.map(getFileName).map(deleteFile));
			purgeSnapshot.forEach(Set.prototype.delete, pendingPurges);
		}
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
				if (remoteEffectiveTime > localEffectiveTime) {
					await store.replaceNote(remoteNote);
					return "conflict";
				}
			}
		} else {
			await writeJSON(fileName, toJSON(note));
		}
		return "uploaded";
	}

	async function runPull(force = false) {
		const syncStartedAt = new Date();
		const remoteNotes = await readRemoteNotes(force);
		const changes = mergeNotesByModifiedAt(store.notes(), remoteNotes);
		if (changes.length > 0) {
			await store.replaceMultiple(changes);
		}
		await purgeRemoteFiles(await store.purgeExpiredTrash());
		setLastSyncedToLocalAt(syncStartedAt);
		return {
			remoteCount: remoteNotes.length,
			downloaded: changes.length
		};
	}

	async function runPush(purged: ReadonlyArray<UUID> = [], force = false) {
		const syncStartedAt = new Date();
		await purgeRemoteFiles(purged);
		const candidates = force ? store.notes() : store.notes().filter(n => noteEffectiveTime(n) > (lastSyncedToCloudAt()?.getTime() ?? 0));
		const results = await Promise.all(candidates.map(uploadNote));
		if (lastSyncedToLocalAt()) {
			await deleteFromLegacy();
		}
		setLastSyncedToCloudAt(syncStartedAt);
		return {
			conflicts: results.filter(r => r === "conflict").length
		};
	}

	async function doPullAndPush({ force = false as boolean, purged = [] as ReadonlyArray<UUID> } = {}) {
		if (isSyncing()) {
			return;
		}
		setIsSyncing(true);
		setSyncError(null);
		try {
			const pullResult = await runPull(force);
			const pushResult = await runPush(purged, force);
			const empty = pullResult.remoteCount === 0 && store.notes().length === 0;
			const changes = pushResult.conflicts + pullResult.downloaded;
			setLastSyncMessage({
				text: empty ? "Nothing to sync" : `Notes synced${changes > 0 ? ` with ${changes} changes${changes > 1 ? "s" : emptyString} fetched from remote` : emptyString}`,
				type: "success",
				timeStamp: Date.now()
			});
		} catch (err: any) {
			setSyncError(err?.message ?? "Sync failed");
			setLastSyncMessage({ text: `Sync failed: ${syncError()}`, type: "error", timeStamp: Date.now() });
		} finally {
			setIsSyncing(false);
		}
	}

	async function saveToCloud(purged: ReadonlyArray<UUID> = []): Promise<boolean> {
		if (isSyncing()) {
			return false;
		}
		try {
			setIsSyncing(true);
			await runPush(purged, false);
			return true;
		} catch {
			return false;
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
				purged.forEach(Set.prototype.add, pendingPurges);
			}
			debouncedFlush();
		},
		{
			cancel() {
				debouncedFlush.cancel();
			}
		}
	);

	async function setAutoSync(enabled: boolean) {
		setAutoSyncEnabled(enabled);
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
		doPullAndPush,
		requestSync,
		setAutoSync,
		dismissMessage
	};
}