import "@/styles.css";
import { createMemo, createResource, onMount, Show, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { listViewRoutes, RouteTransition } from "@/router";
import { hydrateNotes, purgeExpiredTrash } from "@/stores/notes";
import { hydrateAuthState } from "@/composables/useGoogleAuth";
import { hydrateSortPrefs } from "@/composables/useNoteSort";
import { hydrateSyncMetadata, useNotesSync } from "@/composables/useNotesSync";
import { useNoteDraft } from "@/composables/useNoteDraft";
import SearchBar from "@/components/SearchBar";
import ThemeToggle from "@/components/ThemeToggle";
import Toast from "@/components/Toast";
import SyncControls from "@/components/SyncControls";
import Icon from "@/components/Icon";
import ScrollButtons from "@/components/ScrollButtons";
import ConfirmDialog from "@/components/ConfirmDialog";

interface AppProps {
	children?: JSX.Element;
}

export default function App(props: AppProps) {
	const location = useLocation();
	const { dismissMessage, lastSyncMessage, requestSync } = useNotesSync();
	const { purgeStaleDrafts } = useNoteDraft();
	const searchDisabled = createMemo(() => !listViewRoutes.includes(location.pathname));
	const [isHydrated] = createResource(
		() =>
			new Promise<boolean>(resolve => {
				Promise.all([hydrateSortPrefs(), hydrateSyncMetadata(), hydrateAuthState(), hydrateNotes()])
					.then(() => resolve(true))
					.catch(() => resolve(false));
			})
	);

	onMount(async () => {
		if (isHydrated()) {
			const purgedIds = await purgeExpiredTrash();
			if (purgedIds.length > 0) {
				requestSync(purgedIds);
			}
		}
		purgeStaleDrafts();
	});

	return (
		<>
			<nav class="navbar navbar-expand bg-body-tertiary border-bottom px-2 mb-4">
				<div class="container gap-2">
					<A href="/notes" class="navbar-brand">
						<img class="logo" src="/logo.svg" alt="QuickPad Logo"/>
					</A>
					<SearchBar disabled={searchDisabled()}/>
					<div class="d-flex align-items-center gap-2">
						<SyncControls/>
						<ThemeToggle/>
					</div>
				</div>
			</nav>
			<main class="flex-grow-1 container px-2 pb-4">{props.children}</main>
			<footer class="bg-body-tertiary border-top mt-4">
				<div class="d-flex flex-wrap justify-content-center align-items-center gap-3 small text-muted px-2 py-3">
					<span>QuickPad</span>
					<A href="/privacy" class="link-secondary text-decoration-none">Privacy Policy</A>
					<A href="/terms" class="link-secondary text-decoration-none">Terms of Service</A>
					<a target="_blank" href="https://github.com/FlameWolf/quick-pad-v2" class="icon-link link-secondary text-decoration-none">
						<Icon type="codeSlash"/>
						<span>Source</span>
					</a>
				</div>
			</footer>
			<ScrollButtons/>
			<Show when={lastSyncMessage()}>
				<Toast message={lastSyncMessage()!.text} type={lastSyncMessage()!.type} timeStamp={lastSyncMessage()!.timeStamp} onDismiss={dismissMessage}/>
			</Show>
			<ConfirmDialog/>
			<RouteTransition/>
		</>
	);
}