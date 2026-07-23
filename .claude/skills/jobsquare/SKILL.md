---
name: jobsquare
description: AI job search command center -- evaluate offers, generate CVs, scan portals, track applications
arguments: mode
user_invocable: true
user-invocable: true
argument-hint: "[scan | pdf | match | pipeline | apply | interview-prep]"
license: MIT
---

# jobsquare -- Router

jobsquare is a job-search command center for Claude Code, layered on this
repo's Python scraping pipeline (`sources.yaml` → fetchers → `jobs.db`).
Adapted from career-ops; Claude is the only supported agent CLI.

## Invocation Notes (Claude only)

- Claude Code exposes this router as `/jobsquare` (skill at `.claude/skills/jobsquare`).
- `python agent.py` opens an interactive Claude session in the repo;
  `python agent.py scan` runs a headless scan (`claude -p "/jobsquare scan"`).
- Natural-language prompts route identically, e.g. "Run the jobsquare scan
  mode and summarize new matches."

## Mode Routing

Determine the mode from `$mode`:

| Input | Mode |
|-------|------|
| (empty / no args) | `discovery` -- Show command menu |
| `scan` | `scan` -- New listings in jobs.db since the last scan (rest of `$mode` = optional posted-at window, e.g. `3d` or `dated-only`) |
| `pdf` | `pdf` -- ATS-optimized CV PDF tailored to one JD (rest of `$mode` = JD text, URL, or pipeline.md match) |
| `match` | `match` -- Score a JD against cv.md: A-F rubric + verdict + report (rest of `$mode` = JD, like `pdf`) |
| `oferta` | `match` (career-ops alias) |
| `pipeline` | `pipeline` -- Batch-evaluate pending data/pipeline.md entries (rest of `$mode` = N, company, `all`, `pdf`) |
| `apply` | `apply` -- Live application assistant: reads the open form, drafts grounded answers, fills on confirmation, never submits. Interactive sessions only |
| `interview-prep` | `interview-prep` -- Company-specific interview intel doc (rest of `$mode` = `#NNN`, company, or JD, like `apply`) |
| `interview/prep` | `interview-prep` (career-ops alias) |

Any other input — upstream career-ops sub-commands (`cover`, `email`,
`tracker`, `batch`, `contacto`, `deep`, `interview` onboarding,
`interview/plan`, `interview/practice`, `interview/debrief`, …) as well as
pasted JD text or URLs (auto-pipeline) — is **not ported yet**: say exactly
that in one line, then show the discovery menu. Do not improvise an unported
mode.

---

## Output Language Directive

Before executing any mode, read `config/profile.yml` if it exists and resolve:

- `language.output` → ISO language code for human-facing output. Default: `en`.
- `language.modes_dir` → optional market-mode directory. This controls market vocabulary and local evaluation rules only.

Inject this directive after loading the mode instructions and before producing any user-visible content:

> Write all human-facing output in `{language.output}` regardless of the language of these instructions or of the job description. This includes reports, tracker notes, PDFs, cover letters, outreach, interview prep, form answers, and summaries. If `language.modes_dir` supplies market-specific vocabulary, keep the market logic but explain terms in `{language.output}` when needed.

`language.output` is authoritative for prose. `modes_dir` is market context; it must not force the prose language.

---

## Discovery Mode (no arguments)

Show this menu:

```
jobsquare -- Command Center (Claude)

Available commands:
  /jobsquare scan           → New listings in jobs.db since last scan → ranked → queued to data/pipeline.md
  /jobsquare pipeline [N|company|all] [pdf]
                            → Batch-evaluate pending inbox entries → eval annotations + reports/
  /jobsquare match {JD}     → Score a JD against cv.md: A-F rubric, gaps, verdict → reports/ (alias: oferta)
  /jobsquare pdf {JD}       → ATS-optimized CV PDF tailored to a JD (text, URL, or pipeline.md match; needs cv.md)
  /jobsquare apply [target] → Live application assistant: drafts + fills answers with you, NEVER submits (interactive only)
  /jobsquare interview-prep {target}
                            → Company-specific interview intel → interview-prep/ (target: #NNN, company, or JD)

Headless:  python agent.py scan · python agent.py pipeline 5 · python agent.py match {url} · python agent.py interview-prep {company}
Interactive-only:  python agent.py apply -i

Not ported yet (upstream career-ops modes): auto-pipeline, cover, email,
tracker, batch, contacto, deep, interview (onboarding), interview/plan,
interview/practice, interview/debrief.

Loop: scan → pipeline → pdf + interview-prep for the top scorers → apply yourself.

Inbox: data/pipeline.md (fed by scan)
```

---

## Context Loading by Mode

After determining the mode, load the necessary files before executing:

If `modes/_custom.md` exists, read it after `modes/_profile.md` and before the selected mode file. It contains user house rules and procedural preferences. It may override workflow/style defaults, but it never adds factual claims about the candidate.

### Modes that require `_shared.md` + their mode file

Read `modes/_shared.md` + `modes/_profile.md` (if exists) + `modes/_custom.md` (if exists) + `modes/{mode}.md`

Applies to: `scan`, `pdf`, `match`, `apply`, `interview-prep` (and every
future ported mode unless noted otherwise). `pdf`, `match`, `apply`, and
`interview-prep` run in the main loop, not a subagent — they need the
conversation for confirmations and follow-ups (`apply` hard-requires it:
every fill is user-confirmed; `interview-prep` offers to draft missing
stories after).

### Modes delegated to subagent

For `scan`, and for `pipeline` when 3+ entries are selected (one worker per
entry, ≤ 5 concurrent; workers never edit `data/pipeline.md` — the main loop
applies all edits after they return, per `modes/pipeline.md`): launch as a
worker/subagent with the content of `_shared.md` + `_profile.md` (if exists)
+ `_custom.md` (if exists) + the mode file (for pipeline workers:
`modes/match.md` + the worker protocol from `modes/pipeline.md`) injected
into the worker prompt:

```python
Agent(
  subagent_type="general-purpose",
  prompt="[output language directive]\n\n[content of modes/_shared.md]\n\n[content of modes/_profile.md if exists]\n\n[content of modes/_custom.md if exists]\n\n[content of modes/{mode}.md]\n\n[invocation-specific data]",
  description="jobsquare {mode}"
)
```

Execute the instructions from the loaded mode file.