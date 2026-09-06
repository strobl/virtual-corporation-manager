import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { startServer } from '../src/server/index.js';
import type { DomainCommand } from '../src/domain/contracts.js';
import type {
  TimeEntryInput,
  TimeIngressResult,
  TimeReceipt,
  TimeSnapshot,
} from '../src/time/contracts.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});
const raw = (url: string, path: string, headers: Record<string, string>) =>
  new Promise<number>((resolve, reject) => {
    const u = new URL(url);
    const req = request({ hostname: u.hostname, port: u.port, path, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode!));
    });
    req.on('error', reject);
    req.end();
  });

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'gitflash-time-http-'));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const webDir = join(dir, 'web');
  await mkdir(webDir);
  await writeFile(join(webDir, 'index.html'), '<!doctype html><title>Time tests</title>');
  const dataDir = join(dir, 'data');
  const app = await startServer({ dataDir, webDir, port: 0 });
  cleanup.push(() => app.close());
  const { token } = await (await fetch(app.url + '/api/session')).json();
  const headers = { 'Content-Type': 'application/json', 'X-GitFlash-Token': token };
  const post = async (path: string, value: unknown) => {
    const response = await fetch(app.url + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(value),
    });
    return { status: response.status, body: await response.json() };
  };
  const state = async () => await (await fetch(app.url + '/api/state')).json();
  const time = async (): Promise<TimeSnapshot> => await (await fetch(app.url + '/api/time')).json();
  const apply = async (commands: DomainCommand[]) => {
    const preview = await post('/api/preview', {
      commands,
      baseRevision: (await state()).revision,
    });
    expect(preview.status).toBe(200);
    const saved = await post('/api/apply', { previewId: preview.body.id });
    expect(saved.status).toBe(200);
    return saved.body.state;
  };
  const configured = await apply(
    ['A', 'B'].map((name): DomainCommand => ({
      type: 'company.create',
      input: { name, shortCode: name, description: '', color: '#123456' },
    })),
  );
  const a: string = configured.companies[0].id;
  const b: string = configured.companies[1].id;
  const withAgent = await apply([
    {
      type: 'agent.create',
      companyId: a,
      input: {
        name: 'Same Name',
        role: 'Analyst',
        kind: 'agent',
        instructions: 'Return evidence.',
        responsibilities: ['Analyze'],
        departmentId: null,
        managerId: null,
      },
    },
  ]);
  const agentId: string = withAgent.agents[0].id;
  const entry = (patch: Partial<TimeEntryInput> = {}) => ({
    agentId,
    companyId: a,
    date: '2020-01-02',
    hours: 0.1,
    description: 'Synthetic HTTP delivery',
    ...patch,
  });
  return { app, dataDir, webDir, headers, post, time, state, apply, a, b, agentId, entry };
}

describe('independent loopback Time Tracker API', () => {
  it('enforces the existing origin/host/session boundary on the new reads and writes', async () => {
    const f = await setup();
    for (const path of ['/api/time', '/api/time/catalog', '/api/time/export']) {
      for (const headers of [
        { Host: 'attacker.example' },
        { Origin: 'https://attacker.example' },
        { 'Sec-Fetch-Site': 'cross-site' },
      ] as Record<string, string>[]) {
        expect(await raw(f.app.url, path, headers)).toBe(403);
      }
    }
    const command = { type: 'entry.create', requestId: 'protected-time-request', input: f.entry() };
    for (const path of ['/api/time/mutate', '/api/time/ingest']) {
      const response = await fetch(f.app.url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          path.endsWith('mutate') ? command : { requestId: 'protected-ingress', ...f.entry() },
        ),
      });
      expect(response.status).toBe(403);
    }
    const noJson = await fetch(f.app.url + '/api/time/mutate', {
      method: 'POST',
      headers: { 'X-GitFlash-Token': f.headers['X-GitFlash-Token'], 'Content-Type': 'text/plain' },
      body: JSON.stringify(command),
    });
    expect(noJson.status).toBe(415);
    expect(
      (await fetch(f.app.url + '/api/time/mutate', { method: 'PUT', headers: f.headers })).status,
    ).toBe(404);
    expect((await f.time()).entries).toEqual([]);
    expect((await f.time()).history).toEqual([]);
  });

  it('returns ordered mixed-batch outcomes and never duplicates successful fractional entries', async () => {
    const f = await setup();
    const batch = {
      entries: [
        { requestId: 'batch-first-entry', ...f.entry({ hours: 0.1 }) },
        { requestId: 'batch-invalid-entry', ...f.entry({ hours: 0.15 }) },
        { requestId: 'batch-third-entry', ...f.entry({ hours: 0.2 }) },
      ],
    };
    const first = await f.post('/api/time/ingest', batch);
    expect(first.status).toBe(207);
    expect(first.body.results).toMatchObject([
      { index: 0, ok: true },
      { index: 1, ok: false, error: { code: 'INVALID_INPUT' } },
      { index: 2, ok: true },
    ]);
    const saved = await f.time();
    expect(saved.entries).toHaveLength(2);
    expect(saved.entries.every((e) => e.source === 'agent')).toBe(true);
    expect(saved.entries.reduce((sum, e) => sum + e.tenths, 0)).toBe(3);
    expect((await f.post('/api/time/ingest', batch)).body).toEqual(first.body);
    expect(await f.time()).toEqual(saved);
    const conflict = await f.post('/api/time/ingest', {
      requestId: 'batch-first-entry',
      ...f.entry({ hours: 1 }),
    });
    expect(conflict.status).toBe(207);
    expect(conflict.body.results).toMatchObject([
      { index: 0, ok: false, error: { code: 'CONFLICT' } },
    ]);
    expect(await f.time()).toEqual(saved);
    for (const entries of [
      [],
      Array.from({ length: 51 }, (_, i) => ({ requestId: `large-batch-${i}`, ...f.entry() })),
    ]) {
      const invalid = await f.post('/api/time/ingest', { entries });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('INVALID_BATCH');
    }
    expect(await f.time()).toEqual(saved);
    const fifty = await f.post('/api/time/ingest', {
      entries: Array.from({ length: 50 }, (_, i) => ({
        requestId: `valid-fifty-${i}`,
        ...f.entry({ hours: 0.1 }),
      })),
    });
    expect(fifty.status).toBe(201);
    expect(fifty.body.results).toHaveLength(50);
    expect(fifty.body.results.map((result: TimeIngressResult) => result.index)).toEqual(
      Array.from({ length: 50 }, (_, i) => i),
    );
    expect(fifty.body.results.every((result: TimeIngressResult) => result.ok)).toBe(true);
    const afterFifty = await f.time();
    expect(afterFifty.entries).toHaveLength(52);
    expect(afterFifty.entries.reduce((sum, e) => sum + e.tenths, 0)).toBe(53);
  });

  it('exports a versioned, read-only ledger with corrections and voids, separate from configuration export', async () => {
    const f = await setup();
    const first = await f.post('/api/time/mutate', {
      type: 'entry.create',
      requestId: 'manual-time-create',
      input: f.entry({
        description: '<script>inert synthetic text</script>',
        clientProject: 'Fixture project',
      }),
    });
    expect(first.status).toBe(200);
    const original = (first.body as TimeReceipt).entry!;
    expect(original.source).toBe('manual');
    const update = await f.post('/api/time/mutate', {
      type: 'entry.update',
      requestId: 'manual-time-update',
      id: original.id,
      expectedVersion: original.version,
      input: { hours: 0.3 },
    });
    expect(update.status).toBe(200);
    expect(update.body.entry.tenths).toBe(3);
    const stale = await f.post('/api/time/mutate', {
      type: 'entry.update',
      requestId: 'manual-stale-update',
      id: original.id,
      expectedVersion: original.version,
      input: { hours: 4 },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    expect(
      (
        await f.post('/api/time/mutate', {
          type: 'entry.void',
          requestId: 'manual-time-void',
          id: original.id,
          expectedVersion: update.body.entry.version,
          reason: 'Synthetic correction scenario',
        })
      ).status,
    ).toBe(200);
    const before = await f.time();
    expect(before.entries[0]).toMatchObject({
      status: 'void',
      description: '<script>inert synthetic text</script>',
      tenths: 3,
    });
    expect(before.history.filter((h) => h.entryId === original.id)).toHaveLength(3);
    const response = await fetch(f.app.url + '/api/time/export');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('vcm-delivery-hours.json');
    expect(await response.json()).toEqual({
      format: 'gitflash-delivery-hours',
      version: 1,
      ...before,
    });
    expect(await f.time()).toEqual(before);
    const definitionResponse = await fetch(f.app.url + '/api/export');
    expect(definitionResponse.headers.get('content-disposition')).toContain(
      'attachment; filename="vcm-company.json"',
    );
    const definition = await definitionResponse.json();
    expect(definition.schemaVersion).toBe(1);
    expect(definition).not.toHaveProperty('entries');
    expect(definition).not.toHaveProperty('time');
    expect(JSON.stringify(definition)).not.toContain('Fixture project');
  });

  it('uses explicit member/company identity and rejects wrong-company and invalid-date ingress', async () => {
    const f = await setup();
    const first = await f.post('/api/time/ingest', {
      requestId: 'implicit-primary-http',
      ...f.entry({ companyId: undefined }),
    });
    expect(first.status).toBe(201);
    expect(first.body.results[0]).toMatchObject({
      ok: true,
      receipt: { entry: { companyId: f.a, agentId: f.agentId } },
    });
    const before = await f.time();
    const invalid = await f.post('/api/time/ingest', {
      entries: [
        { requestId: 'wrong-company-http', ...f.entry({ companyId: f.b }) },
        { requestId: 'invalid-date-http', ...f.entry({ date: '2026-02-30' }) },
        { requestId: 'unknown-member-http', ...f.entry({ agentId: 'Same Name' }) },
        { requestId: 'future-date-http', ...f.entry({ date: '9999-01-01' }) },
      ],
    });
    expect(invalid.status).toBe(207);
    expect(invalid.body.results.map((r: TimeIngressResult) => r.ok)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(invalid.body.results[0].error.code).toBe('NO_ASSIGNMENT');
    expect(invalid.body.results[1].error.code).toBe('INVALID_DATE');
    expect(invalid.body.results[2].error.code).toBe('NOT_FOUND');
    expect(invalid.body.results[3].error.code).toBe('INVALID_DATE');
    expect(await f.time()).toEqual(before);
  });

  it('returns durable catalog/fallback receipts after catalog edits and an offline server restart', async () => {
    const f = await setup();
    const catalog = await f.post('/api/time/mutate', {
      type: 'catalog.save',
      requestId: 'http-catalog-create',
      expectedVersion: null,
      input: {
        code: 'HTTP-25',
        name: 'Synthetic deliverable',
        category: 'Testing',
        referenceHours: 2.5,
      },
    });
    expect(catalog.status).toBe(200);
    const request = {
      requestId: 'http-durable-request',
      ...f.entry({ hours: undefined, deliverable: 'HTTP-25', quantity: 2 }),
    };
    const original = await f.post('/api/time/ingest', request);
    expect(original.status).toBe(201);
    expect(original.body.results[0].receipt.entry).toMatchObject({
      tenths: 50,
      basis: { kind: 'catalog', referenceTenths: 25, quantity: 2 },
    });
    expect(
      (
        await f.post('/api/time/mutate', {
          type: 'catalog.save',
          requestId: 'http-catalog-change',
          expectedVersion: catalog.body.catalog.version,
          input: {
            code: 'HTTP-25',
            name: 'Changed reference',
            category: 'Testing',
            referenceHours: 40,
          },
        })
      ).status,
    ).toBe(200);
    const fallback = await f.post('/api/time/ingest', {
      requestId: 'http-fallback-request',
      ...f.entry({ hours: undefined, deliverable: 'HTTP-UNKNOWN', quantity: 2 }),
    });
    expect(fallback.body.results[0].receipt.entry).toMatchObject({
      tenths: 160,
      basis: {
        kind: 'fallback',
        requestedDeliverable: 'HTTP-UNKNOWN',
        referenceTenths: 80,
        catalogCode: null,
      },
    });
    expect((await f.post('/api/time/ingest', request)).body).toEqual(original.body);
    expect(
      (
        await f.post('/api/time/mutate', {
          type: 'catalog.save',
          requestId: 'http-decimal-catalog',
          expectedVersion: null,
          input: {
            code: 'HTTP-TEN',
            name: 'Decimal boundary',
            category: 'Testing',
            referenceHours: 10,
          },
        })
      ).status,
    ).toBe(200);
    const decimalRequest = {
      requestId: 'http-decimal-boundary',
      ...f.entry({ hours: undefined, deliverable: 'HTTP-TEN', quantity: 1.005 }),
    };
    const decimal = await f.post('/api/time/ingest', decimalRequest);
    expect(decimal.status).toBe(201);
    expect(decimal.body.results[0].receipt.entry).toMatchObject({
      tenths: 101,
      basis: { kind: 'catalog', referenceTenths: 100, quantity: 1.005 },
    });
    const before = await f.time();
    const effectiveCatalog = await (await fetch(f.app.url + '/api/time/catalog')).json();
    expect(Array.isArray(effectiveCatalog)).toBe(true);
    expect(effectiveCatalog.find((c: { code: string }) => c.code === 'http-25')).toMatchObject({
      referenceTenths: 400,
    });
    await f.app.close();
    const restarted = await startServer({ dataDir: f.dataDir, webDir: f.webDir, port: 0 });
    cleanup.push(() => restarted.close());
    expect(await (await fetch(restarted.url + '/api/time')).json()).toEqual(before);
    expect(
      (
        await fetch(restarted.url + '/api/time/ingest', {
          method: 'POST',
          headers: f.headers,
          body: JSON.stringify(request),
        })
      ).status,
    ).toBe(403);
    const { token } = await (await fetch(restarted.url + '/api/session')).json();
    const replay = await fetch(restarted.url + '/api/time/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GitFlash-Token': token },
      body: JSON.stringify(request),
    });
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(original.body);
    const decimalReplay = await fetch(restarted.url + '/api/time/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GitFlash-Token': token },
      body: JSON.stringify(decimalRequest),
    });
    expect(decimalReplay.status).toBe(201);
    expect(await decimalReplay.json()).toEqual(decimal.body);
    expect(await (await fetch(restarted.url + '/api/time')).json()).toEqual(before);
  });
});
