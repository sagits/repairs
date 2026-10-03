## Agent skills

### Issue tracker

Issues live as GitHub issues in `sagits/repairs`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, with label strings unchanged (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Decisions

`DECISIONS.md` records every place `PRD.md` was left open or turned out to be wrong, newest last.
**Read it before working, not only when writing to it** — the PRD is the plan as written, and this
is the plan as it survived contact. Where the two disagree, `DECISIONS.md` is the one that holds.
