// Post-build step: fold the single JS chunk and single CSS file that Vite
// emits into dist/index.html, producing one self-contained HTML document
// with no external asset requests.
//
// Why: the "Publish HTML" feature embeds a process file into a copy of the
// app's own index.html and saves it down as a standalone, offline, read-only
// viewer. That only works if index.html already carries all of its JS/CSS
// inline — otherwise a saved copy opened via file:// would 404 on the hashed
// /assets/* URLs (and ES-module imports are blocked under file:// anyway).
//
// The build is configured (vite.config.ts) with `inlineDynamicImports: true`
// and `cssCodeSplit: false`, so there is exactly one entry script and one
// stylesheet to inline. No dependencies — plain Node ESM.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const indexPath = join(dist, 'index.html');

let html = await readFile(indexPath, 'utf8');

// A literal `</script` inside the bundled JS would otherwise close the inline
// <script> element early. Escaping the slash keeps the parser out while the
// JS itself still sees the original text.
const escapeScript = (code) => code.replace(/<\/script/gi, '<\\/script');

// CRITICAL: always pass a FUNCTION to String.replace for the inlined payloads.
// A string replacement interprets `$&`, `$'`, `$\``, `$1`… — and the minified
// bundle is full of those sequences (e.g. React's `.replace(re, "$&/")`),
// which would otherwise be rewritten and silently corrupt the JS.
const asReplacer = (text) => () => text;

// 1) Inline the entry module script: <script type="module" ... src="/base/assets/x.js">
const scriptRe =
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi;
const scriptMatches = [...html.matchAll(scriptRe)];
for (const m of scriptMatches) {
  const src = m[1];
  const assetPath = join(dist, src.replace(/^.*\/assets\//, 'assets/'));
  const code = await readFile(assetPath, 'utf8');
  html = html.replace(
    m[0],
    asReplacer(`<script type="module">\n${escapeScript(code)}\n</script>`),
  );
}

// 2) Inline every stylesheet: <link rel="stylesheet" ... href="/base/assets/x.css">
const linkRe =
  /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi;
const linkMatches = [...html.matchAll(linkRe)];
for (const m of linkMatches) {
  const href = m[1];
  const assetPath = join(dist, href.replace(/^.*\/assets\//, 'assets/'));
  const css = await readFile(assetPath, 'utf8');
  html = html.replace(m[0], asReplacer(`<style>\n${css}\n</style>`));
}

// 3) Drop modulepreload hints — those hashed chunk URLs no longer exist once
//    the single chunk is inlined, and under file:// they would just 404.
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>\s*/gi, '');

// 4) Inline the favicon as a data URI so a published file:// copy stays clean
//    (the absolute /slinky-robot/favicon.svg would 404 offline). If the icon
//    is missing for any reason, just drop the link rather than failing.
try {
  const svg = await readFile(join(root, 'public', 'favicon.svg'), 'utf8');
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  html = html.replace(
    /<link\b[^>]*\brel="icon"[^>]*>/i,
    asReplacer(`<link rel="icon" href="${dataUri}" />`),
  );
} catch {
  html = html.replace(/<link\b[^>]*\brel="icon"[^>]*>\s*/i, '');
}

await writeFile(indexPath, html, 'utf8');

const sizeKb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log(
  `inline.mjs: inlined ${scriptMatches.length} script(s) + ${linkMatches.length} stylesheet(s) → dist/index.html (${sizeKb} KB)`,
);
