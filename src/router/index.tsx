import { Route, Navigate, useBeforeLeave, useLocation } from "@solidjs/router";
import { createEffect, createSignal, on, Show } from "solid-js";
import DisplayNoteList from "@/components/DisplayNoteList";
import EditNote from "@/components/EditNote";

export const listViewRoutes = ["/notes", "/notes/archive", "/notes/trash"];
const scrollPositions = new Map<string, number>();

export function ScrollRestore() {
	const location = useLocation();
	const [isNavigating, setIsNavigating] = createSignal(false);

	useBeforeLeave(() => {
		const fromPath = location.pathname;
		if (listViewRoutes.includes(fromPath)) {
			scrollPositions.set(fromPath, globalThis.scrollY);
		}
		setIsNavigating(true);
	});

	createEffect(
		on(
			() => location.pathname,
			toPath => {
				const scrollTop = (listViewRoutes.includes(toPath) && scrollPositions.get(toPath)) || 0;
				setTimeout(() => {
					globalThis.scrollTo(0, scrollTop);
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

export function Routes() {
	return (
		<>
			<Route path="/" component={() => <Navigate href="/notes"/>}/>
			<Route path="/archive" component={() => <Navigate href="/notes/archive"/>}/>
			<Route path="/trash" component={() => <Navigate href="/notes/trash"/>}/>
			<Route path="/notes" component={() => <DisplayNoteList view="active"/>}/>
			<Route path="/notes/archive" component={() => <DisplayNoteList view="archived"/>}/>
			<Route path="/notes/trash" component={() => <DisplayNoteList view="trash"/>}/>
			<Route path="/notes/new" component={EditNote}/>
			<Route path="/notes/:id" component={EditNote}/>
		</>
	);
}