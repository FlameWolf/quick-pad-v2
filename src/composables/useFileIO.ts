import { createSignal } from "solid-js";
import { activeNotes, addNote, getNoteContent } from "@/stores/notes";
import { create, type Note } from "@/models/Note";
import { emptyString } from "@/constants/common";
import { isTextFile } from "@/utils/file-detection";

interface ImportError {
	fileName: string;
	message: string;
}

const JSZip = (await import("jszip")).default;
const [importErrors, setImportErrors] = createSignal<ImportError[]>([]);

function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	setTimeout(() => {
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	});
}

function sanitizeFilename(name: string): string {
	return name.replace(/[<>:"/\\|?*]+/g, "_").trim() || "Untitled";
}

export function useFileIO() {
	function importFiles(): Promise<number> {
		return new Promise(resolve => {
			const input = document.createElement("input");
			input.type = "file";
			input.multiple = true;
			input.addEventListener("change", async () => {
				const files = input.files;
				if (!files || files.length === 0) {
					resolve(0);
					return;
				}
				let count = 0;
				for (const file of files) {
					if (!(await isTextFile(file))) {
						setImportErrors([...importErrors(), { fileName: file.name, message: "Unsupported file type" }]);
						continue;
					}
					try {
						const content = await file.text();
						const title = file.name.replace(/\.txt$/i, emptyString) || "Untitled";
						await addNote(create(title, content));
						count++;
					} catch {
						setImportErrors([...importErrors(), { fileName: file.name, message: "Failed to read file" }]);
					}
				}
				resolve(count);
			});
			input.click();
		});
	}

	function dismissErrors() {
		setImportErrors([]);
	}

	async function exportNote(note: Note) {
		const content = (await getNoteContent(note.id)) ?? emptyString;
		const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
		triggerDownload(blob, `${sanitizeFilename(note.title)}.txt`);
	}

	async function exportNotes(notes: Note[]) {
		if (notes.length === 0) {
			return;
		}
		const zip = new JSZip();
		const usedNames = new Set<string>();
		for (const note of notes) {
			const name = sanitizeFilename(note.title);
			let uniqueName = name;
			let counter = 1;
			while (usedNames.has(uniqueName)) {
				uniqueName = `${name} (${counter++})`;
			}
			usedNames.add(uniqueName);
			const content = (await getNoteContent(note.id)) ?? emptyString;
			zip.file(`${uniqueName}.txt`, content);
		}
		const blob = await zip.generateAsync({ type: "blob" });
		triggerDownload(blob, "quick-pad-notes.zip");
	}

	async function exportAllNotes() {
		await exportNotes(activeNotes());
	}

	return {
		importFiles,
		importErrors,
		dismissErrors,
		exportNote,
		exportNotes,
		exportAllNotes
	};
}