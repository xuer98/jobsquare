# Frontend

Three different interviews that all get called "the frontend round":

| Folder | Format | Deliverable | Run |
| --- | --- | --- | --- |
| `js/` | 20–30 min, shared editor | one utility function, correct on edge cases | `npm test` |
| `ui/` | 45–60 min, no framework | a working DOM widget, `index.html`, no build | `./run <name>` |
| `react/` | 45–60 min | a component with async state, `App.jsx` | `./run <name>` |

`./run` with no argument lists everything runnable, and shows which layout and language
each folder is using. A React folder needs only `App.tsx` — the mount point and HTML
shell come from `scripts/react-shell/`. Add your own `index.tsx` the moment you need CSS
or providers, and the runner switches to using it.

**TS or JS?** Do the ones you'd get. Most product-facing React interviews now hand you a
TypeScript sandbox, so `fe-react-ts` is the default template; `fe-react` is there for
shops that don't. The typing is scored — a discriminated union for request state reads
very differently from three booleans.

`ui/` and `react/` are the same prompts in different clothing — build the wishlist,
autocomplete, and tic-tac-toe in both. The vanilla version teaches you what React is
doing for you, and half of onsites still ban frameworks.

## `js/` — the standard list

Debounce, throttle, `Promise.all` from scratch, promise pool with concurrency limit,
`curry`, `deepClone` (cycles!), `deepEqual`, `EventEmitter`, `memoize` with a custom key
resolver, `Array.prototype.flat`, `getElementsByClassName`, retry with backoff, `once`,
custom `bind`/`call`/`apply`, virtual DOM `render`, `classNames`.

## `ui/` and `react/` — the standard list

Wishlist / todo, autocomplete with debounce + keyboard nav, tic-tac-toe, star rating,
accordion, tabs, modal with focus trap, infinite scroll, image carousel, poll widget,
data table with sort + pagination, nested comment thread, file explorer tree,
progress bar queue, traffic light, analog clock, memory game.

Accessibility and focus management are scored in every one of them.
