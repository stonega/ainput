# AInput changelogs

This changelog is organized by the extension version declared in
`public/manifest.json`.

## 1.8 - 2026-08-26

### Added

- Added Chrome Built-in AI support with availability checks, model setup, and
  on-device prompt execution.
- Added DeepSeek as a configurable model provider.
- Added model editing and validation in the settings page.

### Changed

- Updated the AInput extension release version to 1.8.
- Refreshed the extension icon set and model-settings experience.

### Removed

- Removed the Enhance Prompt menu action and its processing flow.

## 1.7 - 2026-08-26

### Added

- Added configurable custom actions to the AInput action menu, with support
  for using either the focused input value or readable page context.

### Changed

- Custom actions now behave like preset actions: selecting one runs it
  immediately and streams the result into the focused input without opening a
  modal.
- The original input value is restored when a custom action fails.
