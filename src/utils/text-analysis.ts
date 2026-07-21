import { emptyString } from "@/constants/common";

let sentenceSegmenterInstance: Intl.Segmenter | undefined;
let wordSegmenterInstance: Intl.Segmenter | undefined;
let characterSegmenterInstance: Intl.Segmenter | undefined;
const summaryLength = 100;
const wordMatchRegExp = /[\p{L}\p{M}\p{Nd}\p{Pc}\p{Join_C}]+/u;
const sentenceSegmenter = () => (sentenceSegmenterInstance ??= new Intl.Segmenter("en", { granularity: "sentence" }));
const wordSegmenter = () => (wordSegmenterInstance ??= new Intl.Segmenter("en", { granularity: "word" }));
const characterSegmenter = () => (characterSegmenterInstance ??= new Intl.Segmenter("en", { granularity: "grapheme" }));

export const getSummary = (text: string): string => {
	const chars = Array.from(characterSegmenter().segment(text));
	if (chars.length <= summaryLength) {
		return text;
	}
	return `${chars
		.toSpliced(summaryLength - 1)
		.map(x => x.segment)
		.join(emptyString)}\u2026`;
};

export const getSentenceCount = (text: string): number => {
	return Array.from(sentenceSegmenter().segment(text)).length;
};

export const getWordCount = (text: string): number => {
	return Array.from(wordSegmenter().segment(text)).filter(x => wordMatchRegExp.test(x.segment)).length;
};

export const getCharacterCount = (text: string): number => {
	return Array.from(characterSegmenter().segment(text)).length;
};

export const contains = (text: string, search: string): boolean => {
	return new RegExp(RegExp.escape(search), "i").test(text);
};