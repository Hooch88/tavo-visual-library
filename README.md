# Tavo Visual Library

A Tavo plugin for reusable **character** and **place** images in AI role-playing chats.

Tavo Visual Library can import images from direct image URLs or supported image-host sharing pages, store a local copy in Tavo, organize entries by chat/global scope, display saved portraits without advancing the story, and optionally invoke visuals automatically when the narrator mentions a saved character or place.

**Current version: 1.2.2**

## Features

- Character and place image library
- Chat-scoped or global entries
- Name, aliases, and description metadata
- Import from direct image URLs
- Automatic resolution of common image-host page URLs such as ImgBB sharing pages
- Local image persistence through Tavo file storage
- Image preview, edit, and delete controls
- Manual **Show in Chat** without creating a user turn
- `/show Name`, `/show chat:Name`, and `/show global:Name`
- Smart Invocation for narrator mentions
- Configurable Smart Invocation cooldown and maximum images per narrator message
- Parallel/off-screen tracker filtering so tracker-only mentions do not trigger portraits
- Manual place backgrounds
- Adjustable place-background opacity
- Restore-to-theme background action

## Place Background Note

Live testing found that Tavo currently renders place backgrounds reliably when the plugin uses the original imported **source URL**.

The same images work normally from Tavo local storage in the gallery, preview, and chat bubbles, but a local Tavo file path may render as a black background when used through `tavo.chat.update({ background: ... })`.

For that reason, v1.2.2 defaults to:

- **Source URL — recommended**
- **Local Tavo copy — experimental**

The gallery itself still keeps Tavo's local stored copy.

## Installation

Tavo plugins are zip-format `.tpg` packages with `manifest.json` at the archive root.

Build the package from this repository, then install it in Tavo:

### macOS / Linux / Git Bash

```bash
bash scripts/build.sh
```

### Windows PowerShell

```powershell
./scripts/build.ps1
```

The resulting package is written to:

```text
dist/tavo-visual-library-1.2.2.tpg
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
/show global:Skye
/show
```

`/show` by itself opens the Visual Library.

Visual-reference images are appended as assistant-side visual bubbles so the command does **not** create a user turn or move the story forward.

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

Tavo's Android plugin surface does not currently expose a native photo-library picker to plugins, so imports begin from a URL.

For supported sharing pages, the plugin attempts to locate the real image automatically, validates that the downloaded bytes are an image, then saves its own Tavo copy.

## Permissions

The plugin requests:

- `input` — intercept `/show` commands
- `message` — read narrator replies and append visual bubbles
- `variable` — store gallery and Smart Invocation state
- `file` — persist imported images
- `network` — retrieve image URLs/pages during import
- `generate` — receive generation lifecycle notifications for Smart Invocation

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
```

## Development Status

Version 1.2.2 is the current tested baseline. Character Smart Invocation, `/show`, URL/page importing, gallery controls, and source-URL place backgrounds have been exercised in the Android Tavo app.
