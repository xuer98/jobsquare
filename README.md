# jobsquare

A personal job-listing watcher. It polls company career boards across many ATS
platforms, keeps only the listings you care about, remembers what it has already
seen, and notifies you about anything **new** or **changed**.

- **Many sources, one shape.** Each board is normalized into a common `Job`
  record regardless of which ATS it came from.
- **Bespoke fetchers** for companies with no standard ATS (Google, Meta, Microsoft,
  Netflix, Amazon, D. E. Shaw, Two Sigma, Optiver) sit behind the same interface as the slug-based ones.
- **Stateful dedup.** A local SQLite DB tracks every listing so repeat runs only
  surface diffs, not the whole board.
- **Pluggable notifiers.** Console always; Slack / generic webhook / email
  activate when their environment variables are set.

## How it works

```
sources.yaml ─▶ fetch_all ─▶ filter_jobs ─▶ Store.diff ─▶ dispatch
 (config)       (per-ATS      (keywords,     (SQLite      (console/Slack/
                 fetchers)     location,       dedup →      webhook/email)
                               recency)        new/changed)
```

1. **Fetch** — every configured source is fetched concurrently (`fetchers.py`).
   Failures are logged, not fatal: one broken board won't sink a run.
2. **Filter** — keep listings matching your include/exclude/location/recency
   rules (`filters.py`).
3. **Dedup** — compare against the SQLite store by a stable key; classify each as
   new, changed (title/location/url/department shifted), or unchanged
   (`store.py`).
4. **Notify** — dispatch new + changed listings to every active notifier
   (`notify.py`).

## Quick start

Requires **Python 3.12+**.

```bash
pip install -r requirements.txt

# preview matches without writing dedup state or notifying
python cli.py --config sources.yaml --dry-run

# real run: persist dedup state + fire notifications
python cli.py --config sources.yaml
```

> The dedup DB (`jobs.db`, configurable) is the source of truth for what counts
> as "fresh". The first real run will treat the entire matched board as new.

## Configuration (`sources.yaml`)

```yaml
db: jobs.db          # SQLite dedup store (default: jobs.db)
concurrency: 8       # max simultaneous fetches (default: 8)

sources:
  - { ats: greenhouse, company: stripe }
  - { ats: ashby,      company: ramp }
  # ...

filters:
  max_age_days: 7                      # drop listings older than a week (see note)
  include_keywords: [software engineer, backend]
  exclude_keywords: [intern, manager]
  locations: [United States, New York, Remote]
```

### Supported platforms

Most boards are identified by a single `company` **slug** taken from the public
careers URL:

| `ats` | Slug source | Notes |
|-------|-------------|-------|
| `greenhouse` | `job-boards.greenhouse.io/<company>` | |
| `lever` | `jobs.lever.co/<company>` | salary parsed when present |
| `ashby` | `jobs.ashbyhq.com/<company>` | salary via `compensation` |
| `smartrecruiters` | `jobs.smartrecruiters.com/<company>` | |
| `recruitee` | `<company>.recruitee.com` | |
| `workable` | `apply.workable.com/<company>` | |

**Workday** needs `host` / `tenant` / `site` instead of a slug, derived from the
career URL (e.g. `https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite`):

```yaml
  - ats: workday
    company: nvidia                      # label for output + dedup key
    host: nvidia.wd5.myworkdayjobs.com
    tenant: nvidia                       # set explicitly if != host's first label
    site: NVIDIAExternalCareerSite
```

**Bespoke sources** have no shared ATS and bring their own fetcher:

| `ats` | Config | Notes |
|-------|--------|-------|
| `google` | `query` (recommended), `location`, `max_pages` | Global board is huge — narrow server-side with `query` |
| `meta` | `query` (optional), `remote_only` | GraphQL; whole board in one request. `doc_id` may rotate on Meta redeploys |
| `microsoft` | `query` (optional), `location`, `max_pages` | Phenom JSON API, paginated; provides real post dates |
| `netflix` | `query` (optional), `location`, `max_pages` | Eightfold JSON API (`explore.jobs.netflix.net`); real post dates |
| `amazon` | `query` (optional), `max_pages` | Public `amazon.jobs` JSON API, paginated; real post dates |
| `deshaw` | `company` (label) | Single-page careers site |
| `twosigma` | `company`, `max_pages` | Avature portal, paginated |
| `optiver` | `company`, `max_pages` | JSON API, paginated |

```yaml
  - { ats: google,  query: "software engineer", location: "United States" }
  - { ats: deshaw,   company: deshaw }
  - { ats: twosigma, company: twosigma }
  - { ats: optiver,  company: optiver }
```

### Filters

All keys are optional; omit a key to skip that check. A listing is kept only if
it passes **every** configured check.

| Key | Effect |
|-----|--------|
| `include_keywords` | Keep only if title/department/location matches at least one |
| `exclude_keywords` | Drop if any matches title/department/location |
| `locations` | Keep only if the location contains one of these (substring, case-insensitive) |
| `max_age_days` | Drop listings whose posted date is older than N days |

> **Recency caveat:** `max_age_days` only drops a listing when its posted date is
> **confirmed** older than the cutoff. Sources that don't expose a machine-readable
> date (Workday, Google, Meta, D. E. Shaw, Two Sigma, Optiver) carry no timestamp, so
> their listings are **kept** rather than silently dropped. Source dates come in
> many formats (Lever sends unix milliseconds, others ISO-8601); `parse_posted_at`
> in `models.py` normalizes them.

> **Location format varies by source.** Google emits `"New York, NY, USA"`, so a
> `locations: [United States]` filter won't match — use `US`/`USA`. Optiver emits
> city names like `Amsterdam`. Check what a source returns before tightening this list.

## Notifications

The console notifier always runs. Others activate when their env vars are set:

| Notifier | Required env |
|----------|--------------|
| Slack | `SLACK_WEBHOOK_URL` |
| Webhook | `WEBHOOK_URL` (receives `{new, changed}` JSON) |
| Email | `SMTP_HOST`, `EMAIL_TO` (+ optional `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`) |
| SMS (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_TO` |

The SMS text is a compact, ASCII-only summary (counts + the new roles, capped
with a `+N more` overflow) to keep it to as few Twilio segments as possible.

Salary is shown inline when a source provides it (currently Ashby and some Lever
boards).

## Scheduling

`.github/workflows/scrape.yaml` is a GitHub Actions workflow that runs **every 12
hours** (00:00 & 12:00 UTC) and commits the updated `jobs.db` back to the repo so
dedup state persists across runs. Add your notifier secrets in the repo's Actions
secrets — `SLACK_WEBHOOK_URL` for Slack; `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_TO` for SMS; and `SMTP_HOST`,
`EMAIL_TO` (+ optional `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`) for email.

## Agent CLI (`/jobsquare`)

A [career-ops](https://github.com/santifer/career-ops)-style command center on
top of the scraper, integrated with **Claude Code** only. The Python pipeline
stays the scraping engine; the agent layer adds judgment — ranking fresh
listings against your preferences and queueing the promising ones.

```bash
python agent.py            # interactive Claude session in the repo (/jobsquare available)
python agent.py scan       # headless scan: claude -p "/jobsquare scan"
python agent.py scan -i    # same, but in an interactive session
python agent.py pipeline 5 # batch-evaluate the 5 oldest pending inbox entries
python agent.py match {url} # score a JD against cv.md: A-F rubric + verdict
python agent.py pdf {url}  # tailored ATS CV PDF for a JD (needs cv.md, see below)
```

`/jobsquare scan` **never scrapes portals** — the pipeline already did. It:

1. dumps listings first seen in `jobs.db` since the last scan marker
   (`python agent.py db-new`; first run covers the last 7 days),
2. ranks them STRONG / MAYBE / SKIP against `config/profile.yml`
   (copy `config/profile.example.yml`; falls back to `sources.yaml` filters),
3. appends keepers to `data/pipeline.md`,
4. advances the marker (`python agent.py db-mark "<watermark>"`) — only after
   queueing succeeded, so a failed run is retried on the next scan.

The marker lives in a `meta` table inside `jobs.db`; `db-new` never advances
it, so dump-only runs are side-effect free. Mode instructions live in
`modes/scan.md` with shared context in `modes/_shared.md`.

`/jobsquare pipeline [N | company | all] [pdf]` drains the inbox: for each
pending `data/pipeline.md` entry it fetches the JD (dead links get closed as
expired), applies the `match` rubric with a tighter budget (≤1 web lookup per
entry), writes a report, and annotates the entry ` | eval {F}/5 {date}`.
With 3+ entries it fans out to parallel worker agents (≤5 at once) — workers
only write their own reports; the main loop is the sole editor of
`pipeline.md`, so parallel runs can't corrupt it. Add `pdf` to also render
CVs for anything scoring ≥3.5. Discards are audited in `data/discard.log`.
The intended loop: **scan → pipeline → pdf the top scorers → apply**.

`/jobsquare match {JD}` (alias `oferta`) scores a JD against your `cv.md`:
a requirement-by-requirement CV↔JD mapping with cited evidence and honest
gaps, A–E dimension scores (CV match 35%, targets 20%, comp 15%, culture 15%,
red flags 15%) rolled into a global verdict — ≥4.5 apply now, <3.5 skip —
plus a posting-legitimacy tier (ghost-job/contractor-phrasing signals, ≤3 web
lookups). Reports land in `reports/` (gitignored) with a machine-readable
summary block; scored pipeline entries get annotated ` | eval {F}/5 {date}`.
Score ≥3.5 ends with the top-5 CV changes to feed straight into `pdf` mode.

`/jobsquare pdf {JD}` builds a one-page, ATS-optimized CV tailored to a JD
(pasted text, a URL, or a company match against `data/pipeline.md`). It reads
**`cv.md`** — your master CV at the repo root (gitignored; create it once with
`# Name`, `## Summary`, `## Experience`, `## Projects`, `## Education`,
`## Skills`) — fills `templates/cv-template.html`, and renders via
`python agent.py pdf-render`, which ATS-normalizes text (smart quotes, dashes,
bullets → ASCII) and prints to PDF with headless Chrome (auto-detected;
`CHROME_PATH` overrides). Tailoring reorders and reframes what cv.md supports —
it never invents experience. Output lands in `output/` (gitignored).

## Project layout

| File | Responsibility |
|------|----------------|
| `cli.py` | Argparse entrypoint |
| `pipeline.py` | Orchestration: load config → fetch → filter → dedup → notify |
| `fetchers.py` | Async per-ATS fetchers + the `FETCHERS` registry |
| `filters.py` | Keyword / location / recency filtering |
| `models.py` | The `Job` dataclass, `parse_posted_at`, identity/dedup hashing |
| `store.py` | SQLite dedup store + schema migrations + scan marker |
| `notify.py` | Console / Slack / webhook / email / SMS notifiers |
| `agent.py` | Claude agent CLI: launcher + db-new/db-mark/pdf-render helpers |
| `modes/` | Agent mode instructions (`_shared.md`, `scan.md`, `pipeline.md`, `match.md`, `pdf.md`) |
| `templates/cv-template.html` | ATS CV template (`pdf` mode fills a copy) |
| `data/pipeline.md` | Offer inbox fed by `/jobsquare scan` |
| `config/profile.example.yml` | Candidate preference template for agent ranking |
| `sources.yaml` | Your sources + filters |
| `.github/workflows/scrape.yaml` | GitHub Actions schedule |

## Extending: add a new ATS

For a standard JSON board, write a `parse_*` returning `list[Job]`, add an
endpoint builder, and register it in `FETCHERS`:

```python
def _foo_url(c: str) -> tuple[str, str]:
    return "GET", f"https://api.foo.com/boards/{c}/jobs"

def parse_foo(company: str, data: dict) -> list[Job]:
    return [Job(source="foo", company=company, external_id=str(j["id"]),
                title=j["title"], url=j["url"], location=j.get("loc", ""))
            for j in data["jobs"]]

FETCHERS["foo"] = _simple(_foo_url, parse_foo)
```

For boards with no JSON API (pagination, HTML scraping, token dances), write a
full `async def fetch_foo(client, source) -> list[Job]` instead — see
`fetch_google`, `fetch_deshaw`, `fetch_twosigma`, `fetch_optiver` for the pattern.