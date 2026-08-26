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
- Consolidated the three hard-coded OpenRouter free presets into one managed
  preset that refreshes from OpenRouter's models API and falls back to the
  stable free-model router when the API is unavailable.
- Made the managed OpenRouter Free preset read-only while retaining automatic
  refresh and adding an explicit refresh control in model settings.
- Redesigned the popup to match the settings page visual system and make the
  current site's AInput status easier to scan with compact, text-only rows.

### Removed

- Removed the Enhance Prompt menu action and its processing flow.
- Removed the Auto-Reply site toggle from the popup.

## 1.7 - 2026-08-26

### Added

- Added configurable custom actions to the AInput action menu, with support
  for using either the focused input value or readable page context.

### Changed

- Custom actions now behave like preset actions: selecting one runs it
  immediately and streams the result into the focused input without opening a
  modal.
- The original input value is restored when a custom action fails.
