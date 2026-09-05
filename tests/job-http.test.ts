import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startServer } from '../src/server/index.js';
import type { JobInfo } from '../src/jobs/contracts.js';
import { sha256 } from '../src/jobs/store.js';

const TEST_OWNER = 'Synthetic test owner';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'gitflash-job-http-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const webDir = join(dir, 'web');
  await mkdir(webDir);
  await writeFile(join(webDir, 'index.html'), '<!doctype html><title>Workflow HTTP tests</title>');
  let dispatches = 0;
  const app = await startServer({
    dataDir: join(dir, 'data'),
    webDir,
    port: 0,
    jobs: {
      python: process.execPath,
      check: async () => ({
        status: 'completed',
        exitCode: 0,
        output: 'Synthetic HTTP checker receipt.',
        runtimeVersion: 'test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }),
      execute: async (input) => {
        dispatches++;
        const kind = /, stage (intake|requirements|build|qa|handoff)\./.exec(input.prompt)![1];
        const output: Record<string, string> =
          kind === 'intake'
            ? { 'INTAKE.md': 'Synthetic approved scope.' }
            : kind === 'requirements'
              ? { 'SCOPE.md': 'Synthetic requirements.' }
              : kind === 'build'
                ? {
                    'stock_alert.py': '# HTTP fixture, not production utility acceptance.\n',
                    'test_stock_alert.py': '# Test fixture\n',
                    'expected.json': '[]',
                    'USAGE.md': 'Synthetic usage.',
                  }
                : kind === 'qa'
                  ? {
                      'QA.json': JSON.stringify({
                        status: 'pass',
                        criteria: {
                          'PS-A1': 'PASS',
                          'PS-A2': 'PASS',
                          'PS-A3': 'PASS',
                          'PS-A4': 'PASS',
                          'PS-A5': 'PASS',
                        },
                        summary: 'Synthetic review.',
                      }),
                      'QA.md': 'Synthetic independent evidence.',
                    }
                  : { 'HANDOFF.md': 'Pending explicit owner review.' };
        for (const [path, text] of Object.entries(output))
          await writeFile(join(input.directory, path), text);
        if (kind !== 'qa')
          await writeFile(
            join(input.directory, 'STAGE.json'),
            JSON.stringify({
              status: 'ready',
              summary: 'Synthetic HTTP stage is ready.',
            }),
          );
        const timestamp = new Date().toISOString();
        const sessionId = randomUUID();
        const identity = {
          format: 'gitflash-observed-runtime-session' as const,
          sessionId,
          runtimeVersion: 'test',
          observedAt: timestamp,
        };
        await writeFile(
          join(input.directory, 'WORKFLOW-EXECUTION.json'),
          JSON.stringify(identity, null, 2) + '\n',
          { flag: 'wx' },
        );
        input.onSession?.(identity);
        return {
          status: 'completed',
          sessionId,
          runtimeVersion: 'test',
          output: 'Created fixture files.',
          startedAt: timestamp,
          finishedAt: timestamp,
          exitCode: 0,
          commands: [
            {
              id: randomUUID(),
              command: `'${process.execPath}' -B -m unittest -v`,
              status: 'completed',
              exitCode: 0,
              output: 'Synthetic command receipt.',
              observedAt: timestamp,
            },
          ],
        };
      },
    },
  });
  cleanups.push(() => app.close());
  const { token } = await (await fetch(`${app.url}/api/session`)).json();
  const headers = { 'Content-Type': 'application/json', 'X-GitFlash-Token': token };
  const post = async (path: string, input: unknown) => {
    const response = await fetch(app.url + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return { status: response.status, body: await response.json() };
  };
  const install = async () => {
    const { revision } = await (await fetch(`${app.url}/api/state`)).json();
    const preview = await post('/api/templates/product-studio/preview', { baseRevision: revision });
    expect(preview.status).toBe(200);
    const applied = await post('/api/apply', { previewId: preview.body.id });
    expect(applied.status).toBe(200);
    return String(applied.body.state.companies.at(-1).id);
  };
  const start = (companyId: string, requestId = randomUUID()) =>
    post('/api/jobs', { companyId, workflowId: 'PS-001', acceptanceOwner: TEST_OWNER, requestId });
  const settle = async (id: string): Promise<JobInfo> => {
    await vi.waitFor(() => expect(['running', 'queued']).not.toContain(app.jobs.get(id).status), {
      timeout: 5000,
      interval: 5,
    });
    return app.jobs.get(id);
  };
  return { app, post, install, start, settle, headers, dispatches: () => dispatches };
}

function raw(url: string, path: string, headers: Record<string, string>) {
  return new Promise<number>((resolve, reject) => {
    const address = new URL(url);
    const req = request(
      { hostname: address.hostname, port: address.port, path, headers },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode!));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('workflow HTTP boundary and downloads', () => {
  it('requires a valid named review owner before an authenticated start can consume provider allowance', async () => {
    const f = await setup();
    const companyId = await f.install();
    for (const acceptanceOwner of [undefined, null, 17, '', '  ', 'x', 'x'.repeat(121)]) {
      const response = await f.post('/api/jobs', {
        companyId,
        workflowId: 'PS-001',
        requestId: randomUUID(),
        acceptanceOwner,
      });
      expect(response.status).toBe(400);
    }
    expect(f.app.jobs.list()).toHaveLength(0);
    expect(f.dispatches()).toBe(0);
    const request = {
      companyId,
      workflowId: 'PS-001',
      requestId: randomUUID(),
      acceptanceOwner: ` ${TEST_OWNER} `,
    };
    const started = await f.post('/api/jobs', request);
    expect(started.status).toBe(202);
    expect(started.body.acceptanceOwner).toBe(TEST_OWNER);
    expect((await f.post('/api/jobs', { ...request, acceptanceOwner: TEST_OWNER })).body.id).toBe(
      started.body.id,
    );
    expect(
      (await f.post('/api/jobs', { ...request, acceptanceOwner: 'Another synthetic owner' }))
        .status,
    ).toBe(409);
    expect((await f.settle(started.body.id)).status).toBe('waiting_owner');
    expect(f.dispatches()).toBe(5);
  });

  it('rejects hostile origins/hosts on evidence reads and unauthenticated action writes before dispatch', async () => {
    const f = await setup();
    for (const path of [
      '/api/workflows',
      '/api/jobs',
      '/api/jobs/example',
      '/api/jobs/example/export',
      '/api/jobs/example/deliverables',
      '/api/jobs/example/artifacts/example',
    ]) {
      for (const headers of [
        { Host: 'attacker.example' },
        { Origin: 'https://attacker.example' },
        { 'Sec-Fetch-Site': 'cross-site' },
      ] as Record<string, string>[]) {
        expect(await raw(f.app.url, path, headers)).toBe(403);
      }
    }
    for (const path of [
      '/api/jobs',
      '/api/jobs/example/retry',
      '/api/jobs/example/cancel',
      '/api/jobs/example/review',
    ]) {
      const response = await fetch(f.app.url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(response.status).toBe(403);
    }
    const hostile = await fetch(f.app.url + '/api/jobs', {
      method: 'POST',
      headers: { ...f.headers, Origin: 'https://attacker.example' },
      body: '{}',
    });
    expect(hostile.status).toBe(403);
    const badType = await fetch(f.app.url + '/api/jobs', {
      method: 'POST',
      headers: { ...f.headers, 'Content-Type': 'text/plain' },
      body: '{}',
    });
    expect(badType.status).toBe(415);
    expect(f.app.jobs.list()).toHaveLength(0);
    expect(f.dispatches()).toBe(0);
  });

  it('installs the five-role workflow from the native template, deduplicates starts and gates owner review', async () => {
    const f = await setup();
    const companyId = await f.install();
    const requestId = randomUUID();
    const started = await f.start(companyId, requestId);
    expect(started.status).toBe(202);
    expect((await f.start(companyId, requestId)).body.id).toBe(started.body.id);
    const conflict = await f.start('different-company', requestId);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('REQUEST_CONFLICT');
    const job = await f.settle(started.body.id);
    expect(job.status).toBe('waiting_owner');
    expect(job.stages).toHaveLength(5);
    expect(f.dispatches()).toBe(5);
    const review = await f.post(`/api/jobs/${job.id}/review`, {
      decision: 'accepted',
      note: 'HTTP fixture files inspected.',
    });
    expect(review.status).toBe(200);
    expect(review.body.status).toBe('accepted');
    expect(
      (
        await f.post(`/api/jobs/${job.id}/review`, {
          decision: 'rejected',
          note: 'Conflicting later decision.',
        })
      ).status,
    ).toBe(409);
    expect((await (await fetch(`${f.app.url}/api/time`)).json()).entries).toEqual([]);
  });

  it('serves exact hashed file downloads, a portable bundle, and complete provenance as attachments', async () => {
    const f = await setup();
    const companyId = await f.install();
    const job = await f.settle((await f.start(companyId)).body.id);
    const artifact = job.stages
      .find((s) => s.kind === 'build')!
      .artifacts.find((a) => a.path === 'stock_alert.py')!;
    const response = await fetch(`${f.app.url}/api/jobs/${job.id}/artifacts/${artifact.id}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="stock_alert.py"',
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-content-sha256')).toBe(artifact.sha256);
    expect(sha256(await response.text())).toBe(artifact.sha256);
    const exported = await fetch(`${f.app.url}/api/jobs/${job.id}/export`);
    expect(exported.headers.get('content-disposition')).toContain('attachment;');
    const body = await exported.json();
    expect(body.job).toEqual(job);
    expect(body.artifacts.find((a: { id: string }) => a.id === artifact.id).sha256).toBe(
      artifact.sha256,
    );
    const bundled = await fetch(`${f.app.url}/api/jobs/${job.id}/deliverables`);
    expect(bundled.status).toBe(200);
    expect(bundled.headers.get('content-type')).toBe('application/zip');
    expect(bundled.headers.get('content-disposition')).toContain('attachment;');
    const zip = Buffer.from(await bundled.arrayBuffer());
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    for (const filename of [
      'stock_alert.py',
      'test_stock_alert.py',
      'expected.json',
      'USAGE.md',
      'QA.json',
      'QA.md',
      'HANDOFF.md',
      'oracle-result.json',
      'PROVENANCE.json',
    ])
      expect(zip.includes(Buffer.from(filename))).toBe(true);
    const second = await f.settle((await f.start(companyId)).body.id);
    expect(
      (await fetch(`${f.app.url}/api/jobs/${second.id}/artifacts/${artifact.id}`)).status,
    ).toBe(404);
  });
});
