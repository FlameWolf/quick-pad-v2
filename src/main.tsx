import { ensurePersistentStorage } from "@/storage/persistence";
import { registerServiceWorker } from "@/registerServiceWorker";
import { runMigration } from "@/storage/migrate";
import { hydrateSortPrefs } from "@/composables/useNoteSort";
import { hydrateSyncMetadata } from "@/composables/useNotesSync";
import { hydrateAuthState } from "@/composables/useGoogleAuth";
import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "@/App";
import { Routes } from "@/router";
import { hydrateNotes } from "@/stores/notes";
import "@/styles.css";

ensurePersistentStorage().then(success => {
	if (!success) {
		console.warn("Persistent storage request denied. Browser may automatically clear locally saved notes based on storage quotas and eviction criteria.");
	}
});
registerServiceWorker();
await runMigration();
await Promise.all([hydrateSortPrefs(), hydrateSyncMetadata(), hydrateAuthState()]);
render(() => <Router root={App}>{Routes()}</Router>, document.getElementById("app")!);
await hydrateNotes();