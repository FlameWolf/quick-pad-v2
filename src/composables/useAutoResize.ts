import { Accessor, createEffect, on, onCleanup, onMount } from "solid-js";

export function useAutoResize(editor: Readonly<HTMLTextAreaElement | null>, content: Accessor<string>, enabled: Accessor<boolean>) {
	function adjustHeight() {
		if (CSS.supports("field-sizing", "content") || !enabled()) {
			return;
		}
		const editorParent = editor?.parentElement;
		if (!editorParent) {
			return;
		}
		const editorClone = editor.cloneNode() as HTMLTextAreaElement;
		editorClone.classList.add("d-hidden");
		editorClone.style.setProperty("height", "auto");
		editorClone.value = content();
		editorParent.appendChild(editorClone);
		editor.style.setProperty("height", `calc(${editorClone.scrollHeight}px + 0.5rem)`);
		editorParent.removeChild(editorClone);
	}

	onMount(() => {
		window.addEventListener("resize", adjustHeight);
	});

	onCleanup(() => {
		window.removeEventListener("resize", adjustHeight);
	});

	createEffect(on(content, adjustHeight, { defer: true }));

	return { adjustHeight };
}