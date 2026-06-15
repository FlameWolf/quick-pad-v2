import { createSignal, createMemo, createEffect, on, onMount, onCleanup, Show, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { useTheme } from "@/composables/useTheme";
import { useGoogleAuth } from "@/composables/useGoogleAuth";
import { useNotesSync } from "@/composables/useNotesSync";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { searchText, setSearchText, purgeExpiredTrash, isLoading } from "@/stores/notes";
import { listViewRoutes, ScrollRestore } from "@/router";
import { emptyString } from "@/constants/common";
import { debounce } from "@/utils/timing";
import Toast from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface AppProps {
	children?: JSX.Element;
}

export default function App(props: AppProps) {
	let readyTimeout: ReturnType<typeof setTimeout> | null = null;
	let searchInput!: HTMLInputElement;
	const { isDark, setIsDark, applyTheme } = useTheme();
	const { isSignedIn, isReady, isConfigured, user, tryRestoreSession, signIn, signOut } = useGoogleAuth();
	const { isSyncing, lastSyncedAt, syncError, autoSyncEnabled, lastSyncMessage, doPullAndPush, requestSync, setAutoSync, dismissMessage } = useNotesSync();
	const { confirm } = useConfirmDialog();
	const location = useLocation();
	const [showSyncMenu, setShowSyncMenu] = createSignal(false);
	const [authTimedOut, setAuthTimedOut] = createSignal(false);
	const isSearchMode = createMemo(() => !!searchText());
	const searchDisabled = createMemo(() => !listViewRoutes.includes(location.pathname));

	function toggleTheme() {
		const next = !isDark();
		setIsDark(next);
		applyTheme(next);
	}

	const debouncedSearch = debounce(() => {
		setSearchText(searchInput?.value?.trim() ?? emptyString);
	}, 300);

	function clearSearch() {
		debouncedSearch.cancel();
		setSearchText(emptyString);
		if (searchInput) {
			searchInput.value = emptyString;
		}
	}

	function toggleSyncMenu() {
		setShowSyncMenu(prev => !prev);
	}

	function closeSyncMenu() {
		setShowSyncMenu(false);
	}

	async function handleSync(force = false) {
		closeSyncMenu();
		if (!force) {
			await doPullAndPush();
			return;
		}
		const ok = await confirm({
			title: "Force Sync",
			message: "This will pull and push all notes from cloud and local. It might take more time and use more data than a normal sync. Are you sure you want to continue?",
			confirmText: "Yes",
			cancelText: "Cancel",
			variant: "warning"
		});
		if (ok) {
			await doPullAndPush({ force: true });
		}
	}

	async function handleSignOut() {
		closeSyncMenu();
		await signOut();
	}

	async function handleToggleAutoSync() {
		await setAutoSync(!autoSyncEnabled());
	}

	function scrollToPosition(position: "top" | "bottom") {
		const element = document.documentElement;
		element.scrollTo({
			top: position === "top" ? 0 : element.scrollHeight,
			behavior: "smooth"
		});
	}

	const lastSyncedLabel = createMemo(() => {
		const ts = lastSyncedAt();
		if (!ts) {
			return null;
		}
		const diff = Date.now() - ts.getTime();
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) {
			return "just now";
		}
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}m ago`;
		}
		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `${hours}h ago`;
		}
		return ts.toLocaleDateString();
	});

	createEffect(
		on([isSignedIn, autoSyncEnabled], ([signedIn, autoEnabled]) => {
			if (signedIn && autoEnabled) {
				setTimeout(async () => {
					await doPullAndPush();
				});
			}
		})
	);

	createEffect(
		on(
			isLoading,
			async loading => {
				if (loading) {
					return;
				}
				const purgedIds = await purgeExpiredTrash();
				if (purgedIds.length > 0) {
					requestSync(purgedIds);
				}
			},
			{ defer: true }
		)
	);

	onMount(() => {
		if (isConfigured()) {
			readyTimeout = setTimeout(() => {
				if (!isReady()) {
					setAuthTimedOut(true);
				}
			}, 6000);
		}
		tryRestoreSession();
	});

	onCleanup(() => {
		if (readyTimeout) {
			clearTimeout(readyTimeout);
		}
	});

	return (
		<>
			<nav class="navbar navbar-expand bg-body-tertiary border-bottom px-2 mb-4">
				<div class="container gap-2">
					<A href="/notes" class="navbar-brand">
						<img class="logo" src="/logo.svg" alt="QuickPad Logo"/>
					</A>
					<div class="me-auto position-relative">
						<input type="text" class="form-control pe-5" placeholder="Search" ref={searchInput} disabled={searchDisabled()} onInput={debouncedSearch}/>
						<Show when={isSearchMode()}>
							<button class="btn-close small position-absolute top-50 end-0 translate-middle-y me-2" onClick={clearSearch}></button>
						</Show>
					</div>
					<div class="d-flex align-items-center gap-2">
						<Show when={isConfigured()}>
							<Show
								when={isReady()}
								fallback={
									<Show
										when={authTimedOut()}
										fallback={
											<button class="btn btn-outline-secondary btn-sm" disabled aria-label="Initialising Google Sign-In">
												<span class="spinner-border spinner-border-sm" role="status"></span>
											</button>
										}>
										<button class="btn btn-outline-secondary btn-sm" disabled title="Google Sign-In library could not be loaded">
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-slash" viewBox="0 0 16 16">
												<path fill-rule="evenodd" d="M3.112 5.112a3 3 0 0 0-.17.613C1.266 6.095 0 7.555 0 9.318 0 11.366 1.708 13 3.781 13H11l-1-1H3.781C2.231 12 1 10.785 1 9.318c0-1.365 1.064-2.513 2.46-2.666l.446-.05v-.447q0-.113.018-.231zm2.55-1.45-.725-.725A5.5 5.5 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773a3.2 3.2 0 0 1-1.516 2.711l-.733-.733C14.498 11.378 15 10.626 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3c-.875 0-1.678.26-2.339.661z"/>
												<path d="m13.646 14.354-12-12 .708-.708 12 12z"/>
											</svg>
											<span class="d-none d-sm-inline ms-1">Sign-in unavailable</span>
										</button>
									</Show>
								}>
								<Show
									when={isSignedIn()}
									fallback={
										<button class="btn btn-outline-primary btn-sm" onClick={signIn} aria-label="Sign in with Google">
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-google" viewBox="0 0 16 16">
												<path d="M15.545 6.558a9.4 9.4 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.7 7.7 0 0 1 5.352 2.082l-2.284 2.284A4.35 4.35 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.8 4.8 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.7 3.7 0 0 0 1.599-2.431H8v-3.08z"/>
											</svg>
										</button>
									}>
									<div class="position-relative">
										<button class="d-flex flex-nowrap btn btn-outline-secondary btn-sm" onClick={toggleSyncMenu} disabled={isSyncing()} title={syncError() ? `Sync error: ${syncError()}` : "Google Drive Sync"} aria-label="Google Drive Sync">
											<Show
												when={!isSyncing()}
												fallback={
													<span>
														<div class="spinner-border spinner-border-sm" role="status"></div>
													</span>
												}>
												<Show
													when={syncError()}
													fallback={
														<Show
															when={lastSyncedAt()}
															fallback={
																<span>
																	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud" viewBox="0 0 16 16">
																		<path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383m.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
																	</svg>
																</span>
															}>
															<span class="text-success">
																<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2" viewBox="0 0 16 16">
																	<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
																</svg>
															</span>
														</Show>
													}>
													<span class="text-warning">
														<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle" viewBox="0 0 16 16">
															<path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/>
															<path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
														</svg>
													</span>
												</Show>
											</Show>
											<span class="d-none d-md-inline">
												<span>&#xA0;</span>
												<span>{user()?.name ?? "Sync"}</span>
											</span>
										</button>
										<Show when={showSyncMenu()}>
											<div class="dropdown-menu show sync-dropdown">
												<div class="dropdown-header text-muted small px-3 py-1 text-truncate">{user()?.email}</div>
												<div class="dropdown-divider"></div>
												<label class="dropdown-item sync-dropdown-item d-flex align-items-center gap-2 mb-0">
													<input type="checkbox" checked={autoSyncEnabled()} class="form-check-input m-0" onChange={handleToggleAutoSync}/>
													<span>Auto-sync</span>
												</label>
												<div class="dropdown-divider"></div>
												<button class="dropdown-item sync-dropdown-item" onClick={() => handleSync(false)} disabled={isSyncing()}>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-repeat me-2" viewBox="0 0 16 16">
														<path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/>
														<path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
													</svg>
													<span>Sync</span>
												</button>
												<button class="dropdown-item sync-dropdown-item" onClick={() => handleSync(true)} disabled={isSyncing()}>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lightning-charge me-2" viewBox="0 0 16 16">
														<path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09zM4.157 8.5H7a.5.5 0 0 1 .478.647L6.11 13.59l5.732-6.09H9a.5.5 0 0 1-.478-.647L9.89 2.41z"/>
													</svg>
													<span>Force Sync</span>
												</button>
												<Show when={lastSyncedLabel()}>
													<div class="dropdown-header text-muted small px-3 py-1">Last synced: {lastSyncedLabel()}</div>
												</Show>
												<div class="dropdown-divider"></div>
												<button class="dropdown-item sync-dropdown-item text-danger" onClick={handleSignOut}>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-right me-2" viewBox="0 0 16 16">
														<path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/>
														<path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>
													</svg>
													<span>Sign out</span>
												</button>
											</div>
										</Show>
									</div>
									<Show when={showSyncMenu()}>
										<div class="sync-backdrop" onClick={closeSyncMenu}></div>
									</Show>
								</Show>
							</Show>
						</Show>
						<button class="btn btn-secondary btn-sm" onClick={toggleTheme}>
							<Show
								when={isDark()}
								fallback={
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sun-fill" viewBox="0 0 16 16">
										<path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
									</svg>
								}>
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-moon-stars-fill" viewBox="0 0 16 16">
									<path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278"/>
									<path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
								</svg>
							</Show>
						</button>
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
			<div class="d-flex flex-column gap-1 position-fixed bottom-0 end-0 opacity-75 mb-2 me-2">
				<button class="btn btn-secondary btn-sm" onClick={() => scrollToPosition("top")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-up" viewBox="0 0 16 16">
						<path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708z"/>
					</svg>
				</button>
				<button class="btn btn-secondary btn-sm" onClick={() => scrollToPosition("bottom")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
						<path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
					</svg>
				</button>
			</div>
			<Show when={lastSyncMessage()}>
				<Toast message={lastSyncMessage()!.text} type={lastSyncMessage()!.type} visible={!!lastSyncMessage()} timeStamp={lastSyncMessage()!.timeStamp} onDismiss={dismissMessage}/>
			</Show>
			<ConfirmDialog/>
			<ScrollRestore/>
		</>
	);
}