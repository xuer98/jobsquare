"""Reference solution for ICF Mock 1: ContentStore.

KEY DESIGN DECISION -- why levels 3 and 4 are nearly free here
--------------------------------------------------------------
The whole exam hinges on one choice made at Level 1: *never store a bare
string where a record will eventually be needed*, and *never store current
state where a history will eventually be needed*. So the single source of
truth is an append-only event log per content id -- a list of immutable
`_Event` records (timestamp, seq, kind, body, size, ttl, expires_at) -- and
"current state" is not stored at all, it is *derived* by a single primitive:

    _record_at(content_id, q) -> the last event with event.timestamp <= q,
                                 or None if that event is a DELETE or has
                                 already expired at q.

Every public method in all four levels is a thin shell over that primitive:

  * L1 `get_content`         -> _record_at(id, 0)
  * L3 `get_content_at`      -> _record_at(id, timestamp)
  * L4 `get_content_at_time` -> _record_at(id, timestamp)     <- identical!
  * L2/L3 prefix + top-N     -> _record_at over the id keyspace, then sort
  * L1 methods               -> the L3 methods with timestamp=0, ttl=None

That is the payoff. Level 3 (time + TTL) costs one extra field on the record
and one comparison inside `_record_at`. Level 4 (point-in-time reads) costs
*zero* new machinery, because a log-plus-derived-state model can already
answer "what did this look like at time q" for any q -- the naive
"dict[str, str] of current bodies" model has thrown that information away and
must be rewritten from scratch. Rollback is then just log truncation plus
re-asserting the survivors at the current clock with shifted expiries, which
is expressible *inside the same log* rather than as a side table.

The one thing deliberately left un-optimised: prefix search scans the id
keyspace. At interview scale that is correct and honest; a trie is the move
only if the problem states a large keyspace with hot prefix reads.
"""

from __future__ import annotations

import bisect
import math
from dataclasses import dataclass
from typing import Iterable, Iterator, Optional

# Event kinds. RESTORE is written by rollback() and behaves exactly like an
# ADD when read back -- keeping it distinct is purely for debuggability.
_ADD = "add"
_UPDATE = "update"
_DELETE = "delete"
_RESTORE = "restore"


@dataclass(frozen=True)
class _Event:
    """One immutable mutation of one content id, ordered by (timestamp, seq)."""

    timestamp: int
    seq: int
    kind: str
    body: Optional[str] = None
    size: Optional[int] = None
    ttl: Optional[int] = None
    expires_at: Optional[int] = None

    def alive_at(self, when: int) -> bool:
        """True if this event leaves the content readable at time `when`."""
        if self.kind == _DELETE:
            return False
        return self.expires_at is None or when < self.expires_at


class ContentStore:
    """A CMS-style content repository with TTLs, history and rollback."""

    #: Timestamp used by the untimestamped Level 1/2 API.
    DEFAULT_TIMESTAMP = 0

    def __init__(self) -> None:
        # content_id -> event log, kept sorted by (timestamp, seq).
        self._log: dict[str, list[_Event]] = {}
        # Globally monotonic tiebreaker so same-timestamp events keep call order.
        self._seq: int = 0
        # Logical clock: the largest timestamp handed to any *_at method.
        self._clock: int = 0

    # ------------------------------------------------------------------
    # Internal primitives
    # ------------------------------------------------------------------

    def _next_seq(self) -> int:
        self._seq += 1
        return self._seq

    def _advance(self, timestamp: int) -> None:
        """Move the logical clock forward; it never goes backwards."""
        if timestamp > self._clock:
            self._clock = timestamp

    def _append(self, content_id: str, event: _Event) -> None:
        """Insert an event into the id's log, preserving (timestamp, seq) order."""
        log = self._log.setdefault(content_id, [])
        bisect.insort(log, event, key=lambda e: (e.timestamp, e.seq))

    def _last_event_at(self, content_id: str, when: int) -> Optional[_Event]:
        """The most recent event for `content_id` with timestamp <= `when`."""
        log = self._log.get(content_id)
        if not log:
            return None
        idx = bisect.bisect_right(
            log, (when, math.inf), key=lambda e: (e.timestamp, e.seq)
        )
        return log[idx - 1] if idx else None

    def _record_at(self, content_id: str, when: int) -> Optional[_Event]:
        """The live record for `content_id` as of `when`, or None if not readable."""
        event = self._last_event_at(content_id, when)
        if event is None or not event.alive_at(when):
            return None
        return event

    def _live_records(self, prefix: str, when: int) -> Iterator[tuple[str, _Event]]:
        """Every (id, record) live at `when` whose id starts with `prefix`."""
        for content_id in self._log:
            if not content_id.startswith(prefix):
                continue
            record = self._record_at(content_id, when)
            if record is not None:
                yield content_id, record

    @staticmethod
    def _format(content_id: str, record: _Event) -> str:
        """Render a record as the wire format `id(size)`."""
        return f"{content_id}({record.size})"

    @staticmethod
    def _expiry(timestamp: int, ttl: Optional[int]) -> Optional[int]:
        """Absolute expiry for something written at `timestamp` with `ttl`."""
        return None if ttl is None else timestamp + ttl

    # ------------------------------------------------------------------
    # Level 1 -- basic CRUD (delegates to the Level 3 API)
    # ------------------------------------------------------------------

    def add_content(self, content_id: str, body: str, size: int) -> bool:
        """Add never-expiring content at the default timestamp."""
        return self.add_content_at(
            self.DEFAULT_TIMESTAMP, content_id, body, size, ttl=None
        )

    def get_content(self, content_id: str) -> Optional[str]:
        """Read the body of `content_id` at the default timestamp, else None."""
        return self.get_content_at(self.DEFAULT_TIMESTAMP, content_id)

    def update_content(self, content_id: str, body: str, size: int) -> bool:
        """Overwrite body and size of existing content at the default timestamp."""
        return self.update_content_at(
            self.DEFAULT_TIMESTAMP, content_id, body, size, ttl=None
        )

    def delete_content(self, content_id: str) -> bool:
        """Delete `content_id` at the default timestamp; False if it was absent."""
        return self.delete_content_at(self.DEFAULT_TIMESTAMP, content_id)

    # ------------------------------------------------------------------
    # Level 2 -- prefix search and top-N (delegates to the Level 3 API)
    # ------------------------------------------------------------------

    def find_by_prefix(self, prefix: str) -> list[str]:
        """All live content whose id starts with `prefix`, id-ascending."""
        return self.find_by_prefix_at(self.DEFAULT_TIMESTAMP, prefix)

    def top_n_by_size(self, prefix: str, n: int) -> list[str]:
        """The `n` largest-by-size matches for `prefix`, ties broken by id."""
        return self.top_n_by_size_at(self.DEFAULT_TIMESTAMP, prefix, n)

    # ------------------------------------------------------------------
    # Level 3 -- explicit time and TTL
    # ------------------------------------------------------------------

    def add_content_at(
            self,
            timestamp: int,
            content_id: str,
            body: str,
            size: int,
            ttl: Optional[int] = None,
    ) -> bool:
        """Add content at `timestamp`; False if an id is already live there."""
        self._advance(timestamp)
        if self._record_at(content_id, timestamp) is not None:
            return False
        self._append(
            content_id,
            _Event(
                timestamp=timestamp,
                seq=self._next_seq(),
                kind=_ADD,
                body=body,
                size=size,
                ttl=ttl,
                expires_at=self._expiry(timestamp, ttl),
            ),
        )
        return True

    def get_content_at(self, timestamp: int, content_id: str) -> Optional[str]:
        """Body of `content_id` as of `timestamp`, or None if not live then."""
        self._advance(timestamp)
        record = self._record_at(content_id, timestamp)
        return None if record is None else record.body

    def update_content_at(
            self,
            timestamp: int,
            content_id: str,
            body: str,
            size: int,
            ttl: Optional[int] = None,
    ) -> bool:
        """Overwrite live content and renew its TTL from `timestamp`."""
        self._advance(timestamp)
        current = self._record_at(content_id, timestamp)
        if current is None:
            return False
        renewed_ttl = current.ttl if ttl is None else ttl
        self._append(
            content_id,
            _Event(
                timestamp=timestamp,
                seq=self._next_seq(),
                kind=_UPDATE,
                body=body,
                size=size,
                ttl=renewed_ttl,
                expires_at=self._expiry(timestamp, renewed_ttl),
            ),
        )
        return True

    def delete_content_at(self, timestamp: int, content_id: str) -> bool:
        """Delete content live at `timestamp`; False if it was not live."""
        self._advance(timestamp)
        if self._record_at(content_id, timestamp) is None:
            return False
        self._append(
            content_id,
            _Event(timestamp=timestamp, seq=self._next_seq(), kind=_DELETE),
        )
        return True

    def find_by_prefix_at(self, timestamp: int, prefix: str) -> list[str]:
        """`id(size)` for every live match at `timestamp`, id-ascending."""
        self._advance(timestamp)
        matches = self._live_records(prefix, timestamp)
        return [self._format(cid, rec) for cid, rec in sorted(matches)]

    def top_n_by_size_at(self, timestamp: int, prefix: str, n: int) -> list[str]:
        """The `n` largest live matches at `timestamp`, size desc then id asc."""
        self._advance(timestamp)
        if n <= 0:
            return []
        ranked = sorted(
            self._live_records(prefix, timestamp),
            key=lambda item: (-item[1].size, item[0]),
        )
        return [self._format(cid, rec) for cid, rec in ranked[:n]]

    # ------------------------------------------------------------------
    # Level 4 -- history and rollback
    # ------------------------------------------------------------------

    def current_time(self) -> int:
        """The logical clock: largest timestamp passed to any *_at method."""
        return self._clock

    def get_content_at_time(self, content_id: str, timestamp: int) -> Optional[str]:
        """Historical read: the body as of `timestamp`; does not advance the clock."""
        record = self._record_at(content_id, timestamp)
        return None if record is None else record.body

    def rollback(self, timestamp: int) -> int:
        """Restore the store to its state at `timestamp`, shifting surviving TTLs."""
        now = self._clock
        if timestamp >= now:
            # Nothing happened after `timestamp`; nothing to undo or shift.
            return len(list(self._live_records("", now)))

        delta = now - timestamp
        survivors = [
            (content_id, record)
            for content_id, record in sorted(self._live_records("", timestamp))
        ]
        self._truncate_after(timestamp)
        for content_id, record in survivors:
            self._append(
                content_id,
                _Event(
                    timestamp=now,
                    seq=self._next_seq(),
                    kind=_RESTORE,
                    body=record.body,
                    size=record.size,
                    ttl=record.ttl,
                    expires_at=(
                        None if record.expires_at is None else record.expires_at + delta
                    ),
                ),
            )
        return len(survivors)

    def _truncate_after(self, timestamp: int) -> None:
        """Erase every event strictly newer than `timestamp`."""
        for content_id in list(self._log):
            kept = self._keep_through(self._log[content_id], timestamp)
            if kept:
                self._log[content_id] = kept
            else:
                del self._log[content_id]

    @staticmethod
    def _keep_through(log: Iterable[_Event], timestamp: int) -> list[_Event]:
        return [event for event in log if event.timestamp <= timestamp]
