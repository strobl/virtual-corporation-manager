// Render and check the locally generated campaign. No browser session or remote app is used.
// VCM_PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.VCM_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    const results = [];
    for (const asset of manifest.assets) {
      if (asset.masterType === 'raster') {
        const bytes = fs.readFileSync(path.join(root, asset.png));
        if (
          bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
          bytes.readUInt32BE(16) !== asset.width ||
          bytes.readUInt32BE(20) !== asset.height
        )
          throw new Error(`Unexpected PNG dimensions: ${asset.id}`);
        results.push({
          id: asset.id,
          width: asset.width,
          height: asset.height,
          bytes: bytes.length,
          clipped: [],
          textBounds: 'raster master; visual review required',
        });
        continue;
      }
      await page.setViewportSize({ width: asset.width, height: asset.height });
      await page.setContent(
        '<!doctype html><meta charset="utf-8"><style>html,body{margin:0}svg{display:block}</style>' +
          fs.readFileSync(path.join(root, asset.svg), 'utf8'),
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.querySelectorAll('svg image'), async (node) => {
            const image = new Image();
            image.src = node.getAttribute('href');
            await image.decode();
          }),
        );
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
      results.push({
        id: asset.id,
        width: asset.width,
        height: asset.height,
        bytes: fs.statSync(path.join(root, asset.png)).size,
        clipped,
      });
    }
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    fs.copyFileSync(
      path.join(root, manifest.assets.find((asset) => asset.id === manifest.primaryAsset).png),
      path.join(root, '../../docs/images/vcm-integrations.png'),
    );
    const gallery = [];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(pathToFileURL(path.join(root, 'gallery.html')).href);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images, async (image) => {
            image.loading = 'eager';
            await image.decode();
          }),
        );
      });
      const check = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        missingImages: Array.from(document.images).filter(
          (image) => !image.complete || !image.naturalWidth,
        ).length,
        posts: document.querySelectorAll('.post').length,
      }));
      gallery.push({ width, ...check });
      await page.screenshot({
        path: path.join(root, `evidence/gallery-${width}.png`),
        fullPage: true,
      });
    }
    const queue = JSON.parse(fs.readFileSync(path.join(root, 'posts.json')));
    const report = {
      assets: results,
      gallery,
      drafts: queue.posts.map((p) => ({
        id: p.id,
        channel: p.channel,
        weightedCharacters: p.weightedCharacters,
      })),
      livePlatformExecution: 'not tested',
      publication: 'drafts only',
    };
    fs.writeFileSync(
      path.join(root, 'evidence/render.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify(report, null, 2));
    if (
      results.some((r) => r.clipped.length) ||
      gallery.some((g) => g.overflow || g.missingImages || g.posts !== 6)
    )
      process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
