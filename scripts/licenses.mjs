import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';

/** Inventory the modules actually emitted by the web and server bundlers. */
export async function writeNotices(inputs) {
  const packages = new Map();
  for (const input of inputs) {
    if (!input.includes('node_modules/')) continue;
    const full = resolve(input.replace(/^\0/, '').split('?')[0]).replaceAll('\\', '/');
    const marker = '/node_modules/';
    const boundary = full.lastIndexOf(marker) + marker.length;
    const segments = full.slice(boundary).split('/');
    const dir =
      full.slice(0, boundary) + segments.slice(0, segments[0].startsWith('@') ? 2 : 1).join('/');
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    packages.set(dir, pkg);
  }
  let text =
    "# Third-party notices\n\nGenerated from the JavaScript modules included in the release bundles. GitFlash application code is MIT licensed; each dependency retains its own license. Build tools that are not distributed are excluded from this inventory.\n\nThe organization tree, inspector primitives, layout helpers and ownership traversal were selectively adapted from the project owner's existing prototype. Private repository history, live records and hosted infrastructure were not imported. Adapted shadcn/ui component patterns retain the following upstream notice.\n\n## shadcn/ui\n\nSource: https://github.com/shadcn-ui/ui\n\n```text\n" +
    (await readFile('licenses/shadcn-ui.txt', 'utf8')).trim() +
    '\n```\n';
  text +=
    '\n## GitFlash corporation wordmark\n\nThe bundled lettering outlines derive from Rubik Bold 1.100. The original font is not bundled. Its copyright and SIL Open Font License 1.1 are retained below. The corporation silhouette is an original GitFlash asset.\n\n```text\n' +
    (await readFile('licenses/Rubik-OFL-1.1.txt', 'utf8')).trim() +
    '\n```\n';
  text +=
    "\n## Delivery-hours catalog\n\nThe bundled generic shared deliverable definitions were selectively restored from the project owner's original Virtual Corporation Manager catalog. Only shared codes, names, categories and reference hours were imported; no private overrides, time entries, client projects, customer data or private repository history were imported. Reference hours describe human-equivalent effort, not runtime or verified work.\n";
  for (const [dir, pkg] of [...packages].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    const names = (await readdir(dir)).filter((n) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(n));
    if (!names.length) throw new Error(`Missing distributed license text: ${pkg.name} (${dir})`);
    text += `\n## ${pkg.name} ${pkg.version}\n\nDeclared license: ${pkg.license ?? 'See license text'}. Source package: https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}\n`;
    for (const name of names)
      text += `\n### ${name}\n\n\`\`\`text\n${(await readFile(join(dir, name), 'utf8')).trim()}\n\`\`\`\n`;
  }
  await writeFile('THIRD_PARTY_NOTICES.md', text);
  console.log(
    `Retained complete license notices for ${packages.size} bundled dependency packages.`,
  );
}
