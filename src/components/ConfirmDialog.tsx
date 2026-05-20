import { onMount, onCleanup, Show } from "solid-js";
import { useConfirmDialog } from "@/composables/useConfirmDialog";

export default function ConfirmDialog() {
	const { state, onConfirm, onCancel } = useConfirmDialog();

	function onKeyDown(e: KeyboardEvent) {
		if (!state.visible) {
			return;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		} else if (e.key === "Enter") {
			e.preventDefault();
			onConfirm();
		}
	}

	onMount(() => {
		window.addEventListener("keydown", onKeyDown);
	});

	onCleanup(() => {
		window.removeEventListener("keydown", onKeyDown);
	});

	return (
		<div
			class="confirm-overlay"
			data-visible={state.visible}
			onClick={e => {
				if (e.target === e.currentTarget) {
					onCancel();
				}
			}}
		>
			<Show when={state.visible}>
				<div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
					<h5 id="confirm-title" class="confirm-title">
						{state.title}
					</h5>
					<p class="confirm-message">{state.message}</p>
					<div class="confirm-actions">
						<button type="button" class="btn btn-outline-secondary" onClick={() => onCancel()}>
							{state.cancelText}
						</button>
						<button type="button" class={`btn btn-${state.variant}`} onClick={() => onConfirm()} autofocus>
							{state.confirmText}
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
}