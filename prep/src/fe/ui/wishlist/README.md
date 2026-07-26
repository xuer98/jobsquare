# Wishlist

**No framework. Vanilla JS + DOM only.**

> Build a wishlist for virtual items. A user types an item name and a price, presses Enter or clicks Add, and the item appears in a list. Each row has a remove button. Show the item count and the total price. Duplicate names (case-insensitive) are rejected with a message. Empty or non-numeric price is rejected. Show an empty state when there's nothing in the list.

## Clarifying Questions

- Is price an integer or decimal?
- Should duplicates be rejected, or merge into a quantity?
- Does the list persist?
- Is there a max list size?

## What's being scored

`<form>` + `preventDefault` gives you Enter-to-submit for free instead of a manual keydown handler — call that out. Event delegation. `replaceChildren` over `innerHTML`. `textContent` (XSS). Derived count/total instead of stored counters. `aria-live` on the error and summary. Focus returned to the input after submit.

## Follow-up probes

- _"10,000 items?"_ → the full re-render is O(n) per keystroke; move to keyed diffing or windowing (`IntersectionObserver` / fixed-height virtual list).
- _"Make it editable inline."_ → double-click swaps the span for an input; commit on Enter/blur, cancel on Escape.
- _"Persist it."_ → `localStorage` write on state change, hydrate on boot, wrap `JSON.parse` in try/catch and fall back to empty.

---
