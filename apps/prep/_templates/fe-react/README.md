# <Component Name>

**React. Hooks only, no class components. No UI library.**

> Prompt as read out loud. Interactions, async behavior, error and empty states.

## Clarifying Questions

- Is data fetched or passed as props?
- Controlled or uncontrolled inputs?
- Does it need to be accessible to keyboard/screen-reader users? (Answer: yes.)

## What's being scored

Derived state instead of `useEffect`-to-sync. Correct dependency arrays. Stable
callbacks only where they matter (a memoized child), not sprinkled everywhere. Cleanup
in effects — abort in-flight fetches, clear timers. Keys that aren't array indices.
Race condition on out-of-order responses. Loading / error / empty as real states, not
an afterthought.

## Follow-up probes

- _"Debounce the input."_ → where does the timer live across renders?
- _"The user types fast — response 2 lands before response 1."_ → `AbortController` or
  a request-id guard.
- _"Make this a reusable hook."_ →

## What I missed

---
Single-file component in `App.jsx` — no entry point or HTML needed, the shell supplies
both. Run with `./run <folder-name>` from the repo root.
