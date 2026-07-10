import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";

export function useDropdown(dropdownRoot: Accessor<HTMLElement | undefined>, initialState: boolean = false) {
	const [show, setShow] = createSignal(initialState);

	function toggle() {
		setShow(!show());
	}

	function clickedOutside(event: MouseEvent) {
		if (!dropdownRoot()) {
			return;
		}
		if (!dropdownRoot()!.contains(event.target as Node)) {
			setShow(false);
		}
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