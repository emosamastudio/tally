# Changelog

## 0.5.0 - 2026-06-01

### Added

- Added a plan registry under `_meta.plans[]` for linking Tally tasks to external implementation plans.
- Added `tally plan register <path>` to register Superpowers-style Markdown plans with title, path, kind, required skill, status, and SHA-256 content hash.
- Added `tally plan list` and `tally plan check` for plan visibility and drift checks.
- Added `tally task link-plan <id> --plan <plan-id> --task-ref <ref>` to bind a task to a registered plan.
- Added task-level plan fields: `planRef`, `planPath`, `planTaskRef`, and `planContentHash`.
- Added plan references to `tally export --format agent-brief`.
- Added a Dashboard Plan Registry panel under the planning section.
- Added plan metadata display and plan-aware search in the Dashboard task table.
- Added demo data for plan registry and linked tasks.
- Added the project-standard `.tally/tally.json` and `.tally/config.yaml` paths to CLI docs, reader/writer paths, and generated ledgers.
- Added package publish allowlist so the npm package contains built `dist/` output instead of shipping source and tests.

### Changed

- `tally round close --auto-next --json` now treats "no eligible next task" as a clean completion with `nextRoundSkipped.reason = "no_eligible_tasks"` instead of failing the close.
- Dashboard Vite dev and preview servers now use fixed port `5173` with strict port mode.
- `tally dashboard` now reports a clear error when the configured port is already in use.
- README, schema docs, and agent skill files now describe the plan integration workflow.
- Dashboard planning/execution navigation now uses the consolidated section layout with lazy-loaded heavier panels.
- Dashboard round history is consolidated into the current round panel; the old standalone round timeline component is removed.
- `tally upgrade` now requires the ledger to lint cleanly before applying versioned migrations; it no longer silently backfills arbitrary older document shapes.

### Standardization

- `.tally/tally.json` is the only supported project ledger path.
- `.tally/config.yaml` is the only supported project-local config path.
- `tally init` creates new ledgers with `_meta.plans: []`.
- `tally plan check` only applies plan-specific validation when plans or plan-linked tasks exist.
- Ledgers are expected to match the current schema before `tally upgrade` runs; `upgrade` no longer performs broad implicit backfills.

### Validation

- `npm run build` passed.
- `npm test` passed.
- CLI test suite: 8 test files, 336 tests.
- `npm pack -w cli --dry-run` passed.
