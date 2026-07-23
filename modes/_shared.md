# jobsquare — Shared Context (read before any mode)

## What this repo is

A Python job-listing watcher. A scheduled pipeline (`cli.py` → `pipeline.py`)
scrapes every board in `sources.yaml` into a SQLite dedup store (`jobs.db`) and
fires notifications. **By the time an agent mode runs, scraping has already
happened.** Agent modes never fetch job boards — they read and judge state the
pipeline produced.

## Sources of truth

| File | Contains | Agent may write? |
|------|----------|------------------|
| `jobs.db` | every listing seen (table `jobs`), scan marker (table `meta`) | only via `python agent.py db-mark` |
| `sources.yaml` | boards + include/exclude/location/recency filters | no |
| `config/profile.yml` | candidate targets: titles, seniority, locations, comp floor, deal-breakers, `language.output` | no |
| `cv.md` | the candidate's master CV — the only source of biographical facts | **never** |
| `data/pipeline.md` | offer inbox — Pending / Done | yes (append, tick) |
| `writing-samples/` | the candidate's real writing, for voice calibration (skip its README.md) | no |
| `voice-dna.md` | anti-AI-slop hard rules; applied last, wins conflicts (optional) | no |
| `templates/` | HTML templates (CSS is fixed; agents fill `data-slot`s in a copy) | no |
| `output/` | generated CVs (html + pdf), gitignored | yes |
| `reports/` | JD evaluations, one per claimed id: `{NNN}-{company}-{role}.md` | yes |
| `interview-prep/` | interview intel docs + `story-bank.md` (candidate's STARs) | yes |
| `data/discard.log` | TSV audit of expired/pre-screen-skipped entries | yes (append) |
| `modes/_custom.md` | user house rules (optional) | no |

## `jobs` table columns

`key` (`{ats}:{company}:{external_id}`), `source`, `company`, `external_id`,
`title`, `url`, `location`, `department`, `employment_type`, `posted_at`,
`salary_range`, `content_hash`, `first_seen`, `last_seen`.
Timestamps are ISO-8601 UTC. `salary_range` and `posted_at` are best-effort and
often empty — treat empty as *unknown*, never as a negative signal.

## Deterministic helpers (never hand-roll SQL against jobs.db)

- `python agent.py db-new` → JSON `{since, first_run, count, total_new,
  truncated, watermark, jobs[]}` — listings first seen **after the last-scan
  marker** (first run: last 7 days; `--since-days N` overrides).
  `--posted-days N` keeps only listings posted in the last N days (undated
  ones stay, counted in `undated_kept`, unless `--dated-only`); drops are
  reported as `dropped_old`/`undated_dropped`, never silent.
- `python agent.py db-mark "<watermark>"` → advances the marker. Mark **only
  after** results were presented/queued, and always with the exact `watermark`
  from the dump you processed — never `--now`, which would silently skip rows
  that landed mid-analysis.
- `python agent.py pdf-render <in.html> [out.pdf] [--format letter|a4]` →
  ATS-normalizes text (smart quotes/dashes/bullets → ASCII, tags and CSS
  untouched) and prints to PDF via headless Chrome. Agents write the HTML;
  only this helper renders it.
- `python agent.py report-num` → atomically claims the next report id
  (prints `042`-style). Claim **right before writing** the report file —
  never reuse, guess, or hand-compute an id. Gaps from aborted runs are
  fine; collisions are not.

## `data/pipeline.md` entry contract

One line per pending offer, newest appended last:

```
- [ ] {url} | {company} | {title} | {location} | first_seen {YYYY-MM-DD}
```

Append ` | {salary_range}` when known. `match`/`pipeline` append ` | eval
{F}/5 {YYYY-MM-DD} #{NNN}` after scoring (`#NNN` = the report id; entry
stays unticked). When an entry is
handled — applied, rejected, or expired — tick `[x]` and append
` | done {YYYY-MM-DD}` (with a one-word reason when not applied). A URL
appears at most once in the whole file.

**Reading ticks:** the user edits this file by hand — treat any bracket
containing an `x` (`[x ]`, `[ x]`, `[X]`) as ticked, and a tick without
` | done` as closed-by-user (never resurrect it). When writing, always emit
the canonical `[x]`.

## Writing guardrail

Applies to **every sentence written as or about the candidate**: CV summaries
and bullets (`pdf`), free-text application answers (`apply`), report TL;DRs
and "if applying" angles (`match`/`pipeline`), and any future outreach text.

**Voice source, in priority order:**
1. `## Writing Style` section in `modes/_profile.md` — use it directly,
   no re-derivation.
2. Else `writing-samples/` (skip its README.md) — extract before writing:
   tone (formal↔conversational), typical sentence length, opening patterns,
   punctuation habits, preferred vocabulary ("built" vs "engineered"),
   prose-vs-bullets structure, first-person patterns, and words the
   candidate never uses.
3. Else default: direct, short sentences, active voice, native tech English.

`voice-dna.md`, when present, is applied **after** the above and wins every
conflict.

**Banned regardless of source** (the anti-cliché list): "passionate about",
"proven track record", "leveraged", "spearheaded", "synergies", "robust",
"cutting-edge", "demonstrated ability to". Corporate filler generally.
Prefer specific, named, quantified statements — "cut p95 2.1s → 380ms",
tools and projects by name — over abstractions. Vary sentence openings and
length; a page of identical cadence reads machine-written.

## Global rules

**NEVER:** invent facts about the candidate or a listing; submit or send
anything on the user's behalf (`apply` mode fills fields only after per-field
confirmation — the submit click is always the human's; see `modes/apply.md`);
write to `jobs.db` except via the helpers; re-scrape boards; drop a dumped
listing silently — every job is either queued or skipped with a stated reason.

**ALWAYS:** include the URL whenever a job is mentioned; keep prose terse —
output lands in a terminal; when ranking, read `config/profile.yml` if it
exists, else fall back to `sources.yaml` filters as the preference signal.
