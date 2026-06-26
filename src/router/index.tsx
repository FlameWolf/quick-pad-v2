import { Route, Navigate, useBeforeLeave, useLocation } from "@solidjs/router";
import { createEffect, createSignal, lazy, on, Show } from "solid-js";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import DisplayNoteList from "@/components/DisplayNoteList";
import EditNote from "@/components/EditNote";

export const listViewRoutes = ["/notes", "/notes/favourite", "/notes/archive", "/notes/trash"];
const scrollPositions = new Map<string, number>();

export function RouteTransition() {
	const location = useLocation();
	const { state: confirmState } = useConfirmDialog();
	const [isNavigating, setIsNavigating] = createSignal(false);

	useBeforeLeave(event => {
		const fromPath = location.pathname;
		if (listViewRoutes.includes(fromPath)) {
			scrollPositions.set(fromPath, globalThis.scrollY);
		}
		if (!event.defaultPrevented) {
			setIsNavigating(true);
		}
	});

	createEffect(
		on(
			() => confirmState.visible,
			visible => {
				if (visible && isNavigating()) {
					setIsNavigating(false);
				}
			}
		)
	);

	createEffect(
		on(
			() => location.pathname,
			toPath => {
				const scrollTop = (listViewRoutes.includes(toPath) && scrollPositions.get(toPath)) || 0;
				setTimeout(() => {
					window.scrollTo({
						top: scrollTop,
						behavior: "instant"
					});
				});
				setIsNavigating(false);
			}
		)
	);

	return (
		<Show when={isNavigating()}>
			<div class="nav-overlay"></div>
		</Show>
	);
}

function getBackRoute(path: string) {
	if (listViewRoutes.includes(path)) {
		return path;
	}
	return undefined;
}

export function Routes() {
	return (
		<>
			<Route path="/" component={() => <Navigate href="/notes"/>}/>
			<Route path="/favourite" component={() => <Navigate href="/notes/favourite"/>}/>
			<Route path="/archive" component={() => <Navigate href="/notes/archive"/>}/>
			<Route path="/trash" component={() => <Navigate href="/notes/trash"/>}/>
			<Route path="/notes" component={() => <DisplayNoteList view="active"/>}/>
			<Route path="/notes/favourite" component={() => <DisplayNoteList view="favourited"/>}/>
			<Route path="/notes/archive" component={() => <DisplayNoteList view="archived"/>}/>
			<Route path="/notes/trash" component={() => <DisplayNoteList view="trash"/>}/>
			<Route path="/notes/new" component={() => <EditNote/>}/>
			<Route path="/notes/:id" component={() => <EditNote backRoute={getBackRoute(location.pathname)}/>}/>
			<Route path="/privacy" component={lazy(() => import("@/components/PrivacyPolicy"))}/>
			<Route path="/terms" component={lazy(() => import("@/components/TermsOfService"))}/>
		</>
	);
}