const isDev = import.meta.env.DEV;
const prefix = "[quick-pad]";

export function logError(message: string, ...detail: unknown[]): void {
	console.error(`${prefix} ${message}`, ...detail);
}

export function logWarn(message: string, ...detail: unknown[]): void {
	console.warn(`${prefix} ${message}`, ...detail);
}

export function logInfo(message: string, ...detail: unknown[]): void {
	if (isDev) {
		console.info(`${prefix} ${message}`, ...detail);
	}
}