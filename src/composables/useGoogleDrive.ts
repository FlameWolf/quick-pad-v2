import { useGoogleAuth } from "./useGoogleAuth";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

export function useGoogleDrive() {
	const { getAccessToken } = useGoogleAuth();

	async function headers() {
		const token = await getAccessToken();
		return { Authorization: `Bearer ${token}` };
	}

	async function findFile(name: string): Promise<string | null> {
		const q = encodeURIComponent(`name='${name}' and 'appDataFolder' in parents and trashed=false`);
		const res = await fetch(`${DRIVE_API}?spaces=appDataFolder&q=${q}&fields=files(id,name)`, {
			headers: await headers()
		});
		const data = await res.json();
		return data.files?.[0]?.id ?? null;
	}

	async function readJSON<T = unknown>(filename: string): Promise<T | null> {
		const fileId = await findFile(filename);
		if (!fileId) {
			return null;
		}
		const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
			headers: await headers()
		});
		return res.json();
	}

	async function writeJSON(filename: string, data: unknown): Promise<void> {
		const body = JSON.stringify(data);
		const existingId = await findFile(filename);
		if (existingId) {
			await fetch(`${UPLOAD_API}/${existingId}?uploadType=media`, {
				method: "PATCH",
				headers: { ...(await headers()), "Content-Type": "application/json" },
				body
			});
		} else {
			const metadata = {
				name: filename,
				parents: ["appDataFolder"],
				mimeType: "application/json"
			};
			const form = new FormData();
			form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
			form.append("file", new Blob([body], { type: "application/json" }));
			await fetch(`${UPLOAD_API}?uploadType=multipart`, {
				method: "POST",
				headers: await headers(),
				body: form
			});
		}
	}

	return { findFile, readJSON, writeJSON };
}