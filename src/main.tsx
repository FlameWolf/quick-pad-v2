import { ensurePersistentStorage } from "@/storage/persistence";
import { registerServiceWorker } from "@/registerServiceWorker";
import { runMigration } from "@/storage/migrate";
import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import { Routes } from "@/router";
import App from "@/App";

ensurePersistentStorage().then(success => {
	if (!success) {
		console.warn("Persistent storage request denied. Browser may automatically clear locally saved notes based on storage quotas and eviction criteria.");
	}
});
registerServiceWorker();
await runMigration();
render(() => <Router root={App}>{Routes()}</Router>, document.getElementById("app")!);