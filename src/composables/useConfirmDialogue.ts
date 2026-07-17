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

let resolver: ((value: boolean) => void) | null = null;
const [params, setParams] = createStore<ConfirmState>({
	visible: false,
	title: emptyString,
	message: emptyString,
	confirmText: "Confirm",
	cancelText: "Cancel",
	variant: "primary"
});
export const state = params;

export function confirm(options: ConfirmOptions): Promise<boolean> {
	return new Promise(resolve => {
		if (resolver) {
			resolver(false);
		}
		setParams({
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

export function onConfirm() {
	const r = resolver;
	resolver = null;
	setParams("visible", false);
	if (r) {
		r(true);
	}
}

export function onCancel() {
	const r = resolver;
	resolver = null;
	setParams("visible", false);
	if (r) {
		r(false);
	}
}