import { execFileSync } from 'node:child_process';
import { readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run with npm run pack:release so the npm executable is explicit.');
const output = execFileSync(process.execPath, [npm, 'pack', '--json', '--pack-destination', root], {
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
      note: 'Publish this tested archive as virtualcorporationmanager; vcm uses the existing workspace.',
    },
    null,
    2,
  ),
);
