import { For } from "solid-js";

export interface SelectionAction {
	key: string;
	label: string;
	variant: "primary" | "danger" | "outline-primary" | "outline-secondary" | "outline-danger";
}

interface Props {
	selectedCount: number;
	actions: SelectionAction[];
	onAction: (key: string) => void;
	onCancel: () => void;
}

export default function SelectionActionBar(props: Props) {
	return (
		<div class="selection-action-bar">
			<span class="fw-medium">{props.selectedCount} selected</span>
			<div class="d-flex gap-2 flex-wrap">
				<For each={props.actions}>
					{action => (
						<button type="button" class={`btn btn-sm btn-${action.variant}`} onClick={() => props.onAction(action.key)}>{action.label}</button>
					)}
				</For>
				<button type="button" class="btn btn-outline-secondary btn-sm" onClick={() => props.onCancel()}>Cancel</button>
			</div>
		</div>
	);
}