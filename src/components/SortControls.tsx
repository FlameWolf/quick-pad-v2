import { createMemo, Show } from "solid-js";
import { SortDirection, SortField } from "@/composables/useNoteSort";

interface Props {
	sortBy: SortField;
	sortDirection: SortDirection;
	sortAction: (e: Event) => void;
	toggleAction: () => void;
}

export default function SortControls(props: Props) {
	const isAscending = createMemo(() => props.sortDirection === "asc");

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
			<button class="btn btn-outline-secondary btn-sm" onClick={props.toggleAction} aria-label={isAscending() ? "Sort ascending, click to switch to descending" : "Sort descending, click to switch to ascending"} title={isAscending() ? "Ascending" : "Descending"}>
				<Show
					when={isAscending()}
					fallback={
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sort-down" viewBox="0 0 16 16">
							<path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5M7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z"/>
						</svg>
					}>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sort-up" viewBox="0 0 16 16">
						<path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.5.5 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5M7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z"/>
					</svg>
				</Show>
			</button>
		</div>
	);
}