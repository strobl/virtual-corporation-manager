import { execFileSync } from 'node:child_process';
import { readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const output = execFileSync(npm, ['pack', '--json', '--pack-destination', root], {
  cwd: root,
  encoding: 'utf8',
});
const packed = JSON.parse(output)[0];
const sourcePath = join(root, packed.filename);
const filename = `vcm-${manifest.version}.tgz`;
const targetPath = join(root, filename);
if (sourcePath !== targetPath) await rename(sourcePath, targetPath);
console.log(
  JSON.stringify(
    {
      filename,
      packageName: manifest.name,
      version: manifest.version,
      files: packed.files,
      bytes: packed.size,
      note: 'The archive filename is VCM-facing; the package manifest remains gitflash for compatibility.',
    },
    null,
    2,
  ),
);
