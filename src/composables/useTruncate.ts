import type { Setter } from "solid-js";
import { isTextWithin, truncate } from "@/utils/text-analysis";

export function useTruncate(setter: Setter<string>, limit: number) {
	return (event: InputEvent) => {
		const elem = event.currentTarget as HTMLInputElement;
		const content = elem.value.trim();
		if (event.isComposing || isTextWithin(content, limit)) {
			setter(content);
			return;
		}
		const start = elem.selectionStart;
		const end = elem.selectionEnd;
		setter(truncate(content, limit));
		requestAnimationFrame(() => {
			elem.setSelectionRange(start, end);
		});
	};
}