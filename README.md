# Tavo Visual Library

A Tavo plugin for reusable **character** and **place** images in AI role-playing chats.

Tavo Visual Library can import images with Tavo's native file picker or from bounded URL downloads, store a local copy in Tavo, organize entries by chat/campaign/global scope, display saved portraits without advancing the story, and optionally invoke visuals automatically when the narrator mentions a saved character or place.

**Current maintenance version: 1.5.2** (on `codex/tavo-1.7.0`; not yet merged into `main`).

## Features

- Character and place image library
- This Chat, Campaign, or Global entries
- StoryState campaign-ID integration for cross-session visual continuity
- Standalone campaign create/select support when StoryState is absent
- Safe **Copy This Chat → Campaign** migration
- Multi-select bulk library editing
- Batch Character/Place category changes
- Batch This Chat/Campaign/Global location moves
- Name, aliases, and description metadata
- Native device image picker on Tavo 1.2.7
- Bounded fallback import from direct image URLs
- Automatic resolution of common image-host page URLs such as ImgBB sharing pages
- Local image persistence through Tavo file storage
- Image preview, edit, and delete controls
- Manual **Show in Chat** without creating a user turn
- `/show Name`, `/show chat:Name`, `/show campaign:Name`, and `/show global:Name`
- Smart Invocation for narrator mentions
- Configurable Smart Invocation cooldown and maximum images per narrator message
- Parallel/off-screen tracker filtering so tracker-only mentions do not trigger portraits
- Manual place backgrounds
- Adjustable place-background opacity
- Restore-to-theme background action

## Place Background Note

Tavo 1.x supports plugin-owned `files/...` paths for chat backgrounds. Version 1.5.0 therefore defaults to:

- **Local Tavo copy — recommended**
- **Original source URL — fallback**

Existing users who previously selected the source-URL preference keep that selection until they change it.

## Installation

Tavo plugins are zip-format `.tpg` packages with `manifest.json` at the archive root.

### Automated GitHub build

Every push to `main` runs **Build Tavo Plugin** under GitHub Actions. A successful run produces a `tavo-visual-library` artifact containing the installable `.tpg` plus its SHA-256 checksum.

Open the latest successful **Build Tavo Plugin** run, then download the artifact from its **Artifacts** section.

### Build locally

macOS / Linux / Git Bash:

```bash
bash scripts/build.sh
```

Windows PowerShell:

```powershell
./scripts/build.ps1
```

The resulting package is written to:

```text
dist/tavo-visual-library-1.5.0.tpg
```

Then:

1. In Tavo, open **Settings → Plugins → Install**.
2. Select the generated `.tpg` file.
3. Enable the plugin.
4. Make sure **Advanced Rendering** is enabled for the chat.
5. Open **Tavo Visual Library** from the chat sidebar.

## Manual Commands

```text
/show Skye
/show chat:Skye
/show campaign:Skye
/show global:Skye
/show
```

`/show` by itself opens the Visual Library.

Visual-reference images are appended as assistant-side visual bubbles so the command does **not** create a user turn or move the story forward.

## Campaign Scope

**Campaign** is the recommended scope for recurring RPG characters and places that should survive a fresh chat session without leaking into unrelated universes.

When StoryState is active, Visual Library automatically reads StoryState's compact `com.hooch88.tavo.campaignIdentity` bridge and uses its stable campaign ID as the namespace. A `storyState.state.campaign.id` fallback is retained for StoryState dev6 compatibility. StoryState's session handoff preserves this ID, so the same campaign visuals appear in the next session automatically.

Without StoryState, Visual Library can create or select its own campaign for the current chat. Campaign metadata and image files are stored globally so they can survive chat boundaries, but campaign entries are cataloged under a campaign-specific key and only the active campaign is loaded.

Use **Copy This Chat → Campaign** to duplicate existing chat-scoped visual references into the current campaign. Existing chat entries remain untouched. If a character/place with the same canonical name and type already exists in the campaign, the copy operation skips it.

Scope precedence for unqualified `/show` and Smart Invocation is:

1. **This Chat**
2. **Campaign**
3. **Global**

That means keeping a chat-scoped original after copying it to Campaign does not make Smart Invocation ambiguous.

## Bulk library management

The Library tab supports multi-select management for larger casts and location libraries:

- select individual entries with checkboxes;
- **Select Visible** to select the current search/filter result;
- **Select All** to select every entry currently available to this chat;
- batch-change **Category** between Character and Place;
- batch-move **Library Location** between This Chat, Campaign, and Global.

Scope moves migrate the stored image when Tavo's physical file scope changes. Campaign ↔ Global moves reuse the existing global file safely because Campaign is a logical namespace over global file storage. One confirmation applies to the whole batch; entries that fail remain selected so they can be corrected or retried.

## Smart Invocation

Smart Invocation is optional and disabled by default.

Plugin settings provide:

- Off
- Characters only
- Places only
- Characters and places
- Repeat cooldown in messages
- Maximum automatic images per narrator message

Matching supports saved names, aliases, and unique parts of canonical names. The matcher ignores known Parallel/off-screen/tracker sections so an NPC mentioned only outside the active scene does not automatically appear.

## Image Import

Tavo 1.2.7's native file picker is the recommended import path. The plugin accepts common image formats up to 20 MB and stores the selected file in the entry's physical chat/global scope.

URL import remains available for supported sharing pages. Downloads and reads have time limits, payloads are capped at 20 MB, page inspection is capped at 2 MB, and failed probes are removed.

## Permissions

The plugin requests:

- `input` — intercept `/show` commands
- `message` — read narrator replies and append visual bubbles
- `variable` — store gallery and Smart Invocation state
- `file` — persist imported images
- `network` — retrieve image URLs/pages during import

## Source Layout

```text
manifest.json
entry.js
locales/
  en.json
ui/
  panel.html
scripts/
  build.sh
  build.ps1
tests/
  campaign-scope.test.cjs
.github/workflows/
  build.yml
```

## Development Status

Version 1.5.0 hardens the Tavo 1.2.7 import and invocation paths while retaining the campaign and bulk-management features from 1.3–1.4. Device-picker imports and local place backgrounds should be validated on Android before release.
