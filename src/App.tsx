import { createSignal, createMemo, createEffect, on, onMount, onCleanup, Show, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { useTheme } from "@/composables/useTheme";
import { useGoogleAuth } from "@/composables/useGoogleAuth";
import { useNotesSync } from "@/composables/useNotesSync";
import { searchText, setSearchText, purgeExpiredTrash } from "@/stores/notes";
import { listViewRoutes, ScrollRestore } from "@/router";
import { debounce, emptyString } from "@/library";
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
	const { isSyncing, lastSyncedAt, syncError, autoSyncEnabled, lastSyncMessage, saveToCloud, loadFromCloud, requestSync, setAutoSync, dismissMessage } = useNotesSync();
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

	async function handleSave() {
		closeSyncMenu();
		await saveToCloud();
	}

	async function handleLoad() {
		closeSyncMenu();
		await loadFromCloud();
	}

	function handleSignOut() {
		closeSyncMenu();
		signOut();
	}

	function handleToggleAutoSync() {
		setAutoSync(!autoSyncEnabled());
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
		on([isSignedIn, autoSyncEnabled], async ([signedIn, autoEnabled]) => {
			if (signedIn && autoEnabled) {
				await loadFromCloud();
				await saveToCloud();
			}
		})
	);

	onMount(() => {
		const purgedIds = purgeExpiredTrash();
		if (purgedIds.length > 0) {
			requestSync(purgedIds);
		}
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
											<i class="bi bi-cloud-slash" aria-hidden="true"></i>
											<span class="d-none d-sm-inline ms-1">Sign-in unavailable</span>
										</button>
									</Show>
								}>
								<Show
									when={isSignedIn()}
									fallback={
										<button class="btn btn-outline-primary btn-sm" onClick={signIn} aria-label="Sign in with Google">
											<i class="bi bi-google" aria-hidden="true"></i>
										</button>
									}>
									<div class="position-relative">
										<button class="d-flex flex-nowrap btn btn-outline-secondary btn-sm" onClick={toggleSyncMenu} disabled={isSyncing()} title={syncError() ? `Sync error: ${syncError()}` : "Google Drive Sync"} aria-label="Google Drive Sync">
											<Show
												when={!isSyncing()}
												fallback={
													<span>
														<i class="spinner-border spinner-border-sm" role="status"></i>
													</span>
												}>
												<Show
													when={syncError()}
													fallback={
														<Show
															when={lastSyncedAt()}
															fallback={
																<span>
																	<i class="bi bi-cloud"></i>
																</span>
															}>
															<span class="text-success">
																<i class="bi bi-check2"></i>
															</span>
														</Show>
													}>
													<span class="text-warning">
														<i class="bi bi-exclamation-triangle"></i>
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
												<button class="dropdown-item sync-dropdown-item" onClick={handleSave} disabled={isSyncing()}>
													<i class="bi bi-cloud-upload me-2" aria-hidden="true"></i>
													<span>Save to Drive</span>
												</button>
												<button class="dropdown-item sync-dropdown-item" onClick={handleLoad} disabled={isSyncing()}>
													<i class="bi bi-cloud-download me-2" aria-hidden="true"></i>
													<span>Load from Drive</span>
												</button>
												<Show when={lastSyncedLabel()}>
													<div class="dropdown-header text-muted small px-3 py-1">Last synced: {lastSyncedLabel()}</div>
												</Show>
												<div class="dropdown-divider"></div>
												<button class="dropdown-item sync-dropdown-item text-danger" onClick={handleSignOut}>
													<i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>
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
							<i class={`bi ${isDark() ? "bi-moon-stars-fill" : "bi-sun-fill"}`}></i>
						</button>
					</div>
				</div>
			</nav>
			<main class="container px-2 pb-4">
				{props.children}
				<div class="d-flex flex-column gap-1 position-fixed bottom-0 end-0 opacity-75 mb-2 me-2">
					<button class="btn btn-secondary btn-sm" onClick={() => scrollToPosition("top")}>
						<i class="bi bi-chevron-up"></i>
					</button>
					<button class="btn btn-secondary btn-sm" onClick={() => scrollToPosition("bottom")}>
						<i class="bi bi-chevron-down"></i>
					</button>
				</div>
			</main>
			<Show when={lastSyncMessage()}>
				<Toast message={lastSyncMessage()!.text} type={lastSyncMessage()!.type} visible={!!lastSyncMessage()} timeStamp={lastSyncMessage()!.timeStamp} onDismiss={dismissMessage}/>
			</Show>
			<ConfirmDialog/>
			<ScrollRestore/>
		</>
	);
}