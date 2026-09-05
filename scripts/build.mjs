import { build as bundle } from 'esbuild';
import { build as web } from 'vite';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { writeNotices } from './licenses.mjs';
await mkdir('dist', { recursive: true });
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const webOutput = await web();
const serverOutput = await bundle({
  entryPoints: ['src/cli/index.ts'],
  outfile: 'dist/runtime.js',
  bundle: true,
  metafile: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  packages: 'bundle',
  banner: {
    js: "import { createRequire as __gitflashCreateRequire } from 'node:module'; const require = __gitflashCreateRequire(import.meta.url);",
  },
  define: {
    __GITFLASH_VERSION__: JSON.stringify(version),
  },
});
const webInputs = (Array.isArray(webOutput) ? webOutput : [webOutput]).flatMap((r) =>
  r.output.flatMap((o) => (o.type === 'chunk' ? Object.keys(o.modules) : [])),
);
await writeNotices([
  ...webInputs,
  ...Object.keys(serverOutput.metafile.inputs),
  'node_modules/tailwindcss/index.css',
  'node_modules/tw-animate-css/dist/tw-animate.css',
]);
// Check the version before importing node:sqlite so older Node versions get a useful error.
await writeFile(
  'dist/cli.js',
  `#!/usr/bin/env node
const [major, minor] = process.versions.node.split('.').map(Number);
if (process.argv.includes('--version')) {
  console.log(${JSON.stringify(version)});
} else if (!((major === 24 && minor >= 14) || major === 26)) {
  console.error('VCM requires Node.js 24.14+ (24.x) or 26.x. Current runtime: ' + process.version + '. Install a supported Node.js release and retry.');
  process.exitCode = 1;
} else {
  await import('./runtime.js');
}
`,
);
await chmod('dist/cli.js', 0o755);
