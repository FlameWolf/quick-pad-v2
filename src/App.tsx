import { createMemo, Show, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { useNotesSync } from "@/composables/useNotesSync";
import { listViewRoutes, ScrollRestore } from "@/router";
import SearchBar from "@/components/SearchBar";
import ThemeToggle from "@/components/ThemeToggle";
import ScrollButtons from "@/components/ScrollButtons";
import Toast from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import SyncControls from "@/components/SyncControls";

interface AppProps {
	children?: JSX.Element;
}

export default function App(props: AppProps) {
	const { lastSyncMessage, dismissMessage } = useNotesSync();
	const location = useLocation();
	const searchDisabled = createMemo(() => !listViewRoutes.includes(location.pathname));

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
			<main class="flex-grow-1 container px-2 pb-4">
				{props.children}
			</main>
			<footer class="bg-body-tertiary border-top mt-4">
				<div class="d-flex flex-wrap justify-content-center align-items-center gap-3 small text-muted px-2 py-3">
					<span>QuickPad</span>
					<A href="/privacy" class="link-secondary text-decoration-none">Privacy Policy</A>
					<A href="/terms" class="link-secondary text-decoration-none">Terms of Service</A>
					<a target="_blank" href="https://github.com/FlameWolf/quick-pad-v2" class="icon-link link-secondary text-decoration-none">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-code-slash" viewBox="0 0 16 16">
							<path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0m6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0"/>
						</svg>
						<span>Source</span>
					</a>
				</div>
			</footer>
			<ScrollButtons/>
			<Show when={lastSyncMessage()}>
				<Toast message={lastSyncMessage()!.text} type={lastSyncMessage()!.type} visible={!!lastSyncMessage()} timeStamp={lastSyncMessage()!.timeStamp} onDismiss={dismissMessage}/>
			</Show>
			<ConfirmDialog/>
			<ScrollRestore/>
		</>
	);
}