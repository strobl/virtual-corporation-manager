import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { format } from 'prettier';

const [source, expectedManifestHash] = process.argv.slice(2);
if (!source || !/^[a-f0-9]{64}$/.test(expectedManifestHash ?? ''))
  throw new Error(
    'Usage: node scripts/import-ops-content.mjs <reviewed launch-finish directory> <manifest SHA256>',
  );
const root = resolve(source);
const digest = (b) => createHash('sha256').update(b).digest('hex');
const manifestBytes = await readFile(join(root, 'product-studio.integration.json'));
if (digest(manifestBytes) !== expectedManifestHash)
  throw new Error('Integration manifest does not match the approved hash.');
const manifest = JSON.parse(manifestBytes);
for (const item of [...manifest.files, manifest.packageManifest, manifest.contentReview]) {
  const bytes = await readFile(join(root, item.source));
  if (digest(bytes) !== item.sha256 || (item.bytes !== undefined && bytes.length !== item.bytes))
    throw new Error('Content hash mismatch: ' + item.source);
}
const read = async (p) => (await readFile(join(root, p))).toString('utf8');
const base = 'package/';
const job = JSON.parse(await read(base + 'install/product-studio/job.json'));
const roles = JSON.parse(await read(base + 'roles/index.json')).roles;
const stages = Object.fromEntries(
  job.stages.map((stage) => [
    stage.id,
    { title: roles.find((r) => r.id === stage.role).name, role: stage.role, prompt: stage.prompt },
  ]),
);
const names = {
  'ao.role.delivery-manager': 'PS-DM · Delivery Manager',
  'ao.role.requirements-analyst': 'PS-REQ · Requirements Analyst',
  'ao.role.software-builder': 'PS-BUILD · Software Builder',
  'ao.role.quality-reviewer': 'PS-QA · Quality Reviewer',
  'ao.role.handoff-editor': 'PS-DOC · Handoff Editor',
};
const rolePrompts = Object.fromEntries(
  roles
    .filter((role) => Object.values(stages).some((s) => s.role === role.id))
    .map((role) => {
      if (role.prompt.length > 20_000)
        throw new Error('Full prompt exceeds the supported agent instruction size.');
      return [
        role.id,
        {
          name: names[role.id],
          instructions: role.prompt,
          responsibilities: [
            'Perform this role within the shipped PS-001 brief and operating contract.',
            'Preserve exact candidate evidence and keep owner acceptance explicit.',
          ],
        },
      ];
    }),
);
const files = {};
for (const path of Object.values(job.files))
  files[path] = await read(base + 'install/product-studio/' + path);
files['COMPANY.md'] = await read(base + 'companies/product-studio/company.md');
files['WORKFLOWS.md'] = await read(base + 'companies/product-studio/workflows.md');
const managerFiles = {};
for (const path of manifest.managerInputs) managerFiles[path] = await read(base + path);
const content = {
  managerFiles,
  version: job.packageVersion,
  sha256: expectedManifestHash,
  rolePrompts,
  stages,
  files,
  oracle: await read('acceptance/ps001-oracle.py'),
  operatingContract: await read(base + 'operating-contract.md'),
  help: await read('help/FIRST-COMPANY.md'),
};
if (digest(content.oracle) !== '2d7bdda0280b92f3a499aa405bd19ac1871309ee9fb0076e4762725612af527b')
  throw new Error('Independent oracle differs from its approved frozen version.');
await writeFile('src/jobs/content.generated.json', JSON.stringify(content, null, 2) + '\n');
const selected = [
  'operating-contract.md',
  'roles/index.json',
  ...roles.map((r) => r.path),
  'companies/product-studio/company.md',
  'companies/product-studio/workflows.md',
  'install/product-studio/job.json',
  ...Object.values(job.files).map((p) => 'install/product-studio/' + p),
];
for (const path of selected) {
  const target = join('docs/agent-operations', path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, base, path), target);
}
await mkdir('docs/agent-operations/acceptance', { recursive: true });
await copyFile(
  join(root, 'acceptance/ps001-oracle.py'),
  'docs/agent-operations/acceptance/ps001-oracle.py',
);
await copyFile(
  join(root, 'product-studio.integration.json'),
  'docs/agent-operations/product-studio.integration.json',
);
for (const item of manifest.files) {
  const target = join('docs/agent-operations', item.destination);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, item.source), target);
}
const helpAliases = [];
// Canonical source bytes stay under agent-operations. User-facing aliases adapt
// links and the observed local UI; the receipt distinguishes both versions.
for (const name of ['FIRST-COMPANY.md', 'SUPPORT.md', 'TRIAGE.md']) {
  const path = manifest.files.find((f) => f.destination === 'help/' + name).source;
  const sourceText = await read(path);
  let text = sourceText
    .replaceAll('(SUPPORT.md)', '(support.md)')
    .replaceAll('(TRIAGE.md)', '(triage.md)')
    .replaceAll('(FIRST-COMPANY.md)', '(first-company.md)')
    .replaceAll('(REHEARSAL-RECORD.md)', '(agent-operations/help/REHEARSAL-RECORD.md)');
  const note =
    'Before starting, fill **Acceptance owner** with the person or responsible role who will review the result. No account or legal name is required. Expand **Review the brief, criteria and sample data** to read the exact source materials. The named owner and start authority are captured with the job; final acceptance remains a separate decision.\n\n';
  if (name === 'FIRST-COMPANY.md')
    text = text.replace('The installed job supplies', note + 'The installed job supplies');
  else text = text.replace(/\n\n/, '\n\n' + note);
  text = await format(text, { parser: 'markdown', printWidth: 100 });
  const destination = 'docs/' + name.toLowerCase();
  await writeFile(destination, text);
  helpAliases.push({
    source: path,
    sourceSha256: digest(sourceText),
    destination,
    destinationSha256: digest(text),
    adaptation:
      'Local links, explicit acceptance owner and full pre-start brief viewer; no role, rubric or oracle changes.',
  });
}
await writeFile(
  'docs/agent-operations/import-receipt.json',
  JSON.stringify(
    {
      contentVersion: content.version,
      manifestSha256: expectedManifestHash,
      oracleSha256: digest(content.oracle),
      roleIds: Object.keys(rolePrompts),
      fullRolePromptLengths: Object.fromEntries(
        Object.entries(rolePrompts).map(([id, r]) => [id, r.instructions.length]),
      ),
      sourceFiles: selected,
      helpAliases,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Imported complete reviewed Product Studio content ' +
    content.version +
    '; manifest ' +
    expectedManifestHash,
);
