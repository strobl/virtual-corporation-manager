import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { startServer } from '../src/server/index';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'gitflash-server-'));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const webDir = join(dir, 'web');
  await mkdir(webDir);
  await writeFile(join(webDir, 'index.html'), '<!doctype html><title>GitFlash</title>');
  const app = await startServer({ dataDir: join(dir, 'data'), webDir, port: 0 });
  cleanup.push(() => app.close());
  return { app, dir, webDir };
}
const raw = (url: string, path: string, headers: Record<string, string> = {}) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const u = new URL(url);
    const req = request({ hostname: u.hostname, port: u.port, path, headers }, (res) => {
      let body = '';
      res.on('data', (p) => (body += p));
      res.on('end', () => resolve({ status: res.statusCode!, body }));
    });
    req.on('error', reject);
    req.end();
  });
describe('loopback product boundary', () => {
  it('rejects foreign origins/hosts/fetch metadata and traversal without exposing data', async () => {
    const { app } = await setup();
    expect((app.server.address() as { address: string }).address).toBe('127.0.0.1');
    for (const headers of [
      { Host: 'attacker.example' },
      { Origin: 'https://attacker.example' },
      { 'Sec-Fetch-Site': 'cross-site' },
    ] as Record<string, string>[])
      expect((await raw(app.url, '/api/state', headers)).status).toBe(403);
    expect((await raw(app.url, '/%2e%2e/package.json')).status).toBe(400);
    expect((await raw(app.url, '/%5c..%5cpackage.json')).status).toBe(400);
    expect((await fetch(app.url + '/api/missing')).status).toBe(404);
  });
  it('requires session capability, applies a company once and persists across server restart', async () => {
    const { app, dir, webDir } = await setup();
    const payload = {
      commands: [
        {
          type: 'company.create',
          input: {
            name: 'Local Company',
            shortCode: 'LOCAL',
            description: 'Saved without an account',
            color: '#f6c928',
          },
        },
      ],
      baseRevision: 0,
    };
    expect(
      (
        await fetch(app.url + '/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      ).status,
    ).toBe(403);
    const { token } = await (await fetch(app.url + '/api/session')).json();
    const headers = { 'Content-Type': 'application/json', 'X-GitFlash-Token': token };
    const p = await fetch(app.url + '/api/preview', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    expect(p.status).toBe(200);
    const preview = await p.json();
    const apply = () =>
      fetch(app.url + '/api/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({ previewId: preview.id }),
      });
    const saved = await (await apply()).json();
    expect(saved.state.companies[0].name).toBe('Local Company');
    expect((await (await apply()).json()).replayed).toBe(true);
    await app.close();
    const next = await startServer({ dataDir: join(dir, 'data'), webDir, port: 0 });
    cleanup.push(() => next.close());
    const state = await (await fetch(next.url + '/api/state')).json();
    expect(state.companies[0].id).toBe(saved.state.companies[0].id);
    expect(
      (
        await fetch(next.url + '/api/preview', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
      ).status,
    ).toBe(403);
  });
  it('loads static assets with protective headers and refuses unsupported writes', async () => {
    const { app } = await setup();
    const page = await fetch(app.url);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await page.text()).toContain('GitFlash');
    expect((await fetch(app.url, { method: 'PUT' })).status).toBe(405);
  });
});
