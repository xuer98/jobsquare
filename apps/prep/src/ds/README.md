# Data structures

Implement-from-scratch structures — the ones asked as "build an X with O(1) Y". Distinct
from `../algo/`: here the deliverable is a class with an API contract and invariants, not
a single function.

Each folder: `README.md` (operations + required complexity per operation + invariants),
`solution.py`, `test_solution.py`. Start one with `./new ds lru-cache`.

Canonical set:

- `lru-cache`, `lfu-cache` — hashmap + doubly-linked list; the eviction tie-break
- `trie` — insert/search/startsWith, then wildcard matching
- `union-find` — path compression + union by rank, and when it beats DFS
- `min-stack`, `max-queue` — O(1) auxiliary structure
- `circular-buffer` / `ring-queue`
- `rate-limiter` — token bucket vs sliding window log
- `skiplist` / `ordered-set` — when you can't use a balanced BST
- `bloom-filter` — false positive math, and why there's no delete
- `event-emitter`, `observable` — also lives in FE interviews
- `iterator-flatten` — nested iterator with `hasNext`/`next` laziness

| Structure | Ops that must be O(1) | Last attempt | Confidence |
| --- | --- | --- | --- |
