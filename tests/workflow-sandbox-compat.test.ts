import { randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { executeProcess, findExecutable, runtimeEnvironment } from '../src/adapters/process.js';
import {
  executeWorkflowCheck,
  workflowCheckFilesystem,
  type WorkflowCheckResult,
} from '../src/adapters/workflow-check.js';
import { productStudioTemplate } from '../src/company/product-studio.js';
import { createWorkspaceStore } from '../src/db/store.js';
import { createJobService } from '../src/jobs/service.js';

// This explicit compatibility probe expects refusal on the stock Ubuntu 24.04
// runner. A green result does not claim that Python or a Company job executed.
// If host policy changes, this test fails and requires a new compatibility review.
it.runIf(process.env.GITFLASH_UBUNTU24_REFUSAL === '1')(
  'records the expected Ubuntu 24.04 namespace refusal and dispatches no provider stage',
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gitflash-ubuntu24-refusal-'));
    const evidence: Record<string, unknown> = {
      format: 'gitflash-ubuntu24-expected-sandbox-refusal',
      version: 1,
      recordedAt: new Date().toISOString(),
      outcome: 'unverified',
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      noHostPolicyChanges: true,
    };
    const store = createWorkspaceStore(join(directory, 'workspace'));
    let service: ReturnType<typeof createJobService> | undefined;
    try {
      expect(process.platform).toBe('linux');
      const osRelease = await readFile('/etc/os-release', 'utf8');
      expect(osRelease).toMatch(/^ID=ubuntu$/m);
      expect(osRelease).toMatch(/^VERSION_ID="24\.04"$/m);
      const policy = Object.fromEntries(
        await Promise.all(
          [
            'kernel/unprivileged_userns_clone',
            'kernel/apparmor_restrict_unprivileged_userns',
            'user/max_user_namespaces',
          ].map(async (key) => [key, (await readFile(`/proc/sys/${key}`, 'utf8')).trim()]),
        ),
      );
      evidence.hostPolicy = policy;
      expect(policy['kernel/unprivileged_userns_clone']).toBe('1');
      expect(policy['kernel/apparmor_restrict_unprivileged_userns']).toBe('1');
      expect(Number(policy['user/max_user_namespaces'])).toBeGreaterThan(0);

      const state = store.apply(
        store.preview(
          [{ type: 'definition.import', definition: productStudioTemplate() }],
          store.snapshot().revision,
        ).id,
      ).state;
      const companyId = state.companies[0]!.id;
      store.time.mutate(
        {
          type: 'entry.create',
          requestId: randomUUID(),
          input: {
            companyId,
            agentId: state.agents[0]!.id,
            date: '2020-01-02',
            hours: 0.3,
            description: 'Synthetic pre-existing compatibility-test entry.',
          },
        },
        'manual',
      );
      const beforeCompany = store.snapshot();
      const beforeTime = store.time.snapshot();
      let providerDispatches = 0;
      const checks: WorkflowCheckResult[] = [];
      service = createJobService(store, join(directory, 'workspace'), {
        env: process.env,
        execute: async () => {
          providerDispatches++;
          throw new Error('The compatibility probe must never dispatch a provider stage.');
        },
        check: async (input, environment) => {
          const result = await executeWorkflowCheck(input, environment, { timeoutMs: 15_000 });
          checks.push(result);
          return result;
        },
      });
      const jobId = service.start({
        companyId,
        workflowId: 'PS-001',
        acceptanceOwner: 'Synthetic compatibility-test owner',
        requestId: randomUUID(),
      }).id;
      const jobs = service;
      await vi.waitFor(() => expect(['queued', 'running']).not.toContain(jobs.get(jobId).status), {
        timeout: 25_000,
        interval: 50,
      });
      const job = jobs.get(jobId);
      evidence.providerDispatches = providerDispatches;
      evidence.preflight = checks;
      evidence.job = { status: job.status, error: job.error, stages: job.stages.length };
      expect(providerDispatches).toBe(0);
      expect(checks).toHaveLength(1);
      expect(checks[0]).toMatchObject({
        status: 'failed',
        exitCode: null,
        output: '',
        runtimeVersion: 'codex-cli 0.138.0',
        error: { code: 'check-not-run' },
      });
      expect(checks[0]!.error!.message).toContain('sandbox denied a runtime startup operation');
      expect(job.status).toBe('failed');
      expect(job.error).toContain('sandbox denied a runtime startup operation');
      expect(job.stages).toHaveLength(0);
      expect(job.ownerReview).toBeNull();
      expect(jobs.export(jobId).artifacts).toEqual([]);
      expect(await readdir(join(directory, 'workspace', 'workflow-runs', jobId))).toEqual([]);
      expect(store.snapshot()).toEqual(beforeCompany);
      expect(store.time.snapshot()).toEqual(beforeTime);
      evidence.companyUnchanged = true;
      evidence.timeUnchanged = true;
      evidence.artifacts = 0;

      // Preserve the actual native startup error with the same filesystem policy.
      // The fixed command leaves a marker only if Python really starts.
      const executable = findExecutable('codex', process.env);
      expect(executable).toBeTruthy();
      const command = await realpath(process.env.GITFLASH_PYTHON_PATH || '/usr/bin/python3');
      const stage = join(directory, 'diagnostic');
      const home = join(directory, 'empty-auth');
      await mkdir(stage);
      await mkdir(home, { mode: 0o700 });
      const filesystem = await workflowCheckFilesystem(command, executable!);
      const permissions = `{${Object.entries(filesystem)
        .map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`)
        .join(',')}}`;
      const diagnostic = await executeProcess(
        executable!,
        [
          'sandbox',
          '--permissions-profile',
          'gitflash-check',
          '--include-managed-config',
          '--cd',
          stage,
          '-c',
          `permissions.gitflash-check={filesystem=${permissions},network={enabled=false}}`,
          '--',
          command,
          '-I',
          '-B',
          '-c',
          "import pathlib;pathlib.Path('python-started.txt').write_text('unexpected startup');print('PYTHON_STARTED')",
        ],
        {
          cwd: stage,
          env: {
            ...runtimeEnvironment(process.env),
            HOME: home,
            USERPROFILE: home,
            CODEX_HOME: home,
            TMPDIR: stage,
            TMP: stage,
            TEMP: stage,
          },
          timeoutMs: 10_000,
          maxBytes: 16_000,
        },
      );
      evidence.nativeDiagnostic = {
        exitCode: diagnostic.code,
        stdout: diagnostic.stdout.split(directory).join('<isolated-test>').slice(0, 4000),
        stderr: diagnostic.stderr.split(directory).join('<isolated-test>').slice(0, 4000),
      };
      expect(diagnostic.code).toBe(1);
      expect(diagnostic.stdout).toBe('');
      expect(diagnostic.stderr).toContain(
        'bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted',
      );
      await expect(access(join(stage, 'python-started.txt'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(await readdir(stage)).toEqual([]);
      evidence.pythonStarted = false;
      evidence.outcome = 'expected_prerequisite_refusal';
    } finally {
      await service?.close();
      store.close();
      await rm(directory, { recursive: true, force: true });
      console.info(JSON.stringify(evidence));
      if (process.env.GITFLASH_EVIDENCE_DIR) {
        const destination = resolve(process.env.GITFLASH_EVIDENCE_DIR);
        await mkdir(destination, { recursive: true });
        await writeFile(
          join(destination, 'ubuntu24-expected-sandbox-refusal.json'),
          JSON.stringify(evidence, null, 2) + '\n',
        );
      }
    }
  },
  45_000,
);
