import "@/styles.css";
import { getOwner, onMount, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { RouteTransition } from "@/router";
import { hydrateNotes } from "@/stores/notes";
import { setAppOwner } from "@/composables/useAppOwner";
import { purgeStaleDrafts } from "@/composables/useNoteDraft";
import Icon from "@/components/Icon";
import SearchBar from "@/components/SearchBar";
import ThemeToggle from "@/components/ThemeToggle";
import SyncControls from "@/components/SyncControls";
import ScrollButtons from "@/components/ScrollButtons";
import NotificationList from "@/components/NotificationList";
import ConfirmDialogue from "@/components/ConfirmDialogue";

interface AppProps {
	children?: JSX.Element;
}

export default function App(props: AppProps) {
	setAppOwner(getOwner());

	onMount(async () => {
		await hydrateNotes();
		purgeStaleDrafts();
	});

	return (
		<>
			<nav class="navbar navbar-expand bg-body-tertiary border-bottom px-2 mb-4">
				<div class="container gap-2">
					<A href="/notes" class="navbar-brand">
						<img class="logo" src="/logo.svg" alt="QuickPad Logo"/>
					</A>
					<SearchBar/>
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
			<NotificationList/>
			<ConfirmDialogue/>
			<RouteTransition/>
		</>
	);
}