import { DRAFT_EXPIRY, DRAFT_PREFIX } from "@/constants/storage";

interface NoteDraft {
	title: string;
	content: string;
	savedAt: number;
}

function draftKey(id: string) {
	return `${DRAFT_PREFIX}${id}`;
}

function saveDraft(id: string, title: string, content: string): void {
	const key = draftKey(id);
	try {
		localStorage.setItem(key, JSON.stringify({ title, content, savedAt: Date.now() } satisfies NoteDraft));
	} catch {
		console.warn(`Failed to save draft for note ${id}`);
	}
}

function loadDraft(id: string): NoteDraft | null {
	try {
		const raw = localStorage.getItem(draftKey(id));
		const parsed = raw ? (JSON.parse(raw) as NoteDraft) : null;
		return parsed && typeof parsed.content === "string" ? parsed : null;
	} catch {
		return null;
	}
}

function clearDraft(id: string): void {
	const key = draftKey(id);
	try {
		localStorage.removeItem(key);
	} catch {
		console.warn(`Failed to remove draft for note ${id}`);
	}
}

function purgeStaleDrafts() {
	for (let index = 0; index < localStorage.length; index++) {
		const key = localStorage.key(index);
		if (key?.startsWith(DRAFT_PREFIX)) {
			const value = localStorage.getItem(key);
			if (value) {
				try {
					const draft = JSON.parse(value) as NoteDraft;
					if (Date.now() - draft.savedAt > DRAFT_EXPIRY) {
						localStorage.removeItem(key);
					}
				} catch {
					console.warn(`Failed to remove localStorage item ${key}`);
				}
			}
		}
	}
}

export function useNoteDraft() {
	return {
		saveDraft,
		loadDraft,
		clearDraft,
		purgeStaleDrafts
	};
}