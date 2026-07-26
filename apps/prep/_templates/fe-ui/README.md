# <Component Name>

**No framework. Vanilla JS + DOM only.**

> Prompt as it would be read out loud. What the user types, what they click, what
> appears, what's rejected and how the rejection is shown, what the empty state is.

## Clarifying Questions

- <the one about data shape>
- <the one about persistence>
- <the one about scale / max size>

## What's being scored

Semantics (`<form>` + `preventDefault` beats a manual keydown handler — say so out loud).
Event delegation. `replaceChildren` over `innerHTML`. `textContent` for anything
user-supplied (XSS). Derived state over stored counters. `aria-live` on errors and
summaries. Focus management after submit.

## Follow-up probes

- _"10,000 rows?"_ → full re-render is O(n) per keystroke; keyed diffing or windowing.
- _"Make it editable inline."_ → commit on Enter/blur, cancel on Escape.
- _"Persist it."_ → `localStorage`, hydrate on boot, try/catch the `JSON.parse`.

## What I missed

---
`./run <folder-name>` from the repo root, or just open `index.html` in a browser — no
build step either way.
