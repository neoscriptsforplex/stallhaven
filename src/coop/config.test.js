import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coopAvailable, configuredServerUrl, isLocalHost, roomServerUrl, LOCAL_ROOM_SERVER } from './config.js';

const metaDoc = (content) => ({ querySelector: (sel) => (sel.includes('stallhaven-room-server') && content != null ? { getAttribute: () => content } : null) });

test('co-op is hidden on the live site until a room server is configured', () => {
  assert.equal(coopAvailable({ env: {}, doc: metaDoc(null), hostname: 'neoscriptsforplex.github.io' }), false);
  assert.equal(coopAvailable({ env: {}, doc: metaDoc(''), hostname: 'neoscriptsforplex.github.io' }), false);
});

test('a meta tag or VITE_ROOM_SERVER_URL turns it on anywhere', () => {
  assert.equal(coopAvailable({ env: {}, doc: metaDoc('https://rooms.example/'), hostname: 'neoscriptsforplex.github.io' }), true);
  assert.equal(coopAvailable({ env: { VITE_ROOM_SERVER_URL: 'https://r.example' }, doc: metaDoc(null), hostname: 'x.github.io' }), true);
  assert.equal(configuredServerUrl({ env: {}, doc: metaDoc('https://rooms.example//') }), 'https://rooms.example');
  assert.equal(roomServerUrl({ env: { VITE_ROOM_SERVER_URL: 'https://a.example' }, doc: metaDoc('https://b.example') }), 'https://a.example');
});

test('running locally shows it and uses the local dev server', () => {
  for (const h of ['localhost', '127.0.0.1', '::1', 'game.localhost']) assert.equal(isLocalHost(h), true, h);
  assert.equal(isLocalHost('192.168.1.5'), false);
  assert.equal(coopAvailable({ env: {}, doc: metaDoc(null), hostname: 'localhost' }), true);
  assert.equal(roomServerUrl({ env: {}, doc: metaDoc(null) }), LOCAL_ROOM_SERVER);
});
