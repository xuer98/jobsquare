# <Service Name>

<One-line framing: what this thing is. "A payments ledger." "A file system.">

Core model: <entities, their fields, the invariants>. Timestamps arrive non-decreasing.

### Level 1 — Core operations

```
op_a(timestamp, ...) -> <type>
    <behavior, including every failure case and what it returns>
```

### Level 2 — Aggregation (reuses L1)

```
op_b(timestamp, n) -> string
    <behavior; exact sort order and tie-break; exact output format>
```

The trap: <what L1 must have already recorded for L2 to be cheap>.

### Level 3 — Extend + refactor (the real difficulty)

```
op_c(...) -> <type>
```

<Why this breaks the L1 design and what has to be restructured.>

### Level 4 — Time travel / history / merge

```
op_d(...) -> <type>
```

## Design notes

- Data structures per entity, and why.
- The one decision at L1 that determines whether L3 is 10 lines or a rewrite.

## What I missed

## Follow-ups

- _"Concurrency?"_ →
- _"Persist it?"_ →
