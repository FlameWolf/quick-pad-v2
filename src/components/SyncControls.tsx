import { createSignal, createMemo, createEffect, on, onMount, onCleanup, Show } from "solid-js";
import { isLoading, purgeExpiredTrash } from "@/stores/notes";
import { hydrateAuthState, isConfigured, isReady, isSignedIn, signIn, signOut, tryRestoreSession, user } from "@/composables/useGoogleAuth";
import { autoSyncEnabled, doPullAndPush, hydrateSyncMetadata, isSyncing, lastSyncedAt, requestSync, setAutoSync, syncError } from "@/composables/useNotesSync";
import { useDropdown } from "@/composables/useDropdown";
import { confirm } from "@/composables/useConfirmDialogue";
import Icon from "@/components/Icon";

export default function SyncControls() {
	let readyTimeout: ReturnType<typeof setTimeout> | null = null;
	const [syncMenuTrigger, setSyncMenuTrigger] = createSignal<HTMLButtonElement | undefined>();
	const { show: showSyncMenu, toggle: toggleSyncMenu } = useDropdown(syncMenuTrigger);
	const [authTimedOut, setAuthTimedOut] = createSignal(false);

	async function handleSync(force = false) {
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
		await signOut();
	}

	async function handleToggleAutoSync() {
		await setAutoSync(!autoSyncEnabled());
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
		on([isSignedIn, autoSyncEnabled], ([signedIn, autoSync]) => {
			if (signedIn && autoSync) {
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

	onMount(async () => {
		if (isConfigured) {
			readyTimeout = setTimeout(() => {
				if (!isReady()) {
					setAuthTimedOut(true);
				}
			}, 6000);
		}
		await hydrateAuthState();
		await hydrateSyncMetadata();
		tryRestoreSession();
	});

	onCleanup(() => {
		if (readyTimeout) {
			clearTimeout(readyTimeout);
		}
	});

	return (
		<Show when={isConfigured}>
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
						<button class="btn btn-outline-secondary btn-sm" disabled title="Google Sign-In library could not be loaded" aria-label="Sign-in unavailable">
							<Icon type="cloudSlash"/>
							<span class="d-none d-sm-inline ms-2">Sign-in unavailable</span>
						</button>
					</Show>
				}>
				<Show
					when={isSignedIn()}
					fallback={
						<button class="btn btn-outline-primary btn-sm" onClick={signIn} aria-label="Sign in with Google">
							<Icon type="google"/>
						</button>
					}>
					<div class="position-relative">
						<button ref={setSyncMenuTrigger} class="d-flex flex-nowrap btn btn-outline-secondary btn-sm" onClick={toggleSyncMenu} disabled={isSyncing()} title={syncError() ? `Sync error: ${syncError()}` : "Google Drive Sync"} aria-label="Google Drive Sync">
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
													<Icon type="cloud"/>
												</span>
											}>
											<span class="text-success">
												<Icon type="check2"/>
											</span>
										</Show>
									}>
									<span class="text-warning">
										<Icon type="exclamationTriangle"/>
									</span>
								</Show>
							</Show>
							<span class="d-none d-md-inline ms-2">{user()?.name ?? "Sync"}</span>
						</button>
						<Show when={showSyncMenu()}>
							<div class="dropdown-menu show sync-dropdown">
								<div class="dropdown-header text-muted small px-3 py-1 text-truncate">{user()?.email}</div>
								<div class="dropdown-divider"></div>
								<label class="dropdown-item sync-dropdown-item d-flex align-items-center gap-2 mb-0">
									<input type="checkbox" checked={autoSyncEnabled()} class="form-check-input m-0" on:click={handleToggleAutoSync}/>
									<span>Auto-sync</span>
								</label>
								<div class="dropdown-divider"></div>
								<button class="dropdown-item sync-dropdown-item" onClick={() => handleSync(false)} disabled={isSyncing()}>
									<Icon type="arrowRepeat"/>
									<span class="ms-2">Sync</span>
								</button>
								<button class="dropdown-item sync-dropdown-item" onClick={() => handleSync(true)} disabled={isSyncing()}>
									<Icon type="lightningCharge"/>
									<span class="ms-2">Force Sync</span>
								</button>
								<Show when={lastSyncedLabel()}>
									<div class="dropdown-header text-muted small px-3 py-1">Last synced: {lastSyncedLabel()}</div>
								</Show>
								<div class="dropdown-divider"></div>
								<button class="dropdown-item sync-dropdown-item text-danger" onClick={handleSignOut}>
									<Icon type="boxArrowRight"/>
									<span class="ms-2">Sign out</span>
								</button>
							</div>
						</Show>
					</div>
				</Show>
			</Show>
		</Show>
	);
}