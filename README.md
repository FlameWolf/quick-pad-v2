# QuickPad

A simple, fast, offline-first note-taking web app built with Solid and TypeScript.

QuickPad keeps your notes in your browser, works without an Internet connection, and can optionally sync to your own Google Drive when you sign in.

## Features

### Notes

- Create, view, search, edit, favourite, pin, archive, and delete plain-text notes from a tile-based dashboard.
- Each tile shows the title, last-updated date, a short summary preview, the sentence / word / character counts, and pin / favourite status badges.
- Sentence, word, and character counts are Unicode-aware (via `Intl.Segmenter`). Cached counts are shown while reading and recalculated live while editing.
- Counts and summaries are computed once and cached per note; the counts are recalculated live while editing, and the summary is refreshed when the note is saved.
- Note bodies are **lazy-loaded**: only metadata is read on startup, and the full content is fetched on demand when a note is opened (with a loading spinner while it streams in).
- Search matches both note titles and note bodies (content is scanned on demand) across the active, favourited, archived, and trash views.
- Per-note undo / redo history while editing (debounced, up to 100 steps).
- "Discard unsaved changes" guard when navigating away or reloading mid-edit.
- Confirm dialog (with Enter / Escape keyboard shortcuts) protects destructive actions.
- Tapping on a note tile opens it in read-only mode. A one-tap **Copy** button allows easy copy-pasting of note contents anywhere (with a toast confirming success or failure). Tap the **Edit** button to switch to _Edit_ mode.
- The editing area auto-grows to fit your text (using `field-sizing` where supported, with a JavaScript fallback).
- Create a new note from a dedicated **+** tile on the dashboard.
- When a list is empty, an empty-state panel is shown — on the dashboard it offers quick actions to create a note, import files, or jump to the Archive / Trash.

### Favourites and pinning

- **Favourite** any note (individually or in bulk) to collect it in a dedicated **Favourited** view (`/notes/favourite`) without moving it out of the main dashboard.
- **Pin** a note to keep it at the top of whichever list it appears in, regardless of the chosen sort field or direction; the most-recently-pinned note sorts first.
- Pinning is blocked for archived or trashed notes, and archiving or trashing a note automatically clears its pin.

### Organisation

- Sort notes by **Updated**, **Created**, **Title**, or **Sentence/Word/Character Count**, ascending or descending. Pinned notes always sort to the top, ahead of the chosen ordering.
- Sort field and direction are remembered between sessions.
- Multi-select mode: tap **Select**, pick notes (or **Select All** / **Deselect All**), then run a bulk action.
- The available bulk actions are view-specific — e.g. export, favourite, archive, and trash on the dashboard; export, unfavourite, and trash in Favourited; export, unarchive, and trash in Archive; restore and permanently delete in Trash.
- Selected count and per-view actions are shown in a sticky selection action bar.
- Scroll position is preserved per list view (active, favourited, archived, trash), with quick scroll-to-top / scroll-to-bottom buttons.

### Archive and Trash

- Archive notes you want to keep but not see on the main dashboard; unarchive them at any time.
- Deleting a note moves it to **Trash** rather than removing it immediately, so you can change your mind.
- Trashed notes are kept for **30 days** and then automatically purged on app start.
- Dedicated `/notes/favourite`, `/notes/archive`, and `/notes/trash` views support the same select / bulk-action workflow as the dashboard.
- **Empty Trash** permanently removes all trashed notes in one step.
- Trashed notes can be restored or permanently deleted; individual trashed notes can also be exported.

### Import / Export

- Import any plain-text file as a new note. Files are content-sniffed (magic numbers, NUL bytes, control-character ratio, UTF-8 validation) before import; the note title is derived from the filename (a trailing `.txt` is stripped). Empty files are accepted as empty notes, and unsupported or unreadable files are reported in a toast.
- Multiple files can be imported in one go; files that fail the sniff are skipped without aborting the rest of the batch.
- Export a single note as a `.txt` file.
- Export selected notes, or **Export All** (every active note), as a `quick-pad-notes.zip` archive (powered by JSZip), with title collisions automatically de-duplicated and unsafe filename characters sanitised.

### Offline / PWA

- Installable as a Progressive Web App (standalone display, custom theme colour, app icon).
- A hand-written service worker caches the app shell so it loads and works offline after the first visit (registered only in production builds). A custom Vite build plugin stamps each build with a content-hashed cache version and a precache manifest, so a new deploy invalidates the old cache automatically.
- The service worker answers navigations by serving the cached `index.html` shell and revalidating it in the background, and serves other same-origin GETs cache-first; `/api/*` and cross-origin requests are left to the network.
- All notes are stored locally in **IndexedDB** — no account required to use the app.

### Theme

- Automatically follows your OS light/dark preference via `prefers-color-scheme`, switching the Bootstrap theme (`data-bs-theme`) on the fly.
- A sun/moon toggle in the navbar flips the theme instantly. The manual choice applies to the current session only — it is not persisted, so reloading or a system theme change re-applies your OS preference.

### Optional Google Drive sync

- Sign in with Google to back up notes to your Drive's app-data folder (the app cannot see any other files in your Drive). Sign-in happens in a popup window, and the result is posted back to the app.
- Each note is stored as its own file (`qp-note:<id>.json`) in the Drive app-data folder.
- **Sync** performs a full pull-and-push on demand, **Force Sync** re-syncs every note regardless of timestamps (after a confirmation prompt), and an **Auto-sync** toggle debounces a push a few seconds after each change.
- Merging is timestamp-based: each note's effective time is the latest of its created, modified, favourited, pinned, archived, deleted, and state-changed times, so local and remote are combined without losing edits. When the remote copy of a note is newer, it wins and is pulled into the local store. Pull and push are tracked with separate last-synced timestamps for efficient incremental syncs.
- Permanent deletions are queued and propagated to Drive (the corresponding files are removed on the next sync), and the 30-day trash purge propagates the same way.
- A sync indicator reflects its state (syncing, signed-in-but-not-yet-synced, last-synced time, or a sync error); a toast confirms success / failure. The sync menu also exposes the signed-in account and sign-out.
- Authentication uses the OAuth 2.0 authorization-code flow with a serverless backend: the refresh token is kept server-side in an AES-256-GCM-encrypted, httpOnly session cookie, and access tokens are refreshed silently in the background, so the user only signs in once. Sign out revokes the grant and clears the session.
- If no Google client ID is configured, the sync UI stays hidden and the app runs in local-only mode.

## Tech stack

- [Solid](https://docs.solidjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Solid Router](https://docs.solidjs.com/solid-router/)
- [Bootstrap](https://getbootstrap.com/)
- [idb](https://github.com/jakearchibald/idb) for IndexedDB storage
- [JSZip](https://stuk.github.io/jszip/) for archive export
- [Vite](https://vitejs.dev/) build tooling
- [PurgeCSS](https://purgecss.com/) (via `@fullhuman/postcss-purgecss`) to strip unused Bootstrap CSS from production builds
- [Vercel](https://vercel.com/docs/cli/) for serverless functions

## Architecture

The `src/` tree is organised by responsibility:

| Folder         | Responsibility                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `constants/`   | Configuration values grouped by domain (`storage`, `sort`, `auth`, `sync`, `notes`, `actions`, `common`) |
| `types/`       | Ambient / global TypeScript types (typed KV schema, selection actions, legal-page shapes)                |
| `utils/`       | Pure, framework-agnostic helpers (`text-analysis`, `file-detection`, `dates`, `numbers`, `timing`)       |
| `storage/`     | Persistence: `db` (low-level `idb`), `NotesRepository` (domain API), `migrate` (legacy data migration)   |
| `models/`      | `NoteModel` — the note domain object and its (de)serialisation                                           |
| `composables/` | Reusable Composition-API units and app-global state singletons                                           |
| `stores/`      | Solid stores                                                                                             |
| `components/`  | Solid components                                                                                         |
| `content/`     | Static copy for the Privacy Policy and Terms of Service pages                                            |
| `router/`      | Solid Router route definitions, plus per-view scroll preservation and navigation state                   |

### Storage layering

Components and stores never touch `idb` directly. `storage/db.ts` is the only module that opens the database and runs raw transactions; `storage/NotesRepository.ts` builds the note-domain API on top of it (and owns the metadata/content split and lazy-content "working-set contract"). Key/value access is type-checked by key through the global `KVSchema` declared in `types/index.d.ts`, so `getKV`/`setKV` are safe without per-call casts (the one-time `localStorage` migration in `storage/migrate.ts` uses the explicit `setKVRaw` escape hatch for legacy data).

### State management

Shared, app-wide state lives in **module-level reactive singletons**. There is genuinely one of each (one theme, one selection, one sort preference, one sync session), so these are exposed as composables backed by module-scoped `ref`s rather than per-call instances — calling e.g. `useNoteSelection()` from two components shares the same state by design:

- `useTheme`, `useConfirmDialog`, `useNoteSelection`, `useNoteSort`, `useNotesSync`, `useGoogleAuth`, and `useFileIO` are app-global singletons. Persistence watchers are registered once at module scope; `hydrate*()` functions only load initial values.
- The richer note collection additionally uses a **Solid store** (`stores/notes.ts`) for its larger action surface while keeping the same module-singleton state model.

## Getting started

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- npm
- Vercel CLI (`npm i -g vercel`; see [Vercel CLI setup](#3-vercel-cli-setup)).

### Install

```sh
npm install
```

### Development server

```sh
npm run dev
```

> This runs `scripts/run-all.js`, which starts the Vercel dev server (the `api/auth/*` functions) and the Vite UI together and shuts both down if either one exits. It requires the Vercel CLI — see [Configuration → Vercel CLI setup](#3-vercel-cli-setup).

### Type-check and build for production

```sh
npm run build
```

### Type-check only

```sh
npm run type-check
```

### Preview the production build

First build the app (`npm run build`), then:

```sh
npm run preview
```

This also runs through `scripts/run-all.js`, starting the Vercel CLI (`vercel dev`, serving the `api/auth/*` functions) alongside `vite preview` (serving the built UI from `dist/`), so the OAuth flow works against the production build. It does not rebuild automatically — run `npm run build` first.

### Format source files

```sh
npm run format
```

## Configuration

Google Drive sync is optional and uses the OAuth 2.0 **authorization-code flow** with a small serverless backend (the functions in `api/auth/`: `start`, `callback`, `token`, and `signout`). The user signs in once via a popup; the refresh token is held server-side in an encrypted, httpOnly cookie, and access tokens are refreshed silently — there is no recurring sign-in popup. If the client ID is left blank, the sync controls are hidden and the app works entirely offline.

### 1. Create the OAuth client

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** of type **Web application**, then add:

- **Authorized JavaScript origins**: your app origin, e.g. `https://your-app.vercel.app` (and `http://localhost:3000` for local development).
- **Authorized redirect URIs**: the callback endpoint — `https://your-app.vercel.app/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for local development). This must match exactly, including the scheme and path.

The app requests the `drive.appdata`, `openid`, `email`, and `profile` scopes. Each note is stored as a separate `qp-note:<id>.json` file in the Drive app-data folder, which is private to QuickPad.

### 2. Set environment variables

Copy `environment.config` to `.env` and fill in the values:

```env
# Frontend (exposed to the browser)
VITE_GOOG_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"

# Backend (server-only — never prefix with VITE_)
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
SESSION_SECRET="a-long-random-string"   # node -e "console.log(require("crypto").randomBytes(32).toString("base64"))"
```

> The serverless backend prefers `GOOGLE_OAUTH_CLIENT_ID` but falls back to `VITE_GOOG_OAUTH_CLIENT_ID` if it is unset, so a single client ID value works for both the browser and the server. The backend reports itself as "not configured" — and sign-in and token refresh fail — unless the client ID, `GOOGLE_OAUTH_CLIENT_SECRET`, and `SESSION_SECRET` are all set.

On **Vercel**, set the same variables under **Project Settings → Environment Variables** (the `.env` file is git-ignored and only used locally).

### 3. Vercel CLI setup

`npm run dev` and `npm run preview` start `vercel dev` to serve the `api/auth/*` serverless functions, so the Vercel CLI must be installed and the project linked before the local OAuth flow works.

1. **Install the CLI** (globally, or use `npx vercel` for any command below):

    ```sh
    npm i -g vercel
    ```

2. **Log in** to your Vercel account:

    ```sh
    vercel login
    ```

3. **Link the project.** A fresh clone has no `.vercel/` folder (it is git-ignored), so you must link the directory to a Vercel project. This creates `.vercel/project.json` with the project and org IDs:

    ```sh
    vercel link
    ```

    Follow the prompts to select (or create) the project. `vercel dev` — and therefore `npm run dev` — will not run until the directory is linked.

4. **Pull environment variables (optional).** Instead of maintaining `.env` by hand ([step 2](#2-set-environment-variables)), you can manage the variables in the Vercel dashboard and pull them locally after linking:

    ```sh
    vercel env pull .env            # download Project Settings → Environment Variables (Development) into .env
    vercel env add SESSION_SECRET   # interactively add a variable to the linked project
    ```

### 4. Local development

The `api/auth/*` functions run on Vercel's serverless runtime, so the OAuth flow only works when the functions are served alongside the app. Use the [Vercel CLI](https://vercel.com/docs/cli):

```sh
npm run dev
```

The console will display two `http://localhost` URLs: one for the API served by `vercel dev` (usually `http://localhost:3000`) and one for the UI served by Vite. Visit the UI URL to use the app — it will be `http://localhost:5173` for `npm run dev`, or `http://localhost:4173` for `npm run preview`. The UI proxies `/api/*` requests to the Vercel dev server on port 3000.

## Deployment

QuickPad deploys to [Vercel](https://vercel.com/) as a single project — the Vite-built static UI plus the `api/auth/*` serverless functions.

1. Install, authenticate, and link the CLI as described in [Vercel CLI setup](#3-vercel-cli-setup).
2. Set the backend variables (`VITE_GOOG_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`) under **Project Settings → Environment Variables** in the Vercel dashboard. The local `.env` is git-ignored and is **not** uploaded.
3. Add your production origin and `https://<your-app>.vercel.app/api/auth/callback` to the OAuth client's authorized JavaScript origins and redirect URIs (see [step 1](#1-create-the-oauth-client)).
4. Deploy:

    ```sh
    vercel            # create a preview deployment
    vercel --prod     # deploy to production (alias of `vercel deploy --prod`)
    ```

Routing is handled by `vercel.json`: every non-`/api/` path is rewritten to `/index.html` so the Solid Router SPA owns client-side routing.

## Routes

| Path               | View                                              |
| ------------------ | ------------------------------------------------- |
| `/notes`           | Active notes / dashboard                          |
| `/notes/favourite` | Favourited notes                                  |
| `/notes/archive`   | Archived notes                                    |
| `/notes/trash`     | Trashed notes (auto-purged after 30 days)         |
| `/notes/new`       | Create a new note                                 |
| `/notes/:id`       | View / edit a note (active, archived, or trashed) |
| `/privacy`         | Privacy Policy (lazy-loaded)                      |
| `/terms`           | Terms of Service (lazy-loaded)                    |

`/`, `/favourite`, `/archive`, and `/trash` redirect to their `/notes/...` equivalents. The Privacy Policy and Terms of Service pages are linked from the app footer (alongside a link to the source repository).

## Data storage

Notes and preferences are stored in an IndexedDB database named `quick-pad` (data from older `localStorage`-based versions is migrated automatically on first launch and then cleared). The schema is at version 2; the version-1 → 2 upgrade split note bodies out of the `notes` store into a separate `contents` store so metadata can load without the bodies.

The database has three object stores:

| Object store | Purpose                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `notes`      | Note metadata (id, title, summary, counts, dates, favourite/pin/archive/trash state) |
| `contents`   | Note bodies, keyed by note id and loaded lazily                                      |
| `kv`         | Preferences and sync / auth state (keys below)                                       |

Typed keys in the `kv` store (declared by the `KVSchema`):

| Key                       | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `sort-by`                 | Sort field preference                                   |
| `sort-direction`          | Sort direction preference                               |
| `last-synced-to-local`    | Timestamp of last successful pull from Drive            |
| `last-synced-to-cloud`    | Timestamp of last successful push to Drive              |
| `auto-sync`               | Auto-sync on/off (defaults to on)                       |
| `google-session-hint`     | Marker that a Google session was previously established |
| `google-access-token`     | Cached Google OAuth access token                        |
| `google-token-expires-at` | Expiry timestamp for the cached access token            |
| `google-user-info`        | Cached Google user name and email                       |
| `__migrated-to-idb`       | Flag marking the one-time migration from `localStorage` |

Pending deletions awaiting propagation to Drive are held in an in-memory set during a session and flushed to Drive on the next sync.

Clearing site data will remove all notes that have not been synced to Drive.