#!/usr/bin/env node
/* Zero-dependency bundler.

   Walks the ES-module graph from src/main.js, wraps each module in its
   own scope, wires imports as destructuring from the modules it depends
   on, and emits a single self-contained dashboard.html.

   Module scoping is real, not cosmetic: two screens can both define a
   local `notesTab` without colliding, exactly as they do under native
   ES modules in dev.html.

   Usage: node build.mjs [--entry src/main.js] [--styles src/styles]
                         [--out dashboard.html] [--title "…"]
*/

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const ENTRY = resolve(ROOT, arg('entry', 'src/main.js'));
const STYLES = resolve(ROOT, arg('styles', 'src/styles'));
const OUT = resolve(ROOT, arg('out', 'dashboard.html'));
const TITLE = arg('title', 'Booqable Operator Console');
const FONTS = arg('fonts',
  'family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700');

/* ---------- parse ---------- */
const IMPORT_NAMED = /^[ \t]*import\s+\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm;
const IMPORT_BARE = /^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const EXPORT_DECL = /^[ \t]*export\s+(?:(const|let|var)\s+([A-Za-z_$][\w$]*)|(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*))/gm;
const EXPORT_LIST = /^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm;

const modules = new Map();   // absolute path -> { id, code, deps, exports, imports }
let nextId = 0;

function moduleId(path) {
  const rel = relative(resolve(ROOT, 'src'), path).replace(/\.js$/, '').replace(/[^\w]/g, '_');
  return `__m_${rel}_${nextId++}`;
}

function load(path) {
  if (modules.has(path)) return modules.get(path);

  const source = readFileSync(path, 'utf8');
  const record = { path, id: moduleId(path), deps: [], imports: [], exports: [], code: '' };
  modules.set(path, record);        // set first: tolerates a cycle without recursing forever

  let code = source;

  /* named imports */
  code = code.replace(IMPORT_NAMED, (_, names, spec) => {
    const dep = resolveSpec(path, spec);
    record.deps.push(dep);
    const bindings = names.split(',').map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      return m ? `${m[1]}: ${m[2]}` : s;
    });
    record.imports.push({ dep, bindings });
    return '';                       // the destructuring is emitted in dependency order below
  });

  /* side-effect imports */
  code = code.replace(IMPORT_BARE, (_, spec) => {
    record.deps.push(resolveSpec(path, spec));
    return '';
  });

  /* exports */
  let m;
  EXPORT_DECL.lastIndex = 0;
  while ((m = EXPORT_DECL.exec(code)) !== null) record.exports.push(m[2] || m[3] || m[4]);
  EXPORT_LIST.lastIndex = 0;
  while ((m = EXPORT_LIST.exec(code)) !== null) {
    m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      const as = s.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      record.exports.push(as ? as[2] : s);
    });
  }
  code = code.replace(EXPORT_LIST, '');
  code = code.replace(/^([ \t]*)export\s+(?=(const|let|var|function|async|class)\b)/gm, '$1');

  record.code = code;
  record.deps.forEach(load);
  return record;
}

function resolveSpec(fromPath, spec) {
  if (!spec.startsWith('.')) throw new Error(`Only relative imports are supported (${spec} in ${fromPath})`);
  return resolve(dirname(fromPath), spec);
}

/* ---------- order ---------- */
function topoSort(entry) {
  const out = [];
  const state = new Map();
  (function visit(path) {
    const s = state.get(path);
    if (s === 'done') return;
    if (s === 'visiting') return;                   // cycle: emit in first-reached order
    state.set(path, 'visiting');
    modules.get(path).deps.forEach(visit);
    state.set(path, 'done');
    out.push(path);
  })(entry);
  return out;
}

/* ---------- emit ---------- */
function bundle() {
  load(ENTRY);
  const order = topoSort(ENTRY);
  const parts = order.map(path => {
    const m = modules.get(path);
    const wiring = m.imports
      .map(i => `const { ${i.bindings.join(', ')} } = ${modules.get(i.dep).id};`)
      .join('\n  ');
    const rel = relative(ROOT, path);
    return `/* ===== ${rel} ===== */
const ${m.id} = (() => {
  ${wiring}
${m.code}
  return { ${[...new Set(m.exports)].join(', ')} };
})();`;
  });
  return parts.join('\n\n');
}

function styles() {
  const dir = STYLES;
  return readdirSync(dir).filter(f => f.endsWith('.css')).sort()
    .map(f => `/* ===== styles/${f} ===== */\n` + readFileSync(resolve(dir, f), 'utf8'))
    .join('\n');
}

const html = `<title>${TITLE}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${FONTS}&display=swap">
<style>
${styles()}
</style>

<div id="app"></div>
<div class="toasts" id="toasts"></div>
<div id="modal-root"></div>

<script>
/* ${TITLE} — built by build.mjs from ${relative(ROOT, ENTRY)}.
   Edit the modules under src/, not this file. */
(() => {
${bundle()}
})();
</script>
`;

writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`built ${relative(ROOT, OUT)} — ${modules.size} modules, ${kb} KB`);
