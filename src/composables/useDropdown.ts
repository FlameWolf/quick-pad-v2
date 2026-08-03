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
		const triggerElem = trigger();
		if (!triggerElem || !show()) {
			return;
		}
		const target = event.target as Node;
		if (triggerElem.contains(target)) {
			return;
		}
		if (!autoClose && dropdown?.()?.contains(target)) {
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