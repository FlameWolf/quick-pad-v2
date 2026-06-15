import { createSignal, createMemo, createEffect, on } from "solid-js";
import { deleteKV, getKV, setKV } from "@/storage/db";
import { TOKEN_KEY, EXPIRY_KEY, USER_KEY, CLIENT_ID, SESSION_KEY, TOKEN_REFRESH_BUFFER_MS, AUTH_TOKEN_URL, AUTH_START_URL, AUTH_SIGNOUT_URL } from "@/constants/auth";
import { LAST_SYNCED_TO_CLOUD_KEY, LAST_SYNCED_TO_LOCAL_KEY } from "@/constants/sync";

type UserInfo = {
	email: string;
	name: string;
};

let cachedToken: string | null = null;
let cachedExpiry: number = 0;
let cachedUser: UserInfo | null = null;
let refreshInFlight: Promise<string> | null = null;
const [accessToken, setAccessToken] = createSignal<string | null>(null);
const [tokenExpiresAt, setTokenExpiresAt] = createSignal(0);
const [user, setUser] = createSignal<UserInfo | null>(null);
const [isReady, setIsReady] = createSignal(false);
const [isSignedIn, setIsSignedIn] = createSignal(false);

createEffect(
	on(
		[accessToken, tokenExpiresAt],
		async ([token, expiresAt]) => {
			if (!token || !expiresAt) {
				await deleteKV(TOKEN_KEY);
				await deleteKV(EXPIRY_KEY);
				return;
			}
			if (token !== cachedToken || expiresAt !== cachedExpiry) {
				await setKV(TOKEN_KEY, token);
				await setKV(EXPIRY_KEY, expiresAt);
			}
		},
		{ defer: true }
	)
);

createEffect(
	on(
		user,
		async info => {
			if (!info) {
				await deleteKV(USER_KEY);
				return;
			}
			if (info && (info.email !== cachedUser?.email || info.name !== cachedUser?.name)) {
				await setKV(USER_KEY, info);
			}
		},
		{ defer: true }
	)
);

export async function hydrateAuthState(): Promise<void> {
	cachedToken = (await getKV<string>(TOKEN_KEY)) ?? null;
	cachedExpiry = (await getKV<number>(EXPIRY_KEY)) ?? 0;
	const stored = await getKV<{ email: unknown; name: unknown }>(USER_KEY);
	if (stored && typeof stored.email === "string" && typeof stored.name === "string") {
		cachedUser = { email: stored.email, name: stored.name };
	} else {
		cachedUser = null;
	}
}

const isConfigured = createMemo(() => Boolean(CLIENT_ID));

async function clearSession(keepUser = false) {
	setAccessToken(null);
	setTokenExpiresAt(0);
	cachedToken = null;
	cachedExpiry = 0;
	if (!keepUser) {
		setUser(null);
		setIsSignedIn(false);
		cachedUser = null;
		await deleteKV(SESSION_KEY);
		await deleteKV(LAST_SYNCED_TO_CLOUD_KEY);
		await deleteKV(LAST_SYNCED_TO_LOCAL_KEY);
	}
}

function tryRestoreSession() {
	if (isReady()) {
		return;
	}
	if (!CLIENT_ID) {
		setIsReady(true);
		return;
	}
	if (cachedToken && cachedExpiry && Date.now() < cachedExpiry - TOKEN_REFRESH_BUFFER_MS) {
		setAccessToken(cachedToken);
		setTokenExpiresAt(cachedExpiry);
		setUser(cachedUser);
		setIsSignedIn(true);
	} else if (cachedUser) {
		setUser(cachedUser);
		setIsSignedIn(true);
	}
	setIsReady(true);
}

async function refreshFromServer(): Promise<string> {
	if (refreshInFlight) {
		return refreshInFlight;
	}
	refreshInFlight = (async () => {
		try {
			const res = await fetch(AUTH_TOKEN_URL, {
				method: "GET",
				credentials: "include",
				headers: { Accept: "application/json" }
			});
			if (res.status === 401) {
				await clearSession(false);
				throw new Error("Your Google session has expired. Please sign in again.");
			}
			if (!res.ok) {
				throw new Error(`Could not refresh the Google session (status ${res.status}).`);
			}
			const data = (await res.json()) as { access_token: string; expires_in: number; user?: UserInfo | null };
			setAccessToken(data.access_token);
			setTokenExpiresAt(Date.now() + (data.expires_in || 3600) * 1000);
			if (data.user) {
				setUser(data.user);
			}
			await setKV(SESSION_KEY, true);
			setIsSignedIn(true);
			return data.access_token;
		} finally {
			refreshInFlight = null;
		}
	})();
	return refreshInFlight;
}

async function getAccessToken(): Promise<string> {
	const token = accessToken();
	if (token && Date.now() < tokenExpiresAt() - TOKEN_REFRESH_BUFFER_MS) {
		return token;
	}
	return refreshFromServer();
}

function signIn(): Promise<void> {
	if (!CLIENT_ID) {
		return Promise.resolve();
	}
	return new Promise<void>(resolve => {
		const width = 500;
		const height = 600;
		const left = window.screenX + Math.max(0, Math.round((window.outerWidth - width) / 2));
		const top = window.screenY + Math.max(0, Math.round((window.outerHeight - height) / 2));
		const popup = window.open(AUTH_START_URL, "qp-google-auth", `width=${width},height=${height},left=${left},top=${top}`);
		let settled = false;
		let pollTimer: ReturnType<typeof setInterval> | null = null;
		function cleanup() {
			window.removeEventListener("message", onMessage);
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
		}
		function finish() {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve();
		}
		async function onMessage(event: MessageEvent) {
			if (event.origin !== window.location.origin || !event.data || event.data.type !== "qp-auth") {
				return;
			}
			if (event.data.ok) {
				if (event.data.user) {
					setUser(event.data.user);
				}
				await setKV(SESSION_KEY, true);
				setIsSignedIn(true);
				try {
					await refreshFromServer();
				} catch {}
			}
			finish();
		}
		window.addEventListener("message", onMessage);
		if (!popup) {
			console.log("Sign-in popup was blocked by the browser.");
			finish();
			return;
		}
		pollTimer = setInterval(() => {
			if (popup.closed) {
				finish();
			}
		}, 500);
	});
}

async function signOut() {
	try {
		await fetch(AUTH_SIGNOUT_URL, { method: "POST", credentials: "include" });
	} catch {}
	await clearSession();
}

export function useGoogleAuth() {
	return {
		user,
		isReady,
		isSignedIn,
		isConfigured,
		tryRestoreSession,
		signIn,
		signOut,
		getAccessToken
	};
}