import { createStore } from "solid-js/store";
import { emptyString } from "@/constants/common";

export type ConfirmVariant = "danger" | "primary" | "warning";
export interface ConfirmOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmVariant;
}
export interface ConfirmState {
	visible: boolean;
	title: string;
	message: string;
	confirmText: string;
	cancelText: string;
	variant: ConfirmVariant;
}

const [state, setState] = createStore<ConfirmState>({
	visible: false,
	title: emptyString,
	message: emptyString,
	confirmText: "Confirm",
	cancelText: "Cancel",
	variant: "primary"
});

let resolver: ((value: boolean) => void) | null = null;

export function useConfirmDialog() {
	function confirm(options: ConfirmOptions): Promise<boolean> {
		return new Promise(resolve => {
			if (resolver) {
				resolver(false);
			}
			setState({
				visible: true,
				title: options.title,
				message: options.message,
				confirmText: options.confirmText ?? "Confirm",
				cancelText: options.cancelText ?? "Cancel",
				variant: options.variant ?? "primary"
			});
			resolver = resolve;
		});
	}

	function onConfirm() {
		const r = resolver;
		resolver = null;
		setState("visible", false);
		if (r) {
			r(true);
		}
	}

	function onCancel() {
		const r = resolver;
		resolver = null;
		setState("visible", false);
		if (r) {
			r(false);
		}
	}

	return {
		state,
		confirm,
		onConfirm,
		onCancel
	};
}