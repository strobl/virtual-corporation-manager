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
