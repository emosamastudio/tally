---
name: tally-use
description: Codex workflow for managing Tally task ledgers safely through the tally CLI. Use when working in a Tally-enabled repo with .tally/tally.json, tally commands, round start/close, task status/evidence, plan links, ledger validation, dashboard/graph/export, or release/update of Tally agent skills.
---

# Tally Use

Use Tally as the project task ledger and scheduling gate. Treat `.tally/tally.json` as data owned by the `tally` CLI, not as a file to edit by hand.

## Core rules

- Never edit `.tally/tally.json` directly. All writes must go through `tally` commands.
- Prefer JSON output for agent work: use `--json` or `--json-output` whenever the command supports it.
- Read `.tally/tally.json` only to understand task details after checking CLI state.
- Put newly discovered work into the ledger; do not silently expand the current round.
- Use batch commands when multiple task IDs share the same action.
- Record completion with structured evidence: `--evidence`, `--test`, `--commit`, `--review`, `--provider`, `--notes`, and `--no-forbidden` when relevant.
- If a task is linked to an implementation plan, run `tally plan check --json` before executing it.

## First actions

```bash
tally status --json
```

Then inspect the ledger only if details are needed:

```bash
cat .tally/tally.json
```

Choose one lane:

| Lane | Command path |
| --- | --- |
| Preview work | `tally round start --dry-run --auto-retry --json` |
| Start work | `tally round start "scope" --auto-retry --json` |
| Complete tasks | `tally task done <ids> --evidence "..." --test "..." --commit "..." --review "..." --no-forbidden --json` |
| Backfill done evidence | `tally task evidence <done-ids> --evidence "..." --test "..." --commit "..." --review "..." --no-forbidden --json-output` |
| Repair historical evidence gaps | `tally repair missing-evidence --dry-run --json` then `tally repair missing-evidence --evidence "..." --test "..." --commit "..." --review "..." --no-forbidden --json` |
| Add planned tasks | `tally task add --template <file> --json-output` |
| Link plans | `tally plan register <path> --json-output` then `tally task link-plan <id> --plan <plan-id> --task-ref "<ref>" --json-output` |
| Validate ledger | `tally lint --json` and `tally check --json` |
| Close round | `tally round close --auto-next --auto-retry --integrate --json` |
| Visualize | `tally dashboard` or `tally graph --json` |

## Round workflow

```bash
# Preview eligible tasks without claiming them
tally round start --dry-run --auto-retry --json

# Claim a safe batch
tally round start "scope" --auto-retry --json

# After implementation, mark tasks done with evidence
tally task done U-001 U-002 --evidence "completed" \
  --test "pnpm test" --commit "abc123" --review "approved" --no-forbidden --json

# Close, integrate, and optionally claim the next safe batch
tally round close --auto-next --auto-retry --integrate --json
```

`--auto-retry` excludes conflicting or gated tasks and retries. `--auto-next` may cleanly skip the next round when no eligible tasks remain; check `nextRoundSkipped.reason` in JSON output.

## Safety gates

Round start enforces:

- write-scope conflict checks for overlapping paths
- dependency completion
- feature freeze restrictions
- max-risk gating from `.tally/config.yaml`
- approval requirements for high or critical risk tasks

If a gate rejects work, do not bypass it by editing the ledger. Either choose a safer task, add missing approval, or record a blocked task with the CLI.

## Plan integration

Tally does not replace implementation plans. Plans explain how to build; Tally tracks claims, execution state, evidence, drift, and handoff.

```bash
tally plan register docs/superpowers/plans/example.md --json-output
tally task link-plan U-001 --plan plan:example --task-ref "Task 1" --json-output
tally plan check --json
tally export --format agent-brief --task U-001
```

Use `tally plan check --json` to detect missing plan files, content hash drift, unknown plan IDs, and stale task references.

## Historical evidence repair

Use repair commands only for historical/imported ledgers where done tasks are missing evidence. Do not present repair text as fresh test or review proof unless that work was actually rerun or reviewed.

```bash
tally audit evidence --json
tally repair missing-evidence --dry-run --json
tally repair missing-evidence \
  --evidence "Historical completion imported before evidence enforcement" \
  --test "not rerun during repair" \
  --commit "abc123" \
  --review "missing prior review evidence recorded" \
  --no-forbidden \
  --json
```

Safety rules:

- `tally task evidence` only accepts `status: done` tasks.
- Existing evidence is not overwritten unless `--append` or `--replace` is explicit.
- Repair does not change status, order, dependencies, next action, or completion timestamps.
- `requiresReview: true` done tasks require `--review` unless `--allow-missing-review` is explicit.

## Important fields

- Paths: `.tally/tally.json`, `.tally/config.yaml`
- Status: `pending`, `in_progress`, `blocked`, `hold`, `deferred`, `done`
- Priority: `P0`, `P1`, `P2`
- Risk: `low`, `medium`, `high`, `critical`
- Lane: `contract`, `writer`, `runtime`, `ui`, `test`, `review`
- Feature status: `design`, `contract_frozen`, `implementing`, `stable`
- Task IDs: `U-xxx` unfinished, `D-xxx` done, `B-xxx` blocked, `R-YYYY-MM-DD-NNN` round

## Config defaults

```yaml
agent: { id: main }
round: { maxTasks: 10, allowParallel: false }
gates:
  requireFeature: true
  requireReview: false
  featureFreeze: []
  maxRisk: high
  detectWriteConflicts: true
dashboard: { port: 5173 }
```

## Release discipline

When changing Tally CLI behavior, ledger schema, config shape, dashboard behavior, or recommended agent workflow, update the repo skill files in the same release:

- `skills/codex/tally-use/SKILL.md` for Codex
- `skills/claude-code/tally.md` and `skills/claude-code/skill.json` for Claude Code compatibility
- `skills/copilot-cli/tally.yaml` for Copilot CLI
- `CHANGELOG.md` for user-visible skill-facing changes
