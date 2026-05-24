const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const wordSegmenter = new Intl.Segmenter("en", { granularity: "word" });
const characterSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const wordMatchRegExp = /[\p{L}\p{M}\p{Nd}\p{Pc}\p{Join_C}]+/u;

export const emptyString = "";
export const summaryLength = 100;
export const LEGACY_STORAGE_KEY = "quick-pad-notes";
export const STORAGE_KEY = "qp-note:";
export const getSummary = (text: string): string => {
	return text.length > summaryLength ? text.substring(0, summaryLength) + "\u2026" : text;
};
export const getSentenceCount = (text: string): number => {
	return Array.from(sentenceSegmenter.segment(text)).length;
};
export const getWordCount = (text: string): number => {
	return Array.from(wordSegmenter.segment(text)).filter(x => wordMatchRegExp.test(x.segment)).length;
};
export const getCharacterCount = (text: string): number => {
	return Array.from(characterSegmenter.segment(text)).length;
};
export const contains = (text: string, search: string): boolean => {
	return new RegExp(RegExp.escape(search), "i").test(text);
};
export const isTextFile = (function () {
	const MAGIC_NUMBERS: Array<{ fileType: string; sig: Array<number> }> = [
		{
			fileType: "png",
			sig: [0x89, 0x50, 0x4e, 0x47]
		},
		{
			fileType: "jpeg",
			sig: [0xff, 0xd8, 0xff]
		},
		{
			fileType: "gif",
			sig: [0x47, 0x49, 0x46, 0x38]
		},
		{
			fileType: "pdf",
			sig: [0x25, 0x50, 0x44, 0x46]
		}
	];
	function hasMagic(bytes: Uint8Array) {
		return MAGIC_NUMBERS.some(({ sig }) => sig.every((value, index) => bytes[index] === value));
	}
	function hasNul(bytes: Uint8Array) {
		return bytes.includes(0x00);
	}
	function controlCharRatio(bytes: Uint8Array) {
		let count = 0;
		for (let index = 0; index < bytes.length; index++) {
			const byte = bytes[index] as number;
			const allowed = byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c;
			const isControl = byte <= 0x08 || (byte >= 0x0e && byte <= 0x1f) || byte === 0x7f;
			if (!allowed && isControl) {
				count++;
			}
		}
		return count / Math.max(1, bytes.length);
	}
	function isValidUtf8(bytes: Uint8Array) {
		try {
			new TextDecoder("utf-8", { fatal: true }).decode(bytes);
			return true;
		} catch {
			return false;
		}
	}
	return async (file: File, sampleSize: number = 8192) => {
		const blob = file.slice(0, sampleSize);
		const buffer = await blob.arrayBuffer();
		const bytes = new Uint8Array(buffer);
		if (bytes.length === 0) {
			return true;
		}
		if (hasNul(bytes) || hasMagic(bytes) || !isValidUtf8(bytes)) {
			return false;
		}
		const ratio = controlCharRatio(bytes);
		if (ratio > 0.0075) {
			return false;
		}
		return true;
	};
})();
export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): ((...args: Parameters<T>) => void) & { cancel: () => void } {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	return Object.assign(
		function (this: unknown, ...args: Parameters<T>): void {
			if (timeoutId !== null) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				timeoutId = null;
				fn.apply(this, args);
			}, wait);
		},
		{
			cancel() {
				if (timeoutId !== null) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
			}
		}
	);
}
export function throttle<T extends (...args: any[]) => any>(fn: T, wait: number): ((...args: Parameters<T>) => void) & { cancel: () => void } {
	let lastCall = 0;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: Parameters<T> | null = null;
	let lastThis: unknown = null;
	return Object.assign(
		function (this: unknown, ...args: Parameters<T>): void {
			const now = Date.now();
			const remaining = wait - (now - lastCall);
			lastArgs = args;
			lastThis = this;
			if (remaining <= 0) {
				if (timeoutId !== null) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
				lastCall = now;
				fn.apply(lastThis, lastArgs);
			} else if (timeoutId === null) {
				timeoutId = setTimeout(() => {
					lastCall = Date.now();
					timeoutId = null;
					if (lastArgs) fn.apply(lastThis, lastArgs);
				}, remaining);
			}
		},
		{
			cancel() {
				if (timeoutId !== null) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
				lastCall = 0;
				lastArgs = null;
				lastThis = null;
			}
		}
	);
}