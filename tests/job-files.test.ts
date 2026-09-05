import { mkdtempSync, rmSync } from 'node:fs';
import { link, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertUnchanged, captureFiles, materializeInputs } from '../src/jobs/files.js';

const directories: string[] = [];
function directory() {
  const path = mkdtempSync(join(tmpdir(), 'gitflash-job-files-'));
  directories.push(path);
  return path;
}
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('workflow artifact boundary', () => {
  it('excludes only reserved temporary directories and refuses hidden output or redirected runtime roots', async () => {
    const path = directory();
    await mkdir(join(path, '.runtime/tmp'), { recursive: true });
    await writeFile(join(path, '.runtime/tmp/xcrun_db'), 'cache');
    await writeFile(join(path, 'output.md'), 'reviewable');
    expect(await captureFiles(path)).toEqual({ 'output.md': 'reviewable' });
    await writeFile(join(path, '.private.md'), 'unexpected');
    await expect(captureFiles(path)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
    const linked = directory();
    await symlink(
      path,
      join(linked, '.runtime'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(captureFiles(linked)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
  });

  it('captures existing UTF-8 files exactly and never invents outputs from prose', async () => {
    const path = directory();
    await materializeInputs(path, { 'input.json': '[]', 'notes/README.md': 'Unicode: ÄÖÜ\n' });
    expect(await captureFiles(path)).toEqual({
      'input.json': '[]',
      'notes/README.md': 'Unicode: ÄÖÜ\n',
    });
  });

  it.each([
    '../outside.md',
    '/absolute.md',
    'C:\\outside.md',
    'nested/../../outside.md',
    'x//note.md',
    'binary.exe',
  ])('rejects unsupported input path %s', async (name) => {
    await expect(
      materializeInputs(directory(), { [name]: 'Must stay inside' }),
    ).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
  });

  it('does not overwrite previously materialized immutable input', async () => {
    const path = directory();
    await materializeInputs(path, { 'input.json': 'original' });
    await expect(materializeInputs(path, { 'input.json': 'changed' })).rejects.toBeDefined();
    expect(await readFile(join(path, 'input.json'), 'utf8')).toBe('original');
  });

  it('rejects symlink outputs without reading their target', async () => {
    const inside = directory();
    const outside = directory();
    await writeFile(join(outside, 'secret.md'), 'Do not capture');
    // Windows junctions exercise the same lstat boundary without requiring
    // Developer Mode or administrator permission for a file symlink.
    if (process.platform === 'win32') await symlink(outside, join(inside, 'escape'), 'junction');
    else await symlink(join(outside, 'secret.md'), join(inside, 'result.md'));
    await expect(captureFiles(inside)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
  });

  it('rejects hard-linked files even when their apparent path stays inside', async () => {
    const inside = directory();
    const outside = directory();
    await writeFile(join(outside, 'secret.md'), 'Do not capture');
    await link(join(outside, 'secret.md'), join(inside, 'result.md'));
    await expect(captureFiles(inside)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
  });

  it.each([Buffer.from([0xff, 0xfe]), Buffer.from('text\0binary')])(
    'rejects binary or malformed UTF-8 artifact bytes',
    async (bytes) => {
      const path = directory();
      await writeFile(join(path, 'result.md'), bytes);
      await expect(captureFiles(path)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
    },
  );

  it('rejects output above per-file, total-size and file-count limits', async () => {
    const single = directory();
    await writeFile(join(single, 'large.txt'), 'x'.repeat(2_000_001));
    await expect(captureFiles(single)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
    const total = directory();
    for (let n = 0; n < 3; n++)
      await writeFile(join(total, `large-${n}.txt`), 'x'.repeat(1_700_000));
    await expect(captureFiles(total)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
    const count = directory();
    await Promise.all(
      Array.from({ length: 101 }, (_, n) => writeFile(join(count, `file-${n}.txt`), 'x')),
    );
    await expect(captureFiles(count)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
  });

  it('rejects unsupported extensions and deeply nested output', async () => {
    const extension = directory();
    await writeFile(join(extension, 'archive.zip'), 'not a permitted artifact');
    await expect(captureFiles(extension)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
    const depth = directory();
    await mkdir(join(depth, 'one/two/three/four'), { recursive: true });
    await writeFile(join(depth, 'one/two/three/four/output.md'), 'too deep');
    await expect(captureFiles(depth)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
  });

  it('distinguishes adding a reviewer artifact from changing or deleting source evidence', () => {
    expect(() =>
      assertUnchanged({ 'source.md': 'original' }, { 'source.md': 'original', 'QA.md': 'review' }),
    ).not.toThrow();
    expect(() =>
      assertUnchanged({ 'source.md': 'original' }, { 'source.md': 'changed' }),
    ).toThrow();
    expect(() => assertUnchanged({ 'source.md': 'original' }, { 'QA.md': 'review' })).toThrow();
  });
});
