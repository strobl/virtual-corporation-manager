import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { DomainError } from '../domain/errors.js';
import { safeArtifactPath, sha256 } from './store.js';

export type Files = Record<string, string>;
export async function materializeInputs(directory: string, files: Files): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const [path, content] of Object.entries(files)) {
    if (!safeArtifactPath(path))
      throw new DomainError('INVALID_ARTIFACT', 'Unsupported workflow input path.');
    await mkdir(dirname(join(directory, path)), { recursive: true, mode: 0o700 });
    await writeFile(join(directory, path), content, { mode: 0o600, flag: 'wx' });
  }
}
/** Capture only files that really exist. Never extract code blocks from model replies. */
export async function captureFiles(directory: string): Promise<Files> {
  const root = await realpath(directory);
  const files: Files = {};
  let total = 0;
  async function walk(relative: string) {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      // Runtime home/temp files are not deliverables. They live in a reserved hidden directory.
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = join(root, path);
      const meta = await lstat(absolute);
      if (meta.isSymbolicLink() || (!meta.isFile() && !meta.isDirectory()))
        throw new DomainError(
          'INVALID_ARTIFACT',
          `Workflow produced an unsupported link or device: ${path}.`,
        );
      if (
        meta.isDirectory() &&
        ((relative === '' && entry.name === '.runtime') || entry.name === '__pycache__')
      )
        continue;
      if (meta.isDirectory()) {
        if (path.split('/').length > 3)
          throw new DomainError(
            'INVALID_ARTIFACT',
            'Workflow output has too many nested directories.',
          );
        await walk(path);
        continue;
      }
      if (!safeArtifactPath(path) || meta.nlink !== 1 || meta.size > 2_000_000)
        throw new DomainError(
          'INVALID_ARTIFACT',
          `Workflow output is unsupported or exceeds 2 MB: ${path}.`,
        );
      const actual = await realpath(absolute);
      if (!actual.startsWith(resolve(root) + sep))
        throw new DomainError('INVALID_ARTIFACT', 'Workflow output leaves its isolated directory.');
      const bytes = await readFile(absolute);
      total += bytes.length;
      if (total > 5_000_000 || Object.keys(files).length >= 100)
        throw new DomainError('INVALID_ARTIFACT', 'Workflow output exceeds 100 files or 5 MB.');
      const content = bytes.toString('utf8');
      if (!Buffer.from(content).equals(bytes) || content.includes('\0'))
        throw new DomainError('INVALID_ARTIFACT', 'Workflow artifacts must be UTF-8 text files.');
      files[path] = content;
    }
  }
  await walk('');
  return files;
}
export function hashes(files: Files): Record<string, string> {
  return Object.fromEntries(Object.entries(files).map(([path, text]) => [path, sha256(text)]));
}
export function assertUnchanged(before: Files, after: Files): void {
  for (const [path, content] of Object.entries(before))
    if (after[path] !== content)
      throw new DomainError(
        'EVIDENCE_CHANGED',
        `The review changed or removed its immutable input ${path}. The job needs owner attention.`,
      );
}
