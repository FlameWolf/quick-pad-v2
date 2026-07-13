import { createSignal } from "solid-js";

export enum Theme {
	Dark = "dark",
	Light = "light"
}

const [activeTheme, setActiveTheme] = createSignal(
	(() => {
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme === Theme.Dark || savedTheme === Theme.Light) {
			return savedTheme;
		}
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? Theme.Dark : Theme.Light;
	})()
);

function applyTheme(newTheme: Theme): void {
	setActiveTheme(newTheme);
	document.documentElement.setAttribute("data-bs-theme", newTheme);
	localStorage.setItem("theme", newTheme);
}

function toggleTheme(): void {
	applyTheme(activeTheme() === Theme.Dark ? Theme.Light : Theme.Dark);
}

applyTheme(activeTheme());

export function useTheme() {
	return {
		activeTheme,
		toggleTheme
	};
}