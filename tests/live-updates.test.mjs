import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { createWorkspaceUpdates, startWorkspacePolling } from '../src/services/liveUpdates.js';

const harness = changes => {
  let scheduled, cancelled = false, applications = 0, downloads = 0;
  const state = { revision: 'one', visible: true, editable: false, errors: [] };
  const polling = startWorkspacePolling({
    updates: { revision: async () => state.revision, snapshot: async () => { downloads++; return { records: downloads }; } },
    available: () => state.visible, canApply: () => !state.editable,
    apply: () => { applications++; }, onError: error => state.errors.push(error),
    schedule: (fn, delay) => { scheduled = { fn, delay }; return 1; }, cancel: () => { cancelled = true; },
    ...changes,
  });
  return { polling, state, scheduled: () => scheduled, applications: () => applications, downloads: () => downloads, cancelled: () => cancelled };
};

test('30-second polling skips unchanged data, hidden/offline views and preserves unsaved work', async () => {
  const h = harness();
  assert.equal(h.scheduled().delay, 30000);
  await h.polling.refresh(); assert.equal(h.applications(), 1);
  await h.polling.refresh(); assert.equal(h.downloads(), 1);
  h.state.visible = false; h.state.revision = 'two';
  await h.polling.refresh(); assert.equal(h.downloads(), 1);
  h.state.visible = true; h.state.editable = true;
  await h.polling.refresh(); assert.equal(h.applications(), 1);
  h.state.editable = false;
  await h.polling.refresh(); assert.equal(h.applications(), 2, 'deferred revision was not lost');
  h.polling.stop(); assert.ok(h.cancelled());
});

test('polls never overlap and disposed sessions cannot publish stale responses', async () => {
  let resolve, calls = 0, applied = 0;
  const h = harness({ updates: { revision: async () => 'one', snapshot: () => { calls++; return new Promise(done => { resolve = done; }); } }, apply: () => applied++ });
  const pending = h.polling.refresh();
  await Promise.resolve(); await Promise.resolve();
  await h.polling.refresh(); assert.equal(calls, 1);
  h.polling.stop(); resolve({ account: 'old-user' }); await pending;
  assert.equal(applied, 0);
});

test('poll failures retain data and back off; successful recovery resets interval', async () => {
  let failed = true;
  const h = harness({ updates: { revision: async () => { if (failed) throw new Error('offline'); return 'one'; }, snapshot: async () => ({}) } });
  await h.polling.refresh(); assert.equal(h.scheduled().delay, 60000); assert.equal(h.applications(), 0);
  await h.polling.refresh(); assert.equal(h.scheduled().delay, 120000);
  failed = false; await h.polling.refresh(); assert.equal(h.scheduled().delay, 30000); assert.equal(h.applications(), 1);
  h.polling.stop();
});

test('service refresh never reads drafts or makes customer-only calls for a forced-password session', async () => {
  const updates = createWorkspaceUpdates({ auth: { getSession: async () => ({ id: 'fabricated', forcePasswordChange: true }) } });
  assert.deepEqual((await updates.snapshot()).orders, []);
});

test('UI refresh uses service boundary and preserves notification content when marking read', async () => {
  const source = await fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /createWorkspaceUpdates\(services\)/);
  assert.match(source, /\.\.\.notification, \.\.\.updated/);
  assert.match(source, /data-live-editing/);
  assert.match(source, /polling\.stop\(\)/);
  const panel = await fs.readFile(new URL('../src/components/WorkflowActionPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /data-live-editing/);
});
