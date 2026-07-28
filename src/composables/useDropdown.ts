import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";

type DropdownOptions = {
	initialState?: boolean;
	autoClose?: boolean;
	dropdown?: Accessor<HTMLElement | undefined>;
};

export function useDropdown(trigger: Accessor<HTMLElement | undefined>, { initialState = false, autoClose = true, dropdown }: DropdownOptions = {}) {
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
		if (triggerElement.contains(target)) {
			return;
		}
		if (!autoClose) {
			const protectedElement = dropdown?.();
			if (protectedElement?.contains(target)) {
				return;
			}
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