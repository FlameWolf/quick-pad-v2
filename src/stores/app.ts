import { createEffect, on } from "solid-js";
import { createStore } from "solid-js/store";
import { emptyString } from "@/constants/common";
import { FONT_SCALE_FACTOR } from "@/constants/ui";

interface AppState {
	lastView: View | null | undefined;
	fontScaleFactor: number;
}

const getFontScaleFactor = (): number => {
	const factor = parseInt(localStorage.getItem(FONT_SCALE_FACTOR) ?? emptyString);
	if (Number.isNaN(factor)) {
		return 0;
	}
	return factor;
};
const [store, setStore] = createStore<AppState>({
	lastView: undefined,
	fontScaleFactor: getFontScaleFactor()
});
export const lastView = () => store.lastView;
export const fontScaleFactor = () => store.fontScaleFactor;

createEffect(
	on(
		() => store.fontScaleFactor,
		factor => {
			if (factor === 0) {
				localStorage.removeItem(FONT_SCALE_FACTOR);
				return;
			}
			localStorage.setItem(FONT_SCALE_FACTOR, factor.toString());
		},
		{ defer: true }
	)
);

export function setLastView(view: View | null | undefined) {
	setStore("lastView", view);
}

export function setFontScaleFactor(factor: number) {
	if (factor < 0 || factor > 10) {
		return;
	}
	setStore("fontScaleFactor", factor);
}