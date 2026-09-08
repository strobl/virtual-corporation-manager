// Usage: node brand/source/render.cjs
// Set VCM_PLAYWRIGHT_MODULE to a Playwright installation when it is not on NODE_PATH.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.VCM_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  const results = [];
  for (const asset of manifest.assets) {
    await page.setViewportSize({ width: asset.width, height: asset.height });
    const source = fs.readFileSync(path.join(root, asset.svg), 'utf8');
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}svg{display:block}</style>${source}`,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (img) => img.decode()));
    });
    const clipped = await page.locator('text').evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          text: node.textContent,
          bounds: node.getBoundingClientRect().toJSON(),
        }))
        .filter(
          ({ bounds: b }) =>
            b.x < 0 || b.y < 0 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1,
        ),
    );
    await page.screenshot({ path: path.join(root, asset.png) });
    const bytes = fs.statSync(path.join(root, asset.png)).size;
    results.push({ id: asset.id, width: asset.width, height: asset.height, bytes, clipped });
  }
  fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'evidence', 'render.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => r.clipped.length)) process.exitCode = 1;
  if (results.find((r) => r.id === 'github-social-preview').bytes >= 1000000)
    throw Error('GitHub preview must be under 1 MB');
  if (results.find((r) => r.id === 'x-avatar').bytes >= 2000000)
    throw Error('X avatar must be under 2 MB');
})();
