---

## In-Memory Database with TTL

A record store where each `key` maps to a set of `field -> value` pairs (think wallet metadata: `wallet_a` has `balance`, `status`, ...). Timestamps arrive non-decreasing. `None` for absent/failed lookups.

### Level 1 — Core operations

```
set(timestamp, key, field, value) -> None
    Create/overwrite field on record key.

get(timestamp, key, field) -> value | None
    Return the field's value, or None if key or field doesn't exist.

delete(timestamp, key, field) -> bool
    Remove the field. true if it existed, false otherwise.
```

### Level 2 — Scan / aggregation (reuses L1)

```
scan(timestamp, key) -> string
    All fields of the record, sorted by field name.
    Format: "field1(val1), field2(val2), ...". Empty/missing -> "".

scan_by_prefix(timestamp, key, prefix) -> string
    Same, but only fields whose name starts with prefix.
```

### Level 3 — TTL (extend + refactor, the real difficulty)

```
set_with_ttl(timestamp, key, field, value, ttl) -> None
    Like set, but the field expires ttl units after timestamp.
    A field set at time t is alive during [t, t+ttl): readable at t, gone at t+ttl.
```

The refactor: plain `set` is now `set_with_ttl` with infinite lifespan, and **every** L1/L2 method must filter expired fields — `get` returns `None`, `delete` returns `false`, `scan` skips them. The clean move is one expiry predicate consulted everywhere, not expiry logic duplicated in five places.

### Level 4 — Backup / restore (backward-compatible)

```
backup(timestamp) -> int
    Snapshot current state, storing each live field with its REMAINING ttl
    (not its absolute expiry). Return the number of records with >=1 live field.

restore(timestamp, time_to_restore) -> None
    Restore from the latest backup taken at or before time_to_restore.
    Restored TTLs resume relative to the restore timestamp: a field that had
    95 units left when backed up is alive for [timestamp, timestamp+95).
    Permanent fields stay permanent.
```

Storing **remaining** TTL rather than absolute `expire_at` is the point of L4 — restore shifts the time origin, so a snapshot of absolute timestamps would be wrong after a time jump.

### Verified trace

```
set(1, "wallet_a", "balance", "100")            -> None
set(2, "wallet_a", "status", "active")          -> None
get(3, "wallet_a", "balance")                   -> "100"
get(4, "wallet_a", "missing")                   -> None
scan(5, "wallet_a")                             -> "balance(100), status(active)"
delete(6, "wallet_a", "status")                 -> True
delete(6, "wallet_a", "status")                 -> False   # already gone
scan(7, "wallet_a")                             -> "balance(100)"
set_with_ttl(8, "wallet_a", "session", "xyz", 10) -> None  # alive [8,18)
get(12, "wallet_a", "session")                  -> "xyz"
get(18, "wallet_a", "session")                  -> None     # expired at 18
scan(19, "wallet_a")                            -> "balance(100)"
scan_by_prefix(19, "wallet_a", "bal")           -> "balance(100)"
set_with_ttl(20, "wallet_b", "token", "t1", 100)-> None     # alive [20,120)
set(21, "wallet_b", "tier", "gold")             -> None     # permanent
backup(25)                                      -> 2        # token has 95 left
set(30, "wallet_a", "balance", "999")           -> None     # mutate post-backup
restore(200, 25)                                -> None
get(201, "wallet_a", "balance")                 -> "100"    # rolled back from 999
get(202, "wallet_b", "token")                   -> "t1"     # resumed: [200,295)
get(294, "wallet_b", "token")                   -> "t1"
get(295, "wallet_b", "token")                   -> None     # 95 units elapsed
get(203, "wallet_b", "tier")                    -> "gold"
```
