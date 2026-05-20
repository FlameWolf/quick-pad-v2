import { emptyString } from "@/library";
import { createSignal, createMemo } from "solid-js";

let tokenClient: any | null = null;
let tokenExpiresAt = 0;
let gsiReadyPromise: Promise<boolean> | null = null;
const CLIENT_ID = import.meta.env.VITE_GOOG_OAUTH_CLIENT_ID ?? emptyString;
const SCOPES = "https://www.googleapis.com/auth/drive.appdata openid email profile";
const SESSION_KEY = "google_session_hint";
const TOKEN_KEY = "google_access_token";
const EXPIRY_KEY = "google_token_expires_at";
const USER_KEY = "google_user_info";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const GSI_WAIT_MS = 6000;

const [accessToken, setAccessToken] = createSignal<string | null>(null);
const [user, setUser] = createSignal<{ email: string; name: string } | null>(null);
const [isReady, setIsReady] = createSignal(false);
const [isSignedIn, setIsSignedIn] = createSignal(false);

function persistAuthState(token: string, expiresAt: number) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(EXPIRY_KEY, String(expiresAt));
}

function persistUserInfo(info: { email: string; name: string } | null) {
	if (info) {
		localStorage.setItem(USER_KEY, JSON.stringify(info));
	} else {
		localStorage.removeItem(USER_KEY);
	}
}

function loadStoredUser(): { email: string; name: string } | null {
	const raw = localStorage.getItem(USER_KEY);
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed.email === "string" && typeof parsed.name === "string") {
			return {
				email: parsed.email,
				name: parsed.name
			};
		}
	} catch {}
	return null;
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

function clearSession(keepUser = false) {
	setAccessToken(null);
	tokenExpiresAt = 0;
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(EXPIRY_KEY);
	if (!keepUser) {
		setUser(null);
		setIsSignedIn(false);
		localStorage.removeItem(SESSION_KEY);
		localStorage.removeItem(USER_KEY);
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
				clearSession(user() !== null);
				setIsReady(true);
				return;
			}
			setAccessToken(response.access_token);
			tokenExpiresAt = Date.now() + response.expires_in * 1000;
			localStorage.setItem(SESSION_KEY, "true");
			persistAuthState(response.access_token, tokenExpiresAt);
			if (!user()) {
				await fetchUserInfo(response.access_token);
				persistUserInfo(user());
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
	const storedToken = localStorage.getItem(TOKEN_KEY);
	const storedExpiryRaw = localStorage.getItem(EXPIRY_KEY);
	const storedExpiry = storedExpiryRaw ? Number(storedExpiryRaw) : 0;
	const storedUser = loadStoredUser();
	if (storedToken && storedExpiry && Date.now() < storedExpiry - TOKEN_REFRESH_BUFFER_MS) {
		setAccessToken(storedToken);
		tokenExpiresAt = storedExpiry;
		setUser(storedUser);
		setIsSignedIn(true);
	} else if (storedUser) {
		setUser(storedUser);
		setIsSignedIn(true);
	}
	setIsReady(true);
}

async function signIn() {
	if (!CLIENT_ID) {
		return;
	}
	const loaded = await waitForGoogleIdentity();
	if (!loaded || !initClient()) {
		return;
	}
	try {
		tokenClient!.requestAccessToken({ prompt: "consent" });
	} catch {
		console.log("Consent popup blocked or GSI not ready");
	}
}

function signOut() {
	const token = accessToken();
	if (token && typeof google !== "undefined" && google?.accounts?.oauth2) {
		google.accounts.oauth2.revoke(token, () => {
			clearSession();
		});
	} else {
		clearSession();
	}
}

async function getAccessToken(): Promise<string> {
	const token = accessToken();
	if (token && Date.now() < tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
		return token;
	}
	const loaded = await waitForGoogleIdentity();
	if (!loaded || !initClient()) {
		throw new Error("Google Sign-In is unavailable");
	}
	return new Promise((resolve, reject) => {
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
		const params: { prompt: string; hint?: string } = { prompt: emptyString };
		const u = user();
		if (u?.email) {
			params.hint = u.email;
		}
		tokenClient!.requestAccessToken(params);
	});
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