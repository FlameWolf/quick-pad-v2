import { For } from "solid-js";
import { colours } from "@/constants/colours";
import * as notesStore from "@/stores/notes";

type Props = {
	mode?: "filter" | "edit";
	current?: Colour;
	onSelectionChanged?: (colour: Colour) => void;
};

export default function DisplayColourList(props: Props) {
	function isActive(colour: Colour) {
		switch (props.mode) {
			case "edit": {
				return props.current === colour;
			}
			default: {
				return notesStore.searchColours().has(colour);
			}
		}
	}

	return (
		<div class="d-flex flex-wrap gap-2 p-2 border rounded">
			<For each={colours}>{colour => <a class="colour-circle rounded-circle" classList={{ [`bg-${colour}`]: true, active: isActive(colour) }} onClick={() => props.onSelectionChanged?.(colour)} role="button" aria-label={colour}></a>}</For>
		</div>
	);
}