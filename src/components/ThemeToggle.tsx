import { createMemo } from "solid-js";
import { Theme, useTheme } from "@/composables/useTheme";
import Icon from "@/components/Icon";

export default function ThemeToggle() {
	const { activeTheme, toggleTheme } = useTheme();
	const isDark = createMemo(() => activeTheme() === Theme.Dark);

	return (
		<button class="btn btn-secondary btn-sm" onClick={toggleTheme}>
			<Icon type={isDark() ? "moonStarsFill" : "sunFill"}/>
		</button>
	);
}