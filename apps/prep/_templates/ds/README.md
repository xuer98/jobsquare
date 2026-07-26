# <Problem Name>

> Implement `<ClassName>` supporting the operations below.

## API

```
op_a(key) -> value        must be O(1)
op_b(key, value) -> None  must be O(1) amortized
```

## Invariants

The properties that must hold after *every* operation. Write these down before coding —
they're what your implementation is actually maintaining, and stating them out loud is
most of the interview.

- <e.g. the list is ordered most-recently-used first>
- <e.g. size never exceeds capacity>

## Approach

Which structures, and which one each operation touches. The usual shape: a hashmap for
lookup plus something else for ordering, kept in sync on every mutation.

The part people get wrong: <the tie-break, the eviction order, the stale-entry cleanup>.

## What I missed

## Follow-ups

- _"Make it thread-safe."_ →
- _"What if values are expensive to recompute?"_ →
- _"Now support TTL per key."_ →
