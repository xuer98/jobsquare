# <Utility Name>

> Implement `<signature>`. <What it does in one sentence.>

```js
const f = utility(fn, 100);
```

## Clarifying Questions

- What's the return value — the wrapped result, a promise, `undefined`?
- Does `this` need to be forwarded? Do arguments?
- What happens on the trailing edge / on cancel / on reject?

## What's being scored

Closure over the right state. `this` + arg forwarding via rest params and `.apply`.
Timer cleanup (no leaked handles). A `.cancel()` / `.flush()` escape hatch. Not
swallowing rejections. Correct behavior when called re-entrantly.

## Edge cases they'll ask about

- Called before the first tick resolves.
- Called with 0 delay / 0 concurrency / empty input.
- The wrapped fn throws synchronously.

## What I missed
