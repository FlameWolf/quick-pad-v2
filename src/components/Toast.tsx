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
						<Show
							when={props.type === "success"}
							fallback={
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle" viewBox="0 0 16 16">
									<path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/>
									<path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
								</svg>
							}>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2" viewBox="0 0 16 16">
								<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
							</svg>
						</Show>
					</span>
					<span class="toast-text" innerHTML={props.message}></span>
					<button class="btn-close align-self-start ms-auto" onClick={props.onDismiss}></button>
				</div>
			</Show>
		</div>
	);
}