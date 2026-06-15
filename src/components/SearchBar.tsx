import { createMemo, Show } from "solid-js";
import * as store from "@/stores/notes";
import { debounce } from "@/utils/timing";
import { emptyString } from "@/constants/common";

interface Props {
	disabled: boolean;
}

export default function SearchBar(props: Props) {
	let searchInput!: HTMLInputElement;
	const isSearchMode = createMemo(() => !!store.searchText());
	const debouncedSearch = debounce(() => {
		store.setSearchText(searchInput.value?.trim() ?? emptyString);
	}, 300);

	function clearSearch() {
		debouncedSearch.cancel();
		store.setSearchText(emptyString);
		searchInput.value = emptyString;
	}

	return (
		<div class="me-auto position-relative">
		<input type="text" class="form-control pe-5" placeholder="Search" ref={searchInput} disabled={props.disabled} onInput={debouncedSearch}/>
		<Show when={isSearchMode()}>
			<button class="btn-close small position-absolute top-50 end-0 translate-middle-y me-2" onClick={clearSearch}></button>
		</Show>
	</div>
	);
}