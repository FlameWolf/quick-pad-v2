import { createEffect, on, onMount, onCleanup, Show } from "solid-js";

interface Props {
	message: string;
	type: "success" | "error";
	visible: boolean;
	timeStamp: number;
	onDismiss: () => void;
}

export default function Toast(props: Props) {
	let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

	function clearDismissTimeout() {
		if (dismissTimeout) {
			clearTimeout(dismissTimeout);
			dismissTimeout = null;
		}
	}

	function resetDismissTimeout() {
		clearDismissTimeout();
		dismissTimeout = setTimeout(() => props.onDismiss(), 5000);
	}

	createEffect(
		on(
			() => props.timeStamp,
			val => {
				if (val) {
					resetDismissTimeout();
				}
			},
			{ defer: true }
		)
	);

	onMount(() => {
		resetDismissTimeout();
	});

	onCleanup(() => {
		clearDismissTimeout();
	});

	return (
		<div class="toast-container" data-visible={props.visible}>
			<Show when={props.visible}>
				<div class={`toast-notification rounded ${props.type}`}>
					<span class="toast-icon">
						<Show when={props.type === "success"} fallback={<i class="bi bi-exclamation-triangle"></i>}>
							<i class="bi bi-check2"></i>
						</Show>
					</span>
					<span class="toast-text" innerHTML={props.message}></span>
					<button class="btn-close align-self-start ms-auto" onClick={props.onDismiss}></button>
				</div>
			</Show>
		</div>
	);
}