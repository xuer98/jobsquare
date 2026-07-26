# Content Store

**Language:** Python 3.11
**Theme:** Airbnb Content Platform — the repository that stores marketing content (hero copy, banners, host guides) served to guests and hosts.

---

## How to take this exam

1. Set a **90 minute timer**. Do not stop it between levels.
2. `cp starter.py attempt.py` and work only in `attempt.py`. **`starter.py` contains the Level 1 methods only.** Every later level lists its own method signatures in this document; when you reach a level, copy its signatures into your class and implement them there. That is how the real CodeSignal editor behaves — the next level's methods appear only once you have submitted the current one.
3. **Reveal one level at a time.** Read Level 1, implement it, run its tests, and only then scroll to Level 2. Peeking ahead defeats the entire point of the format — the exam is testing whether your Level 1 data model survives Level 3.
4. Run tests per level:
   ```bash
   ICF_IMPL=levels python3 -m pytest -q -m level1
   ICF_IMPL=levels python3 -m pytest -q -m level2
   ICF_IMPL=levels python3 -m pytest -q -m level3
   ICF_IMPL=levels python3 -m pytest -q -m level4
   ```
5. **Backward compatibility is graded.** After Level 4, `-m level1` and `-m level2` must still pass. At the end, run the whole suite:
   ```bash
   ICF_IMPL=levels python3 -m pytest -q
   ```
6. Suggested budget: L1 10 min · L2 20 min · L3 30 min · L4 30 min. If you are over budget on a level, move on — partial credit across four levels beats a perfect Level 2.

### Global conventions (true for every level)

- `content_id` is a non-empty string; ids are unique within the store.
- `body` is an arbitrary string (the empty string is legal).
- `size` is a non-negative integer (0 is legal). It is metadata you store and rank by; it has nothing to do with `len(body)`.
- All timestamps and TTLs are integers.
- **Missing / not-visible content never raises.** Readers return `None` or `[]`; mutators return `False`.
- Ordering of returned lists is always fully specified — never rely on insertion order.

---

# Level 1 — Basic CRUD

**~10 minutes · 100 points**

Implement a store that holds content records keyed by `content_id`.

### Methods

```python
add_content(content_id: str, body: str, size: int) -> bool
get_content(content_id: str) -> Optional[str]
update_content(content_id: str, body: str, size: int) -> bool
delete_content(content_id: str) -> bool
```

### Contracts

| Method           | Returns                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_content`    | `True` if the content was stored. `False` if `content_id` already exists — and in that case **nothing is modified** (no overwrite of body or size).           |
| `get_content`    | The stored `body` string, or `None` if `content_id` does not exist (or was deleted).                                                                          |
| `update_content` | `True` if the content existed and its `body` **and** `size` were both replaced. `False` if `content_id` does not exist — and in that case nothing is created. |
| `delete_content` | `True` if the content existed and was removed. `False` if `content_id` does not exist.                                                                        |

### Edge cases

- `get` / `delete` / `update` on an empty store: `None` / `False` / `False`.
- `delete` is **not** idempotent in its return value: deleting the same id twice gives `True` then `False`.
- After a delete, `add_content` with the same id succeeds again (`True`).
- `body = ""` and `size = 0` are valid values, not "missing". `get_content` returning `""` is a hit; returning `None` is a miss. Do not conflate them.

### Worked example

```python
s = ContentStore()

s.add_content("home-hero", "Belong anywhere", 4200)        # -> True
s.add_content("home-hero", "Duplicate", 10)                # -> False  (no overwrite)
s.get_content("home-hero")                                 # -> 'Belong anywhere'
s.get_content("home-nope")                                 # -> None

s.update_content("home-hero", "Belong anywhere v2", 4500)  # -> True
s.get_content("home-hero")                                 # -> 'Belong anywhere v2'
s.update_content("ghost", "x", 1)                          # -> False

s.delete_content("home-hero")                              # -> True
s.get_content("home-hero")                                 # -> None
s.delete_content("home-hero")                              # -> False
```

---

# Level 2 — Prefix search and top-N ranking

**~20 minutes · 150 points**

Content ids are namespaced by product surface (`home-hero`, `home-banner`, `host-guide`). Add querying.

### Methods

```python
find_by_prefix(prefix: str) -> list[str]
top_n_by_size(prefix: str, n: int) -> list[str]
```

### Output format

Both methods return **formatted strings**, not objects and not raw ids:

```
"<content_id>(<size>)"      e.g.  "home-hero(4200)"
```

No spaces. `size` is rendered as a plain integer.

### Contracts

**`find_by_prefix(prefix)`** — every existing content whose `content_id` starts with `prefix`, formatted as above, sorted by **`content_id` ascending** (plain Python string ordering).

- `prefix = ""` matches **everything**.
- A `prefix` equal to a full id matches that id (a string is a prefix of itself).
- No matches, or an empty store → `[]`.
- Deleted content is not a match. Sizes reflect the most recent `update_content`.

**`top_n_by_size(prefix, n)`** — the `n` largest content whose id starts with `prefix`, sorted by:

1. **`size` descending** (largest first), then
2. **`content_id` ascending** as the tie-break.

- If fewer than `n` items match, return all of them (never pad).
- `n <= 0` → `[]`.
- No matches → `[]`.
- Same `prefix` semantics as `find_by_prefix`.

### Worked example

```python
s = ContentStore()
s.add_content("home-hero",   "Belong anywhere", 4200)
s.add_content("home-banner", "Summer sale",     4200)
s.add_content("home-footer", "Legal",            800)
s.add_content("host-guide",  "Hosting 101",     9000)

s.find_by_prefix("home-")
# -> ['home-banner(4200)', 'home-footer(800)', 'home-hero(4200)']     # id ascending

s.find_by_prefix("")
# -> ['home-banner(4200)', 'home-footer(800)', 'home-hero(4200)', 'host-guide(9000)']

s.find_by_prefix("zz")            # -> []

s.top_n_by_size("home-", 2)
# -> ['home-banner(4200)', 'home-hero(4200)']   # tie on 4200 -> 'banner' < 'hero'

s.top_n_by_size("", 3)
# -> ['host-guide(9000)', 'home-banner(4200)', 'home-hero(4200)']

s.top_n_by_size("host-", 50)      # -> ['host-guide(9000)']   # n > match count
s.top_n_by_size("home-", 0)       # -> []

s.delete_content("home-banner")
s.find_by_prefix("home-")         # -> ['home-footer(800)', 'home-hero(4200)']
```

---

# Level 3 — Explicit time and TTL

**~30 minutes · 150 points**

Marketing content is scheduled: a promo banner is live for a campaign window and then must vanish. Every operation now happens at an explicit integer `timestamp`, and content can carry a **TTL** (a lifetime in ticks).

### Methods

```python
add_content_at(timestamp: int, content_id: str, body: str, size: int,
               ttl: Optional[int] = None) -> bool
get_content_at(timestamp: int, content_id: str) -> Optional[str]
update_content_at(timestamp: int, content_id: str, body: str, size: int,
                  ttl: Optional[int] = None) -> bool
delete_content_at(timestamp: int, content_id: str) -> bool
find_by_prefix_at(timestamp: int, prefix: str) -> list[str]
top_n_by_size_at(timestamp: int, prefix: str, n: int) -> list[str]
current_time() -> int
```

> Note the argument order: `timestamp` comes **first** on every `*_at` method.

### The liveness rule — memorise this exactly

Content written at time `t` with TTL `d` is **live** for a query at time `q` when:

```
t <= q < t + d
```

That is: **inclusive at the start, exclusive at the end.** It is alive at `t` itself, alive at `t + d - 1`, and **dead at exactly `t + d`**.

- `ttl = None` means **never expires**.
- `ttl <= 0` means the content is dead the instant it is written. `add_content_at` still returns `True` (the write happened), but the content is immediately invisible to every reader.
- Content is invisible to any query at `q < t` — it does not exist yet.

### Contracts

**`add_content_at`** — `True` if written. `False` if content with that id is **live at `timestamp`** (then nothing changes). If the id previously existed but is now **deleted or expired**, the add **succeeds** and resurrects the id with fresh body, size and TTL.

**`get_content_at`** — the `body` if the id is live at `timestamp`, else `None`.

**`update_content_at`** — `False` if the id is not live at `timestamp` (an expired item **cannot** be updated back to life). Otherwise replaces `body` and `size`, and **renews the TTL from `timestamp`**:

- if `ttl` is `None` (the default), the item keeps its **current TTL duration**, restarting from `timestamp` → new expiry is `timestamp + current_duration`;
- if `ttl` is given, it **replaces** the duration → new expiry is `timestamp + ttl`;
- if the item's duration is `None` (never expires), it stays never-expiring.

This is the level's trap: an update at `t + d - 1` **rescues** content that was one tick from death.

**`delete_content_at`** — `True` if the id was live at `timestamp` and is now deleted; `False` otherwise. Deleting already-expired content returns `False`.

**`find_by_prefix_at` / `top_n_by_size_at`** — identical to their Level 2 counterparts, except only content **live at `timestamp`** is considered. All ordering, formatting and `n` rules are unchanged.

**`current_time()`** — the store's logical clock: the **largest `timestamp` ever passed to any `*_at` method**, reads included. Starts at `0` and never decreases.

### Backward compatibility

The Level 1 and Level 2 methods must keep working. They are defined as **exactly equivalent** to their timestamped counterparts called at `timestamp = 0` with `ttl = None`:

| Legacy call                       | Equivalent to                                     |
| --------------------------------- | ------------------------------------------------- |
| `add_content(cid, body, size)`    | `add_content_at(0, cid, body, size, ttl=None)`    |
| `get_content(cid)`                | `get_content_at(0, cid)`                          |
| `update_content(cid, body, size)` | `update_content_at(0, cid, body, size, ttl=None)` |
| `delete_content(cid)`             | `delete_content_at(0, cid)`                       |
| `find_by_prefix(prefix)`          | `find_by_prefix_at(0, prefix)`                    |
| `top_n_by_size(prefix, n)`        | `top_n_by_size_at(0, prefix, n)`                  |

Consequence: a workload that only ever uses the legacy API behaves exactly as in Levels 1–2 (everything at time 0, nothing ever expires). Delegate — do not maintain two code paths.

### Simplifying assumption for this level

In Level 3, calls arrive with **non-decreasing timestamps**. You will not be asked to read the past here.

Level 4 relaxes this **for reads only**. For the whole exam, _mutating_ calls (`add_content_at`, `update_content_at`, `delete_content_at`, `rollback`, and the legacy Level 1 mutators) always arrive with non-decreasing timestamps — you will never be asked to insert into the middle of the history. What Level 4 adds is the ability for a _historical read_ to target any past instant. That is the whole point: your Level 3 storage has to have kept enough of the past to answer it.

### Worked examples

```python
# --- boundaries ---
s = ContentStore()
s.add_content_at(10, "a", "A", 100, ttl=5)   # live for q in [10, 15)
s.get_content_at(10, "a")   # -> 'A'      (inclusive start)
s.get_content_at(14, "a")   # -> 'A'      (t + ttl - 1)
s.get_content_at(15, "a")   # -> None     (exclusive end: dead at exactly t + ttl)
s.get_content_at( 9, "a")   # -> None     (does not exist yet)
```

```python
# --- TTL renewal and expiry sweeping through queries ---
s = ContentStore()
s.add_content_at(10, "home-hero",   "v1",    4200, 50)   # -> True   expires at 60
s.add_content_at(20, "home-banner", "promo",  900,  5)   # -> True   expires at 25

s.get_content_at(24, "home-banner")     # -> 'promo'
s.get_content_at(25, "home-banner")     # -> None
s.find_by_prefix_at(24, "home-")        # -> ['home-banner(900)', 'home-hero(4200)']
s.find_by_prefix_at(25, "home-")        # -> ['home-hero(4200)']

s.update_content_at(59, "home-hero", "v2", 4300)   # -> True, rescued one tick early;
                                                   #    TTL 50 restarts -> expires at 109
s.get_content_at(60,  "home-hero")      # -> 'v2'
s.get_content_at(108, "home-hero")      # -> 'v2'
s.get_content_at(109, "home-hero")      # -> None

s.add_content_at(109, "home-hero", "v3", 100, None)  # -> True (expired id is re-addable)
s.top_n_by_size_at(109, "", 5)          # -> ['home-hero(100)']
s.current_time()                        # -> 109
```

---

# Level 4 — History, point-in-time reads, and rollback

**~30 minutes · 200 points**

The content team ships a bad campaign and needs to reconstruct what a page looked like last Tuesday, then undo everything since.

### Methods

```python
get_content_at_time(content_id: str, timestamp: int) -> Optional[str]
rollback(timestamp: int) -> int
```

> Note the argument order is **`(content_id, timestamp)`** here — reversed relative to the `*_at` methods. This is deliberate; read signatures carefully under time pressure.

### `get_content_at_time(content_id, timestamp)`

A **historical** read: the `body` that `content_id` had at `timestamp`, considering only operations whose own timestamp is `<= timestamp`, and applying the same liveness rule as Level 3.

- Returns `None` if the id had not been created yet at `timestamp`, was deleted at or before `timestamp`, or had already expired at `timestamp`.
- Returns `None` for ids that never existed.
- Later operations are invisible to it: if the body was `"v1"` at `t=15` and was updated to `"v2"` at `t=20`, then `get_content_at_time(id, 15) == "v1"` **even after** the update has been applied.
- **This method does not advance the logical clock.** `current_time()` is unaffected by it.

### `rollback(timestamp)`

Restores the entire store to the state it had at `timestamp`. Define `now = current_time()` at the moment `rollback` is called, and `delta = now - timestamp`.

1. **Every operation with an operation-timestamp `> timestamp` is discarded**, along with its history. Content created after `timestamp` ceases to exist entirely (`get_content_at_time` on it returns `None` for every query time). Updates and deletes after `timestamp` are undone.
2. **Survivors** are exactly the ids that were live at `timestamp` (per the Level 3 liveness rule). Each survivor is restored with the `body`, `size` and TTL duration it had at `timestamp`.
3. **TTLs are shifted forward by `delta`.** A survivor whose expiry was `E` now expires at `E + delta`. Equivalently: **whatever remaining lifetime an item had at `timestamp`, it has that same remaining lifetime again at `now`.** Content with `ttl = None` is unaffected — it still never expires.
4. **The clock does not move backwards.** `current_time()` is still `now` after the rollback, and subsequent operations are expected to use timestamps `>= now`.
5. If `timestamp >= now`, the rollback is a **no-op** (`delta = 0`, nothing is discarded).

**Returns:** the number of surviving content items (`int`) — precisely, **the number of content items live at `current_time()` after the rollback completes** (that is, live at `now`, not live at `timestamp`). `0` if the store is now empty. The two readings differ: an item that had already expired by `now` but is live at `timestamp` is a survivor and is counted, because its expiry is shifted forward past `now`; conversely, in the no-op case (`timestamp >= now`) an item live at `now` but expired by `timestamp` is still counted.

### Historical reads after a rollback

A rollback re-asserts each survivor **at `now`** with a shifted expiry, and erases the operations in `(timestamp, now]`. A consequence worth stating explicitly: a historical read aimed _inside_ that window can report an item as absent even though the same item is live at `now`. The window is a genuine gap in the rewritten history, not a bug.

```python
s = ContentStore()
s.add_content_at(20, "b", "B1", 200, 5)   # expires at 25
s.get_content_at(40, "b")        # -> None (expired) — pushes the clock to 40
s.rollback(20)                   # -> 1   now = 40, delta = 20; b restored at 40, expires 45

s.get_content_at_time("b", 30)   # -> None  ('b' had expired at 25 in the surviving history)
s.get_content_at(44, "b")        # -> 'B1'  (restored at now = 40 with 5 ticks left)
```

### Edge cases

- `rollback` on an empty store → `0`.
- `rollback(0)` before anything existed → `0`, and the store is completely empty afterwards, including its history.
- Rolling back twice in a row is legal; the second rollback operates on the already-rewritten history with the same (unmoved) `now`.
- After a rollback, all normal mutations continue to work. An item restored with a shifted expiry can be updated (renewing from the update's timestamp) or deleted as usual.
- Backward compatibility still applies: the Level 1 and Level 2 methods must behave exactly as specified in those levels.

### Worked examples

```python
# --- point-in-time reads ---
s = ContentStore()
s.add_content_at(10, "c", "v1", 100)
s.update_content_at(20, "c", "v2", 200)

s.get_content_at_time("c", 15)   # -> 'v1'   (the update at t=20 is invisible)
s.get_content_at_time("c", 20)   # -> 'v2'   (operations at exactly q are applied)
s.get_content_at_time("c", 25)   # -> 'v2'
s.get_content_at_time("c",  9)   # -> None   (did not exist yet)
```

```python
# --- rollback with TTL shifting ---
s = ContentStore()
s.add_content_at(10, "a", "A1", 100, 50)   # expires at 60
s.add_content_at(20, "b", "B1", 200,  5)   # expires at 25
s.update_content_at(30, "a", "A2", 700)    # renews: expires at 80

s.get_content_at_time("a", 15)   # -> 'A1'
s.get_content_at_time("a", 30)   # -> 'A2'
s.get_content_at_time("b", 24)   # -> 'B1'
s.get_content_at_time("b", 25)   # -> None   (expired, exclusive end)

s.get_content_at(40, "a")        # -> 'A2'   (this read pushes the clock to 40)
s.current_time()                 # -> 40

s.rollback(20)                   # -> 2      now = 40, delta = 20
# State at t=20 was: a = 'A1' size 100 expiring at 60; b = 'B1' size 200 expiring at 25.
# The update at t=30 is discarded. Both survive, expiries shift by +20.

s.get_content_at_time("a", 40)   # -> 'A1'   (the t=30 update is gone from history)
s.get_content_at(44, "b")        # -> 'B1'   b had 5 ticks left at t=20 -> dies at 45
s.get_content_at(45, "b")        # -> None
s.get_content_at(79, "a")        # -> 'A1'   a had 40 ticks left at t=20 -> dies at 80
s.get_content_at(80, "a")        # -> None
s.find_by_prefix_at(50, "")      # -> ['a(100)']   b already gone, a back to size 100
```

```python
# --- rollback discards newer content entirely ---
s = ContentStore()
s.add_content_at(10, "x", "X", 1)
s.add_content_at(20, "y", "Y", 2)

s.rollback(15)                   # -> 1   (now = 20, delta = 5; 'y' never happened)
s.get_content_at(30, "x")        # -> 'X'
s.get_content_at(30, "y")        # -> None
s.get_content_at_time("y", 20)   # -> None   (its history was erased too)
s.find_by_prefix_at(30, "")      # -> ['x(1)']
```

---

## Scoring

| Level                     | Points  | Suggested time |
| ------------------------- | ------- | -------------- |
| 1 — CRUD                  | 100     | 10 min         |
| 2 — Prefix search & top-N | 150     | 20 min         |
| 3 — Time & TTL            | 150     | 30 min         |
| 4 — History & rollback    | 200     | 30 min         |
| **Total**                 | **600** | **90 min**     |

Levels 1 and 2 must still pass after Level 4 is implemented. A Level 4 that breaks Level 1 scores 200, not 600.

## After the exam

Read the module docstring at the top of `solution.py` before reading the code. If you had to significantly rewrite your storage between Level 2 and Level 3, or between Level 3 and Level 4, that is the lesson — and it is the single most common reason strong engineers run out of time on this format.

