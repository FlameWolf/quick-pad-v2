import { createSignal, createMemo, createEffect, on } from "solid-js";
import { deleteKV, getKV, setKV } from "@/storage/db";
import { emptyString } from "@/library";

type UserInfo = {
	email: string;
	name: string;
};

let cachedToken: string | null = null;
let cachedExpiry: number = 0;
let cachedUser: UserInfo | null = null;
let tokenClient: any | null = null;
let gsiReadyPromise: Promise<boolean> | null = null;
let popupInFlight: Promise<string> | null = null;
const CLIENT_ID = import.meta.env.VITE_GOOG_OAUTH_CLIENT_ID ?? emptyString;
const SCOPES = "https://www.googleapis.com/auth/drive.appdata openid email profile";
const SESSION_KEY = "google-session-hint";
const TOKEN_KEY = "google-access-token";
const EXPIRY_KEY = "google-token-expires-at";
const USER_KEY = "google-user-info";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const GSI_WAIT_MS = 6000;
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

function waitForGoogleIdentity(): Promise<boolean> {
	if (gsiReadyPromise) {
		return gsiReadyPromise;
	}
	gsiReadyPromise = new Promise(resolve => {
		if (typeof google !== "undefined" && google?.accounts?.oauth2) {
			resolve(true);
			return;
		}
		const start = Date.now();
		const interval = setInterval(() => {
			if (typeof google !== "undefined" && google?.accounts?.oauth2) {
				clearInterval(interval);
				resolve(true);
			} else if (Date.now() - start > GSI_WAIT_MS) {
				clearInterval(interval);
				resolve(false);
			}
		}, 100);
	});
	return gsiReadyPromise;
}

const isConfigured = createMemo(() => Boolean(CLIENT_ID));

async function clearSession(keepUser = false) {
	setAccessToken(null);
	setTokenExpiresAt(0);
	if (!keepUser) {
		setUser(null);
		setIsSignedIn(false);
		await deleteKV(SESSION_KEY);
	}
}

async function fetchUserInfo(token: string) {
	try {
		const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
		if (!res.ok) {
			return;
		}
		const data = await res.json();
		setUser({
			email: data.email,
			name: data.name
		});
	} catch {}
}

function initClient(): boolean {
	if (tokenClient) {
		return true;
	}
	if (!CLIENT_ID || typeof google === "undefined" || !google?.accounts?.oauth2) {
		return false;
	}
	tokenClient = google.accounts.oauth2.initTokenClient({
		client_id: CLIENT_ID,
		scope: SCOPES,
		callback: async (response: any) => {
			if (response.error) {
				await clearSession(user() !== null);
				setIsReady(true);
				return;
			}
			setAccessToken(response.access_token);
			setTokenExpiresAt(Date.now() + response.expires_in * 1000);
			await setKV(SESSION_KEY, true);
			if (!user()) {
				await fetchUserInfo(response.access_token);
			}
			setIsSignedIn(true);
			setIsReady(true);
		}
	});
	return true;
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

function requestToken(prompt: string): Promise<string> {
	if (popupInFlight) {
		return popupInFlight;
	}
	popupInFlight = (async () => {
		try {
			const loaded = await waitForGoogleIdentity();
			if (!loaded || !initClient()) {
				throw new Error("Google Sign-In is unavailable");
			}
			return await new Promise<string>((resolve, reject) => {
				const original = tokenClient!.callback;
				tokenClient!.callback = (response: any) => {
					tokenClient!.callback = original;
					original(response);
					if (response.error) {
						reject(new Error(response.error));
					} else {
						resolve(response.access_token);
					}
				};
				const params: { prompt: string; hint?: string } = { prompt };
				if (prompt === emptyString) {
					const u = user();
					if (u?.email) {
						params.hint = u.email;
					}
				}
				tokenClient!.requestAccessToken(params);
			});
		} finally {
			popupInFlight = null;
		}
	})();
	return popupInFlight;
}

async function signIn() {
	if (!CLIENT_ID) {
		return;
	}
	try {
		await requestToken("consent");
	} catch {
		console.log("Consent popup blocked or GSI not ready");
	}
}

async function signOut() {
	const token = accessToken();
	if (token && typeof google !== "undefined" && google?.accounts?.oauth2) {
		google.accounts.oauth2.revoke(token, async () => {
			await clearSession();
		});
	} else {
		await clearSession();
	}
}

async function getAccessToken(): Promise<string> {
	const token = accessToken();
	if (token && Date.now() < tokenExpiresAt() - TOKEN_REFRESH_BUFFER_MS) {
		return token;
	}
	return requestToken(emptyString);
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