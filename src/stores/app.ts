import { createStore } from "solid-js/store";

interface AppState {
	lastView: View | null | undefined;
}

const [store, setStore] = createStore<AppState>({
	lastView: undefined
});
export const lastView = () => store.lastView;
export function setLastView(view: View | null | undefined) {
	setStore("lastView", view);
}