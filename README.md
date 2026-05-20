# QuickPad

A simple, fast, offline-first note-taking web app built with Vue 3 and TypeScript.

QuickPad keeps your notes in your browser, works without an Internet connection, and can optionally sync to your own Google Drive when you sign in.

## Features

### Notes

-   Create, view, search, edit, archive, and delete plain-text notes from a tile-based dashboard.
-   Each tile shows the title, last-updated date, and a short summary preview.
-   Live sentence, word, and character counts (Unicode-aware via `Intl.Segmenter`) while reading or editing.
-   Per-note undo / redo history while editing (debounced, up to 100 steps).
-   "Discard unsaved changes" guard when navigating away or reloading mid-edit.
-   Confirm dialog (with Enter / Escape keyboard shortcuts) protects destructive actions.

### Organisation

-   Sort notes by **Updated**, **Created**, **Title**, or **Sentence/Word/Character Count**, ascending or descending.
-   Sort field and direction are remembered between sessions.
-   Multi-select mode: tap **Select**, pick notes (or **Select All**), then bulk-export, archive, trash, restore, or delete.
-   Selected count and per-view actions are shown in a sticky selection action bar.

### Archive and Trash

-   Archive notes you want to keep but not see on the main dashboard; unarchive them at any time.
-   Deleting a note moves it to **Trash** rather than removing it immediately, so you can change your mind.
-   Trashed notes are kept for **30 days** and then automatically purged on app start.
-   Dedicated `/notes/archive` and `/notes/trash` views support the same select / bulk-action workflow.
-   **Empty Trash** permanently removes all trashed notes in one step.
-   Trashed notes can be restored, exported, or permanently deleted from the trash view.

### Import / Export

-   Import any plain-text file as a new note. Files are content-sniffed (magic numbers, NUL bytes, control-character ratio, UTF-8 validation) before import; unsupported files are reported in a toast.
-   Multiple files can be imported in one go.
-   Export a single note as a `.txt` file.
-   Export selected notes or **Export All** as a `quick-pad-notes.zip` archive (powered by JSZip), with title collisions automatically de-duplicated and unsafe filename characters sanitised.

### Offline / PWA

-   Installable as a Progressive Web App (standalone display, custom theme colour, app icon).
-   Service worker caches the app shell so it loads and works offline after the first visit (registered only in production builds).
-   All notes are stored in `localStorage` — no account required to use the app.

### Theme

-   Automatically follows your OS light/dark preference via `prefers-color-scheme`, switching the Bootstrap theme on the fly.

### Optional Google Drive sync

-   Sign in with Google to back up notes to your Drive's app-data folder (the app cannot see any other files in your Drive).
-   **Save to Drive** / **Load from Drive** on demand, plus an **Auto-sync** toggle that debounces writes a few seconds after each change.
-   Both directions perform a **last-modified merge**, so notes from local and remote are combined without losing edits.
-   Status indicator shows syncing, last-synced time, or sync errors; a toast confirms success / failure.
-   Sessions are restored on reload using a cached access token (with expiry); sign out revokes the token and clears the cached user.
-   If no Google client ID is configured, the sync UI stays hidden and the app runs in local-only mode.

## Tech stack

-   [Vue 3](https://vuejs.org/) (`<script setup>`, Composition API)
-   [TypeScript](https://www.typescriptlang.org/)
-   [Pinia](https://pinia.vuejs.org/) for state
-   [Vue Router](https://router.vuejs.org/)
-   [Bootstrap 5](https://getbootstrap.com/) + [bootstrap-vue-next](https://bootstrap-vue-next.github.io/bootstrap-vue-next/) + [Bootstrap Icons](https://icons.getbootstrap.com/)
-   [JSZip](https://stuk.github.io/jszip/) for archive export
-   [Vite](https://vitejs.dev/) build tooling

## Getting started

### Prerequisites

-   Node.js `^20.19.0` or `>=22.12.0`
-   npm

### Install

```sh
npm install
```

### Development server

```sh
npm run dev
```

### Type-check and build for production

```sh
npm run build
```

### Preview the production build

```sh
npm run preview
```

### Format source files

```sh
npm run format
```

## Configuration

Google Drive sync is optional. To enable it, create a Google OAuth 2.0 Client ID (Web application) and put it in a `.env` file at the project root:

```env
VITE_GOOG_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

The app requests the `drive.appdata`, `openid`, `email`, and `profile` scopes. Notes are stored as `quick-pad-notes.json` in the Drive app-data folder, which is private to QuickPad.

If the client ID is left blank, the sync controls are hidden and the app works entirely offline.

## Routes

| Path             | View                                              |
| ---------------- | ------------------------------------------------- |
| `/notes`         | Active notes / dashboard                          |
| `/notes/archive` | Archived notes                                    |
| `/notes/trash`   | Trashed notes (auto-purged after 30 days)         |
| `/notes/new`     | Create a new note                                 |
| `/notes/:id`     | View / edit a note (active, archived, or trashed) |

`/`, `/archive`, and `/trash` redirect to their `/notes/...` equivalents.

## Data storage

| Key                        | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `quick-pad-notes`          | All notes (JSON array, including archived and trashed)  |
| `quick-pad-sort-by`        | Sort field preference                                   |
| `quick-pad-sort-direction` | Sort direction preference                               |
| `quick-pad-last-synced`    | Timestamp of last successful Drive sync                 |
| `quick-pad-auto-sync`      | Auto-sync on/off (defaults to on)                       |
| `google_session_hint`      | Marker that a Google session was previously established |
| `google_access_token`      | Cached Google OAuth access token                        |
| `google_token_expires_at`  | Expiry timestamp for the cached access token            |
| `google_user_info`         | Cached Google user name and email                       |

Clearing site data will remove all notes that have not been synced to Drive.