import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { describe, it } from 'node:test';

import {
  MILESTONES,
  archivePrefix,
  assertPublished,
  chooseStrategy,
  injectArchiveShim,
  renderVersionsIndex,
  storageShim,
} from '../../scripts/build-versions.mjs';

const MOCK = `
function Storage() {
  this._data = new Map();
  this._order = [];
}
Storage.prototype.getItem = function (key) {
  key = String(key);
  return this._data.has(key) ? this._data.get(key) : null;
};
Storage.prototype.setItem = function (key, value) {
  key = String(key);
  value = String(value);
  if (!this._data.has(key)) this._order.push(key);
  this._data.set(key, value);
};
Storage.prototype.removeItem = function (key) {
  key = String(key);
  if (!this._data.has(key)) return;
  this._data.delete(key);
  this._order = this._order.filter((item) => item !== key);
};
Storage.prototype.key = function (index) {
  return this._order[index] ?? null;
};
Storage.prototype.clear = function () {
  this._data.clear();
  this._order = [];
};
Object.defineProperty(Storage.prototype, 'length', {
  configurable: true,
  enumerable: true,
  get() { return this._order.length; },
});
function IDBFactory() {}
IDBFactory.prototype.open = function (name, version) {
  this.opened = { name, version, arity: arguments.length };
  return this.opened;
};
IDBFactory.prototype.deleteDatabase = function (name) {
  this.deleted = name;
  return name;
};
var localStorage = new Storage();
var sessionStorage = new Storage();
var indexedDB = new IDBFactory();
`;

function boot(slug) {
  const context = vm.createContext({});
  vm.runInContext(MOCK, context);
  context.localStorage.setItem('stallhaven-tip', 'live');
  context.sessionStorage.setItem('stallhaven-tip', 'live-session');
  vm.runInContext(storageShim(slug), context);
  return context;
}

describe('version archive', () => {
  it('namespaces localStorage, sessionStorage, and IndexedDB without touching foreign keys', () => {
    const slug = '2026-09-03';
    const prefix = archivePrefix(slug);
    const { localStorage, sessionStorage, indexedDB } = boot(slug);

    assert.equal(localStorage.getItem('stallhaven-tip'), null);
    assert.equal(localStorage.length, 0);
    assert.equal(localStorage._data.get('stallhaven-tip'), 'live');

    localStorage.setItem('stallhaven-tip', 'archive');
    localStorage.setItem('gold', '40');
    assert.equal(localStorage.getItem('stallhaven-tip'), 'archive');
    assert.equal(localStorage.getItem('gold'), '40');
    assert.equal(localStorage.length, 2);
    assert.equal(localStorage.key(0), 'stallhaven-tip');
    assert.equal(localStorage.key(1), 'gold');
    assert.equal(localStorage.key(2), null);
    assert.equal(localStorage._data.get(`${prefix}stallhaven-tip`), 'archive');
    assert.equal(localStorage._data.get('stallhaven-tip'), 'live');

    localStorage.removeItem('gold');
    assert.equal(localStorage.getItem('gold'), null);
    assert.equal(localStorage.length, 1);
    assert.equal(localStorage._data.has(`${prefix}gold`), false);

    localStorage.clear();
    assert.equal(localStorage.getItem('stallhaven-tip'), null);
    assert.equal(localStorage.length, 0);
    assert.equal(localStorage._data.get('stallhaven-tip'), 'live');
    assert.equal(localStorage._data.has(`${prefix}stallhaven-tip`), false);

    assert.equal(sessionStorage.getItem('stallhaven-tip'), null);
    assert.equal(sessionStorage._data.get('stallhaven-tip'), 'live-session');
    sessionStorage.setItem('stallhaven-tip', 'archive-session');
    assert.equal(sessionStorage.getItem('stallhaven-tip'), 'archive-session');
    assert.equal(localStorage.getItem('stallhaven-tip'), null);
    assert.equal(sessionStorage._data.get(`${prefix}stallhaven-tip`), 'archive-session');

    const opened = indexedDB.open('stallhaven', 1);
    assert.equal(opened.name, `${prefix}stallhaven`);
    assert.equal(opened.version, 1);
    assert.equal(opened.arity, 2);
    assert.equal(indexedDB.open('stallhaven').name, `${prefix}stallhaven`);
    assert.equal(indexedDB.deleteDatabase('stallhaven'), `${prefix}stallhaven`);
  });

  it('injects the shim before any other script', () => {
    const page = '<!doctype html><html><head><script type="importmap">{}</script><script type="module" src="./src/main.js"></script></head></html>';
    const out = injectArchiveShim(page, '2026-09-13');
    const shimAt = out.indexOf('stallhaven-archive-2026-09-13:');
    const mapAt = out.indexOf('importmap');
    const mainAt = out.indexOf('./src/main.js');
    assert.ok(shimAt > 0 && shimAt < mapAt && mapAt < mainAt);
    assert.equal(storageShim('2026-09-13').toLowerCase().includes('</script'), false);
  });

  it('copies importmap snapshots and vite-builds bare three imports', () => {
    assert.equal(chooseStrategy('<html><head><script type="importmap"></script></head></html>'), 'copy');
    assert.equal(chooseStrategy("<html><head><script type='importmap'></script></head></html>"), 'copy');
    assert.equal(chooseStrategy('<html><head><script type="module" src="./src/main.js"></script></head></html>'), 'vite');
  });

  it('lists milestones newest first, with Latest at the live root', () => {
    const html = renderVersionsIndex(MILESTONES.map((entry) => ({ ...entry, status: 'playable' })));
    const latest = html.indexOf('Oct 8 / Latest (live main)');
    const recent = html.indexOf('Oct 6, big polish day (fountain cobble)');
    const oldest = html.indexOf('Sep 3, first build');
    assert.ok(latest >= 0 && latest < recent && recent < oldest);
    assert.match(html, /href="\.\.\/"/);
    assert.match(html, /href="\.\/2026-10-06\/"/);
    assert.match(html, /href="\.\/2026-09-03\/"/);
    assert.match(html, /commit\/9a339c57615ce1e574f11f4c29893896896894d3/);
    assert.match(html, /commit\/e8e6e3b87ba6ab7e0ea8eb90f41d1bcc610e7b11/);
    assert.match(html, /tree\/main/);
    assert.match(html, /runecraft_loading_bg\.jpg/);
    assert.equal(html.includes('stallhaven-archive-'), false);

    const skipped = renderVersionsIndex([
      {
        slug: '2026-09-03',
        label: 'Sep 3 <old>',
        sha: 'e8e6e3b87ba6ab7e0ea8eb90f41d1bcc610e7b11',
        status: 'skipped',
        note: 'vite blew up <b>',
      },
      { slug: 'latest', label: 'Latest', sha: null, status: 'playable' },
    ]);
    assert.match(skipped, /Sep 3 &lt;old&gt;/);
    assert.match(skipped, /vite blew up &lt;b&gt;/);
    assert.equal(skipped.includes('href="./2026-09-03/"'), false);
    assert.match(skipped, /href="\.\.\/"/);
    assert.match(skipped, />Code</);
  });

  it('checks published entries against the version directory', () => {
    const dir = fs.mkdtempSync('/tmp/stallhaven-archive-assert-');
    try {
      fs.mkdirSync(`${dir}/assets`, { recursive: true });
      fs.writeFileSync(`${dir}/assets/index.js`, 'export {}');
      fs.writeFileSync(`${dir}/assets/index.css`, 'body{}');
      const html = injectArchiveShim(
        '<html><head><script type="module" src="/stallhaven/versions/2026-09-03/assets/index.js"></script><link rel="stylesheet" href="/stallhaven/versions/2026-09-03/assets/index.css"></head></html>',
        '2026-09-03',
      );
      assert.doesNotThrow(() => assertPublished(dir, '2026-09-03', html, 'vite'));
      assert.throws(() => assertPublished(dir, '2026-09-03', '<html><head></head></html>', 'vite'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the live page free of the archive shim and links to the list', () => {
    const root = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    assert.match(root, /class="help-archive"/);
    assert.match(root, /href="\.\/versions\/"/);
    assert.equal(root.includes('stallhaven-archive-'), false);
    assert.match(readme, /https:\/\/neoscriptsforplex\.github\.io\/stallhaven\/versions\//);
  });
});
