let sentenceSegmenterInstance: Intl.Segmenter | undefined;
let wordSegmenterInstance: Intl.Segmenter | undefined;
let characterSegmenterInstance: Intl.Segmenter | undefined;
const summaryLength = 100;
const wordMatchRegExp = /[\p{L}\p{M}\p{Nd}\p{Pc}\p{Join_C}]+/u;

function sentenceSegmenter(): Intl.Segmenter {
	return (sentenceSegmenterInstance ??= new Intl.Segmenter("en", { granularity: "sentence" }));
}

function wordSegmenter(): Intl.Segmenter {
	return (wordSegmenterInstance ??= new Intl.Segmenter("en", { granularity: "word" }));
}

function characterSegmenter(): Intl.Segmenter {
	return (characterSegmenterInstance ??= new Intl.Segmenter("en", { granularity: "grapheme" }));
}

export const getSummary = (text: string): string => {
	return text.length > summaryLength ? text.substring(0, summaryLength) + "…" : text;
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