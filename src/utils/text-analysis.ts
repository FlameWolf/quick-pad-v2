import { emptyString } from "@/constants/common";

const summaryLength = 100;
const wordMatchRegExp = /[\p{L}\p{M}\p{Nd}\p{Pc}\p{Join_C}]+/u;
const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const wordSegmenter = new Intl.Segmenter("en", { granularity: "word" });
const characterSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function iterableLength(segments: Intl.Segments): number {
	let count = 0;
	for (const _ of segments) {
		count++;
	}
	return count;
}

export function getSummary(text: string): string {
	const parts: string[] = [];
	for (const { segment } of characterSegmenter.segment(text)) {
		parts.push(segment);
		if (parts.length > summaryLength) {
			parts.length = summaryLength - 1;
			return `${parts.join(emptyString)}\u2026`;
		}
	}
	return text;
}

export function getSentenceCount(text: string): number {
	return iterableLength(sentenceSegmenter.segment(text));
}

export function getWordCount(text: string): number {
	let count = 0;
	for (const { segment } of wordSegmenter.segment(text)) {
		if (wordMatchRegExp.test(segment)) {
			count++;
		}
	}
	return count;
}

export function getCharacterCount(text: string): number {
	return iterableLength(characterSegmenter.segment(text));
}

export function contains(text: string, search: string): boolean {
	return new RegExp(RegExp.escape(search), "i").test(text);
}