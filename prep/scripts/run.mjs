#!/usr/bin/env node
// Dev server for the frontend problems.
//
//   ./run wishlist          fuzzy match against src/fe/ui, src/fe/react, src/fe/js
//   ./run react/memory-game
//   ./run _templates/fe-react-ts
//   ./run --list
//
// Three folder layouts are supported, checked in this order:
//
//   html   index.html at the folder root         served as-is (vanilla DOM problems)
//   entry  own index.tsx/index.jsx/main.tsx      served with that entry; the HTML comes
//                                               from ./index.html, ./public/index.html,
//                                               or a built-in fallback, and the <script>
//                                               tag is injected if it isn't already there
//   shell  only App.tsx / App.jsx                mounted via scripts/react-shell
//
// The "shell" layout keeps a problem folder down to a single file. The "entry" layout is
// the CRA shape, and is what you want as soon as a problem needs its own CSS or providers.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEARCH_DIRS = ["src/fe/ui", "src/fe/react", "src/fe/js"];

// TS before JS everywhere: if a folder has both, the typed one is the one you meant.
const OWN_ENTRIES = ["index.tsx", "index.jsx", "main.tsx", "main.jsx"];
const APP_ENTRIES = ["App.tsx", "App.jsx"];

const FALLBACK_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const pick = (dir, names) => names.find((f) => existsSync(join(dir, f)));

function layoutOf(dir) {
  if (existsSync(join(dir, "index.html"))) return { mode: "html" };
  const own = pick(dir, OWN_ENTRIES);
  if (own) return { mode: "entry", entry: own };
  const app = pick(dir, APP_ENTRIES);
  if (app) return { mode: "shell", entry: app };
  return { mode: null };
}

function describe({ mode, entry }) {
  if (!mode) return "—";
  if (mode === "html") return "html";
  return `${mode}  ${/\.tsx?$/.test(entry) ? "ts" : "js"}  ${entry}`;
}

function problems() {
  return SEARCH_DIRS.flatMap((dir) => {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, rel: join(dir, e.name), dir: join(abs, e.name) }));
  });
}

function list() {
  const all = problems();
  if (!all.length) {
    console.log("No problems yet. Start one:\n");
    console.log("  cp -r _templates/fe-ui       src/fe/ui/autocomplete");
    console.log("  cp -r _templates/fe-react-ts src/fe/react/autocomplete\n");
    return;
  }
  console.log("Runnable problems:\n");
  for (const p of all) {
    console.log(`  ${p.rel.padEnd(32)} ${describe(layoutOf(p.dir))}`);
  }
  console.log();
}

function resolveTarget(query) {
  const direct = resolve(ROOT, query);
  if (existsSync(direct) && layoutOf(direct).mode) {
    return { name: basename(direct), rel: relative(ROOT, direct), dir: direct };
  }

  const all = problems();
  const q = query.toLowerCase();
  const exact = all.filter((p) => p.name.toLowerCase() === q);
  const partial = all.filter((p) => p.rel.toLowerCase().includes(q));
  const hits = exact.length ? exact : partial;

  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    console.error(`No problem matching "${query}".\n`);
    list();
    process.exit(1);
  }
  console.error(`"${query}" is ambiguous:\n`);
  for (const p of hits) console.error(`  ${p.rel}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const noOpen = argv.includes("--no-open");
const arg = argv.find((a) => !a.startsWith("-"));

if (!arg || argv.includes("--list") || argv.includes("-l")) {
  list();
  process.exit(0);
}

const target = resolveTarget(arg);
const layout = layoutOf(target.dir);

if (!layout.mode) {
  console.error(
    `${target.rel} has none of index.html, index.tsx, App.tsx — nothing to serve.`,
  );
  process.exit(1);
}

const title = {
  name: "prep-title",
  transformIndexHtml: (html) =>
    /<title>/.test(html)
      ? html.replace(/<title>.*?<\/title>/, `<title>${target.name}</title>`)
      : html.replace("</head>", `  <title>${target.name}</title>\n  </head>`),
};

// For the "entry" layout the HTML is CRA-shaped: it has the #root div but no <script>,
// because create-react-app injected that at build time. Serve it ourselves and inject.
const entryHtml = {
  name: "prep-entry-html",
  configureServer(server) {
    const source = pick(target.dir, ["index.html", "public/index.html"]);
    server.middlewares.use(async (req, res, next) => {
      const url = (req.url ?? "").split("?")[0];
      if (url !== "/" && url !== "/index.html") return next();
      try {
        let html = source ? readFileSync(join(target.dir, source), "utf8") : FALLBACK_HTML;
        if (!html.includes(layout.entry)) {
          html = html.replace(
            "</body>",
            `  <script type="module" src="/${layout.entry}"></script>\n  </body>`,
          );
        }
        html = await server.transformIndexHtml(url, html, req.originalUrl);
        res.setHeader("Content-Type", "text/html");
        res.end(html);
      } catch (err) {
        next(err);
      }
    });
  },
};

const isShell = layout.mode === "shell";

const server = await createServer({
  configFile: false,
  root: isShell ? join(ROOT, "scripts/react-shell") : target.dir,
  plugins: [react(), title, ...(layout.mode === "entry" ? [entryHtml] : [])],
  resolve: {
    // Pin @problem/App to the exact entry we picked. Vite's default extension order puts
    // .jsx ahead of .tsx, so plain extension resolution would silently prefer a stale
    // App.jsx over the App.tsx you're actually editing.
    alias: [
      ...(isShell
        ? [{ find: "@problem/App", replacement: join(target.dir, layout.entry) }]
        : []),
      { find: "@problem", replacement: target.dir },
    ],
  },
  server: {
    open: !noOpen,
    // The shell lives outside the problem folder, so both need to be readable.
    fs: { allow: [ROOT] },
  },
});

await server.listen();
console.log(`\n  ${target.rel}  (${layout.mode})`);
server.printUrls();
console.log();
