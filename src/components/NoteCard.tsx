import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { Note } from "@/models/Note";
import { emptyString } from "@/constants/common";
import Icon from "@/components/Icon";
import type { UUID } from "node:crypto";

interface Props {
	currentView: View;
	note: Note;
	selectionMode: boolean;
	selected: boolean;
	clickAction: (e: MouseEvent, id: UUID) => void;
}

function formatDate(date?: Date): string {
	if (!date) {
		return emptyString;
	}
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NoteCard(props: Props) {
	const note = () => props.note;
	const isSelectionMode = () => props.selectionMode;
	const isSelected = () => props.selected;

	return (
		<A href={`/notes/${note().id}?from=${props.currentView}`} class="card note-card text-decoration-none position-relative" classList={{ selected: isSelectionMode() && isSelected() }} onClick={e => props.clickAction(e, note().id)}>
			<div class="d-flex gap-2 small position-absolute top-0 p-2 status-badge">
				<Show when={note().pinnedAt}>
					<Icon type="pinAngleFill"/>
				</Show>
				<Show when={note().favedAt}>
					<Icon type="starFill"/>
				</Show>
			</div>
			<div class="card-body d-flex flex-column">
				<Show when={props.selectionMode}>
					<input type="checkbox" class="form-check-input selection-checkbox rounded-circle" checked={isSelected()}/>
				</Show>
				<div class="d-flex gap-1 mb-2">
					<div class="text-truncate">{note().title}</div>
					<div class="badge align-self-center text-muted border ms-auto">{formatDate(note().modifiedAt ?? note().createdAt)}</div>
				</div>
				<p class="card-text text-muted small overflow-hidden">{note().summary}</p>
			</div>
			<div class="d-flex gap-1 small w-100 position-absolute bottom-0 px-2 py-2 border-top">
				<Show when={note().sentenceCount}>
					<div class="badge text-bg-secondary">{note().sentenceCount} sentences</div>
				</Show>
				<Show when={note().wordCount}>
					<div class="badge text-bg-secondary">{note().wordCount} words</div>
				</Show>
				<Show when={note().characterCount}>
					<div class="badge text-bg-secondary">{note().characterCount} characters</div>
				</Show>
			</div>
		</A>
	);
}