# jobsquare

A personal job-listing watcher. It polls company career boards across many ATS
platforms, keeps only the listings you care about, remembers what it has already
seen, and notifies you about anything **new** or **changed**.

- **Many sources, one shape.** Each board is normalized into a common `Job`
  record regardless of which ATS it came from.
- **Bespoke fetchers** for companies with no standard ATS (Google, Meta,
  D. E. Shaw, Two Sigma, Optiver) sit behind the same interface as the slug-based ones.
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

Salary is shown inline when a source provides it (currently Ashby and some Lever
boards).

## Scheduling

`scrape.yaml` is a GitHub Actions workflow that runs every 30 minutes and commits
the updated `jobs.db` back to the repo so dedup state persists across runs. Set
`SLACK_WEBHOOK_URL` (and any other notifier secrets) in the repo's Actions
secrets.

## Project layout

| File | Responsibility |
|------|----------------|
| `cli.py` | Argparse entrypoint |
| `pipeline.py` | Orchestration: load config → fetch → filter → dedup → notify |
| `fetchers.py` | Async per-ATS fetchers + the `FETCHERS` registry |
| `filters.py` | Keyword / location / recency filtering |
| `models.py` | The `Job` dataclass, `parse_posted_at`, identity/dedup hashing |
| `store.py` | SQLite dedup store + schema migrations |
| `notify.py` | Console / Slack / webhook / email notifiers |
| `sources.yaml` | Your sources + filters |
| `scrape.yaml` | GitHub Actions schedule |

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