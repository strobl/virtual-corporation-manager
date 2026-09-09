/** Display adaptation of imported Ops content; compatibility identifiers stay intact. */
export function brandOpsText(text, releaseVersion) {
  let branded = text
    .replace(/\bGitFlash\b(?! task | result | role ID| fixed independent oracle|-Token)/g, 'VCM')
    .replace(
      /https:\/\/github\.com\/strobl\/gitflash(?=\/|[?#]|$)/g,
      'https://github.com/strobl/virtual-corporation-manager',
    )
    .replaceAll('./gitflash-preview', './vcm-preview')
    .replaceAll('./gitflash-first-company', './vcm-first-company')
    .replaceAll(
      'node ./vcm-preview/node_modules/gitflash/dist/cli.js',
      'npm exec --offline --prefix ./vcm-preview -- vcm',
    )
    .replace(/`gitflash(?= (?:--|doctor|export|backup|restore|start|time-export))/g, '`vcm');
  branded = branded.replace(
    /This guide accompanies candidate \*\*[0-9A-Za-z.+-]+\*\*\.[\s\S]*?(?=Company setup needs no VCM account\.)/,
    'Use Node.js **24.14 or newer in the 24.x line, or 26.x**. Launch VCM with:\n\n```sh\nnpx virtualcorporationmanager --data-dir ./vcm-first-company --no-open\n```\n\nUse a new data directory for this exercise and open the local URL printed in the terminal. Add `--port 4311` if the default port is occupied. Keep the process running while the job works. For permanent installation, run `npm install -g virtualcorporationmanager`, then use `vcm` with the same options. This is a technical alpha; the local core and optional execution have separate acceptance records.\n\n',
  );
  const guideVersion = branded.match(
    /This guide accompanies candidate \*\*([0-9A-Za-z.+-]+)\*\*/,
  )?.[1];
  if (guideVersion) branded = branded.replaceAll(guideVersion, releaseVersion);
  return branded;
}

export function brandOpsContent(content, releaseVersion) {
  const adapt = (value, key = '') => {
    // These are the original imported identity and frozen verification program.
    if (['oracle', 'version', 'sha256'].includes(key)) return value;
    if (typeof value === 'string') return brandOpsText(value, releaseVersion);
    if (Array.isArray(value)) return value.map((item) => adapt(item));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([name, item]) => [name, adapt(item, name)]),
      );
    return value;
  };
  return adapt(content);
}
