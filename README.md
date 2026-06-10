# QuickPad

A simple, fast, offline-first note-taking web app built with Solid and TypeScript.

QuickPad keeps your notes in your browser, works without an Internet connection, and can optionally sync to your own Google Drive when you sign in.

## Features

### Notes

- Create, view, search, edit, archive, and delete plain-text notes from a tile-based dashboard.
- Each tile shows the title, last-updated date, and a short summary preview.
- Live sentence, word, and character counts (Unicode-aware via `Intl.Segmenter`) while reading or editing.
- Counts and summaries are computed once and cached per note, then recalculated live while editing.
- Note bodies are **lazy-loaded**: only metadata is read on startup, and the full content is fetched on demand when a note is opened.
- Search matches both note titles and note bodies (content is scanned on demand).
- Per-note undo / redo history while editing (debounced, up to 100 steps).
- "Discard unsaved changes" guard when navigating away or reloading mid-edit.
- Confirm dialog (with Enter / Escape keyboard shortcuts) protects destructive actions.

### Organisation

- Sort notes by **Updated**, **Created**, **Title**, or **Sentence/Word/Character Count**, ascending or descending.
- Sort field and direction are remembered between sessions.
- Multi-select mode: tap **Select**, pick notes (or **Select All**), then bulk-export, archive, trash, restore, or delete.
- Selected count and per-view actions are shown in a sticky selection action bar.
- Scroll position is preserved per list view, with quick scroll-to-top / scroll-to-bottom buttons.

### Archive and Trash

- Archive notes you want to keep but not see on the main dashboard; unarchive them at any time.
- Deleting a note moves it to **Trash** rather than removing it immediately, so you can change your mind.
- Trashed notes are kept for **30 days** and then automatically purged on app start.
- Dedicated `/notes/archive` and `/notes/trash` views support the same select / bulk-action workflow.
- **Empty Trash** permanently removes all trashed notes in one step.
- Trashed notes can be restored, exported, or permanently deleted from the trash view.

### Import / Export

- Import any plain-text file as a new note. Files are content-sniffed (magic numbers, NUL bytes, control-character ratio, UTF-8 validation) before import; unsupported files are reported in a toast.
- Multiple files can be imported in one go.
- Export a single note as a `.txt` file.
- Export selected notes or **Export All** as a `quick-pad-notes.zip` archive (powered by JSZip), with title collisions automatically de-duplicated and unsafe filename characters sanitised.

### Offline / PWA

- Installable as a Progressive Web App (standalone display, custom theme colour, app icon).
- Service worker caches the app shell so it loads and works offline after the first visit (registered only in production builds).
- All notes are stored locally in **IndexedDB** — no account required to use the app.

### Theme

- Automatically follows your OS light/dark preference via `prefers-color-scheme`, switching the Bootstrap theme on the fly.
- A sun/moon toggle in the navbar lets you override the OS preference manually.

### Optional Google Drive sync

- Sign in with Google to back up notes to your Drive's app-data folder (the app cannot see any other files in your Drive).
- Each note is stored as its own file (`qp-note:<id>.json`) in the Drive app-data folder; a legacy single-file backup is migrated automatically and then removed.
- **Sync** performs a full pull-and-push on demand, and **Force Sync** re-syncs every note regardless of timestamps. An **Auto-sync** toggle debounces a push a few seconds after each change.
- Merging is timestamp-based: each note's effective time is the latest of its created, modified, archived, deleted, and state-changed times, so local and remote are combined without losing edits. Pull and push are tracked with separate last-synced timestamps for efficient incremental syncs.
- Permanent deletions are queued and propagated to Drive (the corresponding files are removed on the next sync).
- A sync indicator shows syncing, last-synced time, or sync errors; a toast confirms success / failure. The sync menu also exposes the signed-in account and sign-out.
- Authentication uses the OAuth 2.0 authorization-code flow with a serverless backend: the refresh token is kept server-side in an encrypted, httpOnly session cookie, and access tokens are refreshed silently in the background, so the user only signs in once. Sign out revokes the grant and clears the session.
- If no Google client ID is configured, the sync UI stays hidden and the app runs in local-only mode.

## Tech stack

- [Solid](https://docs.solidjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Solid Router](https://docs.solidjs.com/solid-router/)
- [Bootstrap](https://getbootstrap.com/) + [Bootstrap Icons](https://icons.getbootstrap.com/)
- [idb](https://github.com/jakearchibald/idb) for IndexedDB storage
- [JSZip](https://stuk.github.io/jszip/) for archive export
- [Vite](https://vitejs.dev/) build tooling

## Getting started

### Prerequisites

- Node.js `>=22.12.0`
- npm

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

Google Drive sync is optional and uses the OAuth 2.0 **authorization-code flow** with a small serverless backend (the functions in `api/auth/`). The user signs in once; the refresh token is held server-side in an encrypted, httpOnly cookie, and access tokens are refreshed silently — there is no recurring sign-in popup. If the client ID is left blank, the sync controls are hidden and the app works entirely offline.

### 1. Create the OAuth client

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** of type **Web application**, then add:

- **Authorized JavaScript origins**: your app origin, e.g. `https://your-app.vercel.app` (and `http://localhost:3000` for local development).
- **Authorized redirect URIs**: the callback endpoint — `https://your-app.vercel.app/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for local development). This must match exactly, including the scheme and path.

The app requests the `drive.appdata`, `openid`, `email`, and `profile` scopes. Each note is stored as a separate `qp-note:<id>.json` file in the Drive app-data folder, which is private to QuickPad.

### 2. Set environment variables

Copy `.env.example` to `.env` and fill in the values (see that file for details):

```env
# Frontend (exposed to the browser)
VITE_GOOG_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"

# Backend (server-only — never prefix with VITE_)
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
SESSION_SECRET="a-long-random-string"   # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

On **Vercel**, set the same variables under **Project Settings → Environment Variables** (the `.env` file is git-ignored and only used locally).

### 3. Local development

The `/api/auth/*` functions run on Vercel's serverless runtime, so the OAuth flow only works when the functions are served alongside the app. Use the [Vercel CLI](https://vercel.com/docs/cli):

```sh
# Console 1
vercel dev
# Console 2
npm run dev
```

Plain `npm run dev` serves the frontend only; sync will be unavailable because the `/api/auth/*` endpoints are not running.

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

Notes and preferences are stored in an IndexedDB database named `quick-pad` (data from older `localStorage`-based versions is migrated automatically on first launch and then cleared).

The database has three object stores:

| Object store | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `notes`      | Note metadata (id, title, summary, counts, dates, state flags) |
| `contents`   | Note bodies, keyed by note id and loaded lazily                |
| `kv`         | Preferences and sync / auth state (keys below)                 |

Keys held in the `kv` store:

| Key                       | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `sort-by`                 | Sort field preference                                   |
| `sort-direction`          | Sort direction preference                               |
| `last-synced-to-local`    | Timestamp of last successful pull from Drive            |
| `last-synced-to-cloud`    | Timestamp of last successful push to Drive              |
| `auto-sync`               | Auto-sync on/off (defaults to on)                       |
| `pending-purges`          | Note ids queued for deletion from Drive                 |
| `google-session-hint`     | Marker that a Google session was previously established |
| `google-access-token`     | Cached Google OAuth access token                        |
| `google-token-expires-at` | Expiry timestamp for the cached access token            |
| `google-user-info`        | Cached Google user name and email                       |
| `__migrated-to-idb`       | Flag marking the one-time migration from `localStorage` |

Clearing site data will remove all notes that have not been synced to Drive.