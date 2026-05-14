# Changelog

All notable changes to **Todoist Graph** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

When you tag a release: add a dated `## [x.y.z]` section below, move bullets out of here, bump `package.json`, update compare links at the bottom, then `npm run release` (or rely on CI from the tag).

---

## [1.0.9] - 2026-05-14

### Added

- Setting to hide the stats row (totals, streak, best day); persists with other display preferences.

### Changed

- `CHANGELOG.md` in the repo; `npm run release` publishes the matching version section to GitHub. README documents the new setting.

### Fixed

- GitHub Actions: only the macOS release job generates auto release notes so the Windows job no longer duplicates the “Full Changelog” footer.

## [1.0.8] - 2026-05-14

### Added

- Application icon for the packaged app and window.

## [1.0.7] - 2026-05-13

### Fixed

- Fetch the Todoist completion range that matches what is visible in the graph (correct activity window).

## [1.0.6] - 2026-05-12

### Fixed

- Main window close control (variable naming bug).

## [1.0.5] - 2026-05-12

### Added

- Close window control and related UI updates.

## [1.0.4] - 2026-05-12

### Changed

- GitHub Actions release workflow improvements.

## [1.0.3] - 2026-05-12

### Fixed

- CI releases: pass `GITHUB_TOKEN` for macOS and Windows release steps.

## [1.0.2] - 2026-05-12

### Added

- Windows build (NSIS) and GitHub Actions workflow for releases.

### Changed

- Theme handling refactor; additional Todoist-aligned themes and UI polish.
- README updates (features, setup guidance, demo images, color scale).

## [1.0.1] - 2026-05-11

### Added

- In-app settings (theme, zoom, optional day labels).
- Electron-side settings persistence; Todoist API rate limiting and clearer error handling.

### Changed

- Token management and settings UI flow.

## [1.0.0] - 2026-05-11

### Added

- Initial public release: Electron desktop app with Todoist contribution graph.
- Todoist REST API v1 integration; token storage and graph UI.

[Unreleased]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.9...HEAD
[1.0.9]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/mohitvirli/todoist-graph/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mohitvirli/todoist-graph/releases/tag/v1.0.0
