import { createSignal } from "solid-js";

const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const [isDark, setIsDark] = createSignal(mediaQuery.matches);

function applyTheme(dark: boolean) {
	document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
}

let isListening = false;

function handleChange(e: MediaQueryListEvent) {
	setIsDark(e.matches);
	applyTheme(e.matches);
}

export function useTheme() {
	if (!isListening) {
		applyTheme(isDark());
		mediaQuery.addEventListener("change", handleChange);
		isListening = true;
	}

	return {
		isDark,
		setIsDark,
		applyTheme
	};
}