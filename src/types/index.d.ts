declare namespace globalThis {
	declare const google: any;
	interface RegExpConstructor {
		escape: (value: string) => string;
	}
}

declare module "crypto" {
	type UUID = `${string}-${string}-${string}-${string}-${string}`;
}

declare namespace Intl {
	type Intl$Locale = string;
	type Intl$Locales = Intl$Locale | Intl$Locale[];
	type SegmenterOptions = {
		localeMatcher?: "best fit" | "lookup";
		granularity?: "grapheme" | "word" | "sentence";
	};
	type ResolvedSegmenterOptions = {
		locale: string;
		granularity: "grapheme" | "word" | "sentence";
	};
	type SegmentData = {
		segment: string;
		index: number;
		input: string;
		isWordLike?: boolean;
	};
	declare class Segments {
		containing(codeUnitIndex?: number): SegmentData;
		[Symbol.iterator]: () => Iterator<SegmentData>;
	}
	declare class Segmenter {
		constructor(locales: Intl$Locale | Intl$Locale[], options: SegmenterOptions): Segmenter;
		constructor(locales: Intl$Locale | Intl$Locale[]): Segmenter;
		constructor(options: SegmenterOptions): Segmenter;
		constructor(): Segmenter;
		resolvedOptions(): ResolvedSegmenterOptions;
		segment(input: string): Segments;
	}
}