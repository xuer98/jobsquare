# System design

Split by which interview it is — they score completely different things.

## `backend/`

Distributed systems. Scale estimation, storage choice, partitioning, replication,
consistency tradeoffs. Deliverable is `README.md` following the six-section template.

url-shortener, rate-limiter, news-feed, chat, notification-service, web-crawler,
typeahead, dropbox, ticketmaster, uber, youtube, payment-ledger, metrics-pipeline,
distributed-job-scheduler.

## `frontend/`

Same 45 minutes, different axis. Nobody asks you to shard a database; they ask about
render performance, caching in the client, bundle size, pagination strategy, offline,
real-time transport, and component API design.

news-feed, autocomplete, photo-sharing, chat-app, collaborative-editor, design-system,
data-table, video-player, email-client, dashboard-with-widgets.

For these the sections shift: requirements → **component tree** → **data model on the
client** → **API + transport** (poll vs SSE vs WebSocket) → **rendering & perf** →
**a11y/i18n/offline**.

## Rule

The write-up is worthless if it's a copy of a blog post. Every doc needs a
**"What I missed"** section from an actual timed run — otherwise you've read about
system design, not practiced it.
