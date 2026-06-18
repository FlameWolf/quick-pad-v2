import { useTheme } from "@/composables/useTheme";
import Icon from "@/components/Icon";

export default function ThemeToggle() {
	const { isDark, setIsDark, applyTheme } = useTheme();

	function toggleTheme() {
		setIsDark(!isDark());
		applyTheme(isDark());
	}

	return (
		<button class="btn btn-secondary btn-sm" onClick={toggleTheme}>
			<Icon type={isDark() ? "moonStarsFill" : "sunFill"}/>
		</button>
	);
}