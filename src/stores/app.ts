import { createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { emptyString } from "@/constants/common";
import { FONT_SCALE_FACTOR } from "@/constants/ui";

interface AppState {
	lastView: View | null | undefined;
	currentColour: Colour | undefined;
	fontScaleFactor: number;
}

const [store, setStore] = createStore<AppState>({
	lastView: undefined,
	currentColour: undefined,
	fontScaleFactor: getFontScaleFactor()
});
export const lastView = createMemo(() => store.lastView);
export const currentColour = createMemo(() => store.currentColour);
export const fontScaleFactor = createMemo(() => store.fontScaleFactor);

function getFontScaleFactor(): number {
	const factor = parseInt(localStorage.getItem(FONT_SCALE_FACTOR) ?? emptyString);
	if (Number.isNaN(factor)) {
		return 0;
	}
	return factor;
}

export function setLastView(view: View | null | undefined) {
	setStore("lastView", view);
}

export function setCurrentColour(colour: Colour | undefined) {
	setStore("currentColour", colour);
}

export function setFontScaleFactor(factor: number) {
	if (factor < 0 || factor > 10) {
		return;
	}
	setStore("fontScaleFactor", factor);
	if (factor === 0) {
		localStorage.removeItem(FONT_SCALE_FACTOR);
		return;
	}
	localStorage.setItem(FONT_SCALE_FACTOR, factor.toString());
}