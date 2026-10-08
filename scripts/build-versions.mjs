#!/usr/bin/env node
/**
 * Build playable milestone snapshots into versions/<slug>/ for GitHub Pages.
 *
 * Historical trees are extracted with git archive (the checkout must contain
 * the commits; the Pages workflow uses fetch-depth: 0). They are not stored
 * on main. A milestone that cannot be built is omitted and noted on the index.
 *
 * Versions whose index.html already has an import map are copied as-is, because
 * that is how the live site loads (raw ./src/main.js, assets under public/).
 * Older versions import bare "three" and are vite-built with
 * --base=/stallhaven/versions/<slug>/.
 */
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GITHUB_REPO = 'https://github.com/neoscriptsforplex/stallhaven';
export const MILESTONES = JSON.parse(
  fs.readFileSync(new URL('./versions.json', import.meta.url), 'utf8'),
);

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%236b4423' width='64' height='64' rx='10'/%3E%3Cpath fill='%23e8c37a' d='M12 40h40v8H12z'/%3E%3Cpath fill='%238b4336' d='M8 20h48l-6 12H14z'/%3E%3C/svg%3E";

export function archivePrefix(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Unsafe archive slug: ${slug}`);
  return `stallhaven-archive-${slug}:`;
}

/** Inline script that hides the live game's storage from an archived build. */
export function storageShim(slug) {
  const prefix = archivePrefix(slug);
  return `(() => {
  const PREFIX = ${JSON.stringify(prefix)};
  const proto = Storage.prototype;
  const rawGet = proto.getItem;
  const rawSet = proto.setItem;
  const rawRemove = proto.removeItem;
  const rawKey = proto.key;
  const lengthDesc = Object.getOwnPropertyDescriptor(proto, "length");
  const rawLength = lengthDesc && lengthDesc.get;

  function names(store) {
    const out = [];
    const total = rawLength ? rawLength.call(store) : 0;
    for (let i = 0; i < total; i += 1) {
      const key = rawKey.call(store, i);
      if (key && key.startsWith(PREFIX)) out.push(key.slice(PREFIX.length));
    }
    return out;
  }

  proto.getItem = function getItem(key) {
    return rawGet.call(this, PREFIX + String(key));
  };
  proto.setItem = function setItem(key, value) {
    return rawSet.call(this, PREFIX + String(key), String(value));
  };
  proto.removeItem = function removeItem(key) {
    return rawRemove.call(this, PREFIX + String(key));
  };
  proto.key = function key(index) {
    const list = names(this);
    const i = Number(index);
    return i >= 0 && i < list.length ? list[i] : null;
  };
  proto.clear = function clear() {
    for (const key of names(this)) rawRemove.call(this, PREFIX + key);
  };
  if (rawLength) {
    try {
      Object.defineProperty(proto, "length", {
        configurable: true,
        enumerable: Boolean(lengthDesc.enumerable),
        get() {
          return names(this).length;
        },
      });
    } catch {
      /* Leave the native length in place if this engine seals it. */
    }
  }

  const idbProto = typeof IDBFactory === "undefined" ? null : IDBFactory.prototype;
  if (idbProto && typeof idbProto.open === "function") {
    const rawOpen = idbProto.open;
    const rawDelete = idbProto.deleteDatabase;
    idbProto.open = function open(name, version) {
      const next = PREFIX + String(name);
      return arguments.length > 1 ? rawOpen.call(this, next, version) : rawOpen.call(this, next);
    };
    if (typeof rawDelete === "function") {
      idbProto.deleteDatabase = function deleteDatabase(name) {
        return rawDelete.call(this, PREFIX + String(name));
      };
    }
  }
})();`;
}

export function injectArchiveShim(html, slug) {
  const shim = storageShim(slug);
  if (shim.includes('<script') || shim.toLowerCase().includes('</script')) {
    throw new Error('Archive shim would break out of its script tag');
  }
  const match = html.match(/<head\b[^>]*>/i);
  if (!match) throw new Error('index.html has no <head>');
  const at = match.index + match[0].length;
  return `${html.slice(0, at)}\n<script>\n${shim}\n</script>\n${html.slice(at)}`;
}

/** importmap pages already run raw on Pages. Earlier pages need Vite to resolve "three". */
export function chooseStrategy(html) {
  if (typeof html !== 'string' || !/<html\b/i.test(html)) {
    throw new Error('Not an HTML document');
  }
  if (/<script\b[^>]*\btype\s*=\s*["']importmap["']/i.test(html)) return 'copy';
  return 'vite';
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function playUrl(entry) {
  if (!entry.sha) return '../';
  return `./${entry.slug}/`;
}

export function codeUrl(entry) {
  if (!entry.sha) return `${GITHUB_REPO}/tree/main`;
  return `${GITHUB_REPO}/commit/${entry.sha}`;
}

export function renderVersionsIndex(entries) {
  const items = [...entries].reverse().map((entry) => {
    const playable = entry.status !== 'skipped';
    const play = playable ? `<a class="play" href="${escapeHtml(playUrl(entry))}">Play</a>` : '';
    const note = entry.status === 'skipped'
      ? `\n            <p class="note">${escapeHtml(entry.note || 'This milestone could not be built for this deploy.')}</p>`
      : '';
    const when = entry.sha
      ? `<p class="when">${escapeHtml(entry.slug)} · ${escapeHtml(String(entry.sha).slice(0, 7))}</p>`
      : '<p class="when">Live game</p>';
    return `        <li>
          <div>
            <h2>${escapeHtml(entry.label)}</h2>
            ${when}${note}
          </div>
          <p class="links">${play}<a class="code" href="${escapeHtml(codeUrl(entry))}">Code</a></p>
        </li>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RuneCraft versions</title>
    <meta name="description" content="Play older RuneCraft milestones. Each archived build keeps its own save." />
    <link rel="icon" href="${FAVICON}" />
    <style>
      :root {
        --ink: #ead8b8;
        --gold: #e3b34a;
        --line: rgba(236, 214, 176, 0.28);
        --panel: rgba(36, 22, 12, 0.86);
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body {
        color: var(--ink);
        font-family: Palatino, "Palatino Linotype", Georgia, "Times New Roman", serif;
        background:
          linear-gradient(rgba(18, 10, 6, 0.72), rgba(18, 10, 6, 0.84)),
          url("../public/runecraft_loading_bg.jpg") center center / cover no-repeat fixed;
      }
      main { max-width: 760px; margin: 0 auto; padding: 36px 16px 72px; }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px 18px 8px 8px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        padding: 22px 22px 8px;
      }
      h1 { margin: 0 0 8px; color: #f0d27a; font-weight: 600; font-size: 2rem; }
      .intro { margin: 0 0 8px; line-height: 1.45; }
      .milestones { list-style: none; margin: 12px 0 0; padding: 0; }
      .milestones li {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        padding: 14px 0;
        border-top: 1px solid var(--line);
      }
      h2 { margin: 0; font-size: 1.15rem; font-weight: 600; }
      .when, .note { margin: 4px 0 0; }
      .when { color: #d7c09a; font-size: 0.92rem; }
      .note { color: #f0c2b0; font-size: 0.92rem; }
      .links { display: flex; gap: 14px; align-items: center; flex-shrink: 0; margin: 0; }
      a.play {
        display: inline-block;
        padding: 6px 14px;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, #f0d27a, #b8862f);
        color: #3a240e;
        font-weight: 700;
        text-decoration: none;
      }
      a.code { color: var(--gold); }
      a.code:hover, a.play:hover { filter: brightness(1.06); }
      @media (max-width: 560px) {
        .milestones li { flex-direction: column; align-items: flex-start; }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="panel">
        <h1>RuneCraft versions</h1>
        <p class="intro">Milestones, newest first. Latest is the live game. An older build keeps its own save in this browser and does not read or overwrite the live shop.</p>
        <ol class="milestones">
${items}
        </ol>
      </div>
    </main>
  </body>
</html>
`;
}

export function resolvePublishedRef(outDir, slug, ref) {
  if (!ref) return null;
  if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) return null;
  const clean = ref.split('#')[0].split('?')[0];
  const base = `/stallhaven/versions/${slug}/`;
  let rel = clean;
  if (rel.startsWith(base)) rel = rel.slice(base.length);
  else if (rel.startsWith('/')) return null;
  else if (rel.startsWith('./')) rel = rel.slice(2);
  else if (rel.startsWith('../')) return null;
  if (!rel || rel.endsWith('/')) return null;
  return path.join(outDir, rel);
}

export function assertPublished(outDir, slug, html, strategy) {
  const first = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/i);
  if (!first || !first[0].includes(archivePrefix(slug))) {
    throw new Error(`Archive shim is not the first script in ${slug}`);
  }
  if (strategy === 'vite' && !html.includes(`/stallhaven/versions/${slug}/`)) {
    throw new Error(`Vite base path missing from ${slug}`);
  }
  if (strategy === 'copy' && !/src\s*=\s*["']\.?\/?src\/main\.js["']/i.test(html)) {
    throw new Error(`Raw entry missing from ${slug}`);
  }
  const refs = [];
  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = match[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (src) refs.push(src[1]);
  }
  if (refs.length === 0) throw new Error(`No script entry in ${slug}`);
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!href) continue;
    if (/\brel\s*=\s*["']stylesheet["']/i.test(tag) || /\.css(?:$|\?)/i.test(href[1])) refs.push(href[1]);
  }
  for (const ref of refs) {
    const file = resolvePublishedRef(outDir, slug, ref);
    if (file && !fs.existsSync(file)) throw new Error(`Missing ${ref} for ${slug}`);
  }
}

function summarizeError(err) {
  const raw = [err?.stderr, err?.stdout, err?.message].filter(Boolean).join('\n');
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const useful = lines.filter((line) => !/^npm (?:warn|notice)\b/i.test(line));
  const text = (useful.length ? useful : lines).slice(-2).join(' — ');
  return text.replace(/\s+/g, ' ').slice(0, 220) || 'Build failed';
}

function nodeModulesCacheDir() {
  return process.env.STALLHAVEN_NM_CACHE
    ? path.resolve(process.env.STALLHAVEN_NM_CACHE)
    : path.join(os.tmpdir(), 'stallhaven-archive-nm');
}

async function ensureNodeModules(sourceDir) {
  const lockPath = path.join(sourceDir, 'package-lock.json');
  if (!fs.existsSync(lockPath) || !fs.existsSync(path.join(sourceDir, 'package.json'))) {
    throw new Error('package.json or package-lock.json is missing');
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex').slice(0, 16);
  const dir = path.join(nodeModulesCacheDir(), hash);
  const nm = path.join(dir, 'node_modules');
  const stamp = path.join(dir, '.ok');
  if (fs.existsSync(stamp) && fs.existsSync(nm)) {
    console.log(`Reusing node_modules ${hash}`);
    return nm;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(sourceDir, 'package.json'), path.join(dir, 'package.json'));
  fs.copyFileSync(lockPath, path.join(dir, 'package-lock.json'));
  console.log(`npm ci for lock ${hash}`);
  await execFileAsync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: dir,
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
  fs.writeFileSync(stamp, `${hash}\n`);
  return nm;
}

function extractCommit(sha, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  return execFileAsync('bash', [
    '-o', 'pipefail',
    '-c',
    'git archive --format=tar "$1" | tar -x -C "$2"',
    'extract',
    sha,
    dest,
  ], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
}

async function viteBuild(srcDir, nodeModules, base) {
  const link = path.join(srcDir, 'node_modules');
  fs.rmSync(link, { force: true });
  fs.symlinkSync(nodeModules, link, 'dir');
  const viteBin = path.join(nodeModules, '.bin', 'vite');
  await execFileAsync(viteBin, ['build', '--base', base], {
    cwd: srcDir,
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
}

async function buildOne(entry, srcDir) {
  await extractCommit(entry.sha, srcDir);
  const indexPath = path.join(srcDir, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error('index.html missing at this commit');
  const sourceHtml = fs.readFileSync(indexPath, 'utf8');
  const strategy = chooseStrategy(sourceHtml);
  const outDir = path.join(repoRoot, 'versions', entry.slug);
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(`Building ${entry.slug} (${strategy}) ${entry.sha.slice(0, 7)}`);
  try {
    if (strategy === 'copy') {
      fs.cpSync(srcDir, outDir, { recursive: true });
    } else {
      const base = `/stallhaven/versions/${entry.slug}/`;
      const nm = await ensureNodeModules(srcDir);
      await viteBuild(srcDir, nm, base);
      const dist = path.join(srcDir, 'dist');
      if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('vite build produced no dist/index.html');
      fs.cpSync(dist, outDir, { recursive: true });
    }
    const builtPath = path.join(outDir, 'index.html');
    const injected = injectArchiveShim(fs.readFileSync(builtPath, 'utf8'), entry.slug);
    assertPublished(outDir, entry.slug, injected, strategy);
    fs.writeFileSync(builtPath, injected);
  } catch (err) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw err;
  }
  return strategy;
}

function writeIndex(entries) {
  const dir = path.join(repoRoot, 'versions');
  fs.mkdirSync(dir, { recursive: true });
  const html = renderVersionsIndex(entries);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return html;
}

export async function buildArchives() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stallhaven-ver-'));
  const results = [];
  try {
    for (const entry of MILESTONES) {
      if (!entry.sha) {
        results.push({ ...entry, status: 'playable', strategy: 'root' });
        continue;
      }
      const srcDir = path.join(tmpRoot, entry.slug);
      try {
        const strategy = await buildOne(entry, srcDir);
        results.push({ ...entry, status: 'playable', strategy });
      } catch (err) {
        console.error(`Skipping ${entry.slug}: ${summarizeError(err)}`);
        results.push({
          ...entry,
          status: 'skipped',
          strategy: 'skipped',
          note: summarizeError(err),
        });
      } finally {
        const link = path.join(srcDir, 'node_modules');
        if (fs.existsSync(link)) fs.rmSync(link, { force: true });
        fs.rmSync(srcDir, { recursive: true, force: true });
      }
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
  writeIndex(results);
  console.log('Version archive:');
  for (const entry of [...results].reverse()) {
    const detail = entry.note ? ` — ${entry.note}` : '';
    console.log(`  ${entry.status} ${entry.slug} ${entry.strategy || ''}${detail}`);
  }
  return results;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const run = process.argv.includes('--index-only')
    ? Promise.resolve(writeIndex(MILESTONES.map((entry) => ({ ...entry, status: 'playable' }))))
    : buildArchives();
  run.catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
