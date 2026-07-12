import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";

export function useDropdown(trigger: Accessor<HTMLElement | undefined>, initialState: boolean = false) {
	const [show, setShow] = createSignal(initialState);

	function toggle() {
		setShow(!show());
	}

	function clickedOutside(event: MouseEvent) {
		const triggerElement = trigger();
		if (!triggerElement || !show()) {
			return;
		}
		const target = event.target as Node;
		if (triggerElement === target || triggerElement.contains(target)) {
			return;
		}
		setShow(false);
	}

	onMount(() => {
		document.addEventListener("click", clickedOutside);
	});

	onCleanup(() => {
		document.removeEventListener("click", clickedOutside);
	});

	return {
		show,
		toggle
	};
}