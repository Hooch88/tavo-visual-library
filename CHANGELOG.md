## 1.4.0

- Added bulk library management with multi-select checkboxes.
- Added Select Visible, Select All, and Clear selection actions.
- Added batch category changes between Character and Place.
- Added batch library-location moves between This Chat, Campaign, and Global.
- Bulk location moves migrate stored image bytes when physical Tavo storage scope changes, and keep failed entries selected for retry.
- Renamed some UI labels from type/scope to the clearer category/library location wording.

## 1.3.1

- Fixed StoryState-managed campaign controls appearing even though they are intentionally unavailable.
- Clarified the active campaign and campaign/chat entry counts in the Library UI.
- Made This Chat → Campaign copy direct and non-destructive with explicit disabled-state messaging.
- StoryState campaigns are usable immediately without a separate Visual Library create/select step.

# Changelog

## 1.3.0

- Add Campaign scope between This Chat and Global.
- Automatically bind Campaign scope to StoryState's stable campaign ID when available.
- Add standalone create/select campaign support when StoryState is not installed.
- Add safe **Copy This Chat → Campaign** migration that leaves chat originals untouched.
- Keep campaign image files in Tavo global file storage while isolating catalogs by campaign ID.
- Add `/show campaign:Name` and scope precedence: This Chat → Campaign → Global.
- Keep Smart Invocation deterministic after chat entries are copied into Campaign scope.

## 1.2.2

- Make source-URL place backgrounds the recommended/default mode after live Tavo testing.
- Keep local Tavo-copy backgrounds available as experimental because they may render black in the current app.

## 1.2.1

- Add source-URL background diagnostic mode.

## 1.2.0

- Add manual Place → Set Background.
- Add adjustable background opacity.
- Add Restore Theme Background.

## 1.1.6

- Ignore Parallel/off-screen/tracker sections during Smart Invocation matching.

## 1.1.1–1.1.5

- Prevent `/show` from advancing the story by using assistant-side visual bubbles.
- Stabilize Smart Invocation triggers, matching priority, name-part matching, cooldown behavior, and diagnostics.

## 1.0.3–1.0.4

- Resolve supported image-host share pages such as ImgBB to the actual image automatically.
- Add download validation and gallery UI polish.

## 1.0.0–1.0.2

- Initial Visual Library, chat/global scopes, image import experiments, preview, edit/delete, and `/show` support.
