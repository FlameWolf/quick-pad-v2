import { createMemo, onMount } from "solid-js";
import { hydrateSortPrefs, type SortDirection, type SortField } from "@/composables/useNoteSort";
import Icon from "@/components/Icon";

interface Props {
	sortBy: SortField;
	sortDirection: SortDirection;
	sortAction: (e: Event) => void;
	toggleAction: () => void;
}

export default function SortControls(props: Props) {
	const isAscending = createMemo(() => props.sortDirection === "asc");

	onMount(async () => {
		await hydrateSortPrefs();
	});

	return (
		<div class="d-flex gap-1 align-items-center sort-controls">
			<label for="sort-by-select" class="form-label text-muted small mb-0 me-1">
				Sort:
			</label>
			<select id="sort-by-select" class="form-select form-select-sm sort-select" value={props.sortBy} onChange={props.sortAction} aria-label="Sort notes by">
				<option value="modifiedAt">Updated</option>
				<option value="createdAt">Created</option>
				<option value="title">Title</option>
				<option value="sentenceCount">Sentences</option>
				<option value="wordCount">Words</option>
				<option value="characterCount">Characters</option>
			</select>
			<button class="btn btn-outline-secondary btn-sm" onClick={props.toggleAction} title={isAscending() ? "Ascending" : "Descending"} aria-label={isAscending() ? "Sort ascending, click to switch to descending" : "Sort descending, click to switch to ascending"}>
				<Icon type={isAscending() ? "sortUp" : "sortDown"}/>
			</button>
		</div>
	);
}