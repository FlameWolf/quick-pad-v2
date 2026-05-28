import { runMigration } from "./storage/migrate";
import { hydrateSortPrefs } from "./composables/useNoteSort";
import { hydrateSyncMetadata } from "./composables/useNotesSync";
import { hydrateAuthState } from "./composables/useGoogleAuth";
import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./App";
import { Routes } from "./router";
import { hydrateNotes } from "./stores/notes";
import { registerServiceWorker } from "./registerServiceWorker";
import "./styles.css";

await runMigration();
await Promise.all([hydrateSortPrefs(), hydrateSyncMetadata(), hydrateAuthState()]);
render(() => <Router root={App}>{Routes()}</Router>, document.getElementById("app")!);
await hydrateNotes();
registerServiceWorker();