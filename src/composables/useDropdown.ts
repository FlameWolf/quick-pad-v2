import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";

const listenerOptions: AddEventListenerOptions = { capture: true };

export function useDropdown(trigger: Accessor<HTMLElement | undefined>, dropdown: Accessor<HTMLElement | undefined>, initialState: boolean = false) {
	const [show, setShow] = createSignal(initialState);

	function toggle() {
		setShow(!show());
	}

	function clickedOutside(event: MouseEvent) {
		const triggerElement = trigger();
		const dropdownElement = dropdown();
		if (!triggerElement || !dropdownElement || !show()) {
			return;
		}
		const target = event.target as Node;
		if (triggerElement === target || triggerElement.contains(target)) {
			return;
		}
		if (!dropdownElement.contains(target)) {
			event.preventDefault();
			event.stopPropagation();
		}
		setShow(false);
	}

	onMount(() => {
		document.addEventListener("click", clickedOutside, listenerOptions);
	});

	onCleanup(() => {
		document.removeEventListener("click", clickedOutside, listenerOptions);
	});

	return {
		show,
		toggle
	};
}