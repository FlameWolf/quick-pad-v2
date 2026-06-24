import { createEffect, on, onCleanup } from "solid-js";
import Icon from "@/components/Icon";

export type ToastDetails = {
	type: "success" | "error";
	timeStamp: number;
	message: string;
};
interface Props extends ToastDetails {
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

	function setDismissTimeout() {
		dismissTimeout = setTimeout(props.onDismiss, 5000);
	}

	createEffect(
		on(
			() => props.timeStamp,
			() => {
				clearDismissTimeout();
				if (props.type === "success") {
					setDismissTimeout();
				}
			}
		)
	);

	onCleanup(() => {
		clearDismissTimeout();
	});

	return (
		<div class="toast-container">
			<div class={`toast-notification rounded ${props.type}`}>
				<span class="toast-icon">
					<Icon type={props.type === "success" ? "check2" : "exclamationTriangle"}/>
				</span>
				<span class="toast-text" innerHTML={props.message}></span>
				<button class="btn-close align-self-start ms-auto" onClick={props.onDismiss}></button>
			</div>
		</div>
	);
}