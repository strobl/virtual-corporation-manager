"""Build an offline, portable review gallery and Markdown catalog from the source queue."""
from pathlib import Path
import html
import json
import re

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root/'manifest.json').read_text())
queue = json.loads((root/'content/posts.json').read_text())
assets = {asset['id']: asset for asset in manifest['assets']}
posts = [dict(queue['pinnedPost'],id='PINNED',slot='Profile introduction',series='Solo. Never small.')] + queue['posts']
bio = 'Big ideas deserve a team. Open-source workspace for your virtual corporation. Humans + AI agents. Local MIT core. Build what comes next.'
checks = []
for post in posts:
    # Text is Latin/English; em dashes are weight 1 under X's documented ranges.
    length = len(re.sub(r'https://\S+', 'x'*23, post['text']))
    assert length <= 280, (post['id'], length)
    assert post['asset'] in assets
    post['alt'] = assets[post['asset']]['alt']
    post['weightedCharacters'] = length
    checks.append({'id':post['id'],'weightedCharacters':length,'assetExists':(root/assets[post['asset']]['png']).exists()})
assert len(bio) <= 160
queue['pinnedPost'].update(alt=posts[0]['alt'],weightedCharacters=posts[0]['weightedCharacters'])
for p, enriched in zip(queue['posts'], posts[1:]):
    p.update(alt=enriched['alt'],weightedCharacters=enriched['weightedCharacters'])
(root/'content/posts.json').write_text(json.dumps(queue,indent=2,ensure_ascii=False)+'\n')
(root/'evidence/content-check.json').write_text(json.dumps({'bioCharacters':len(bio),'posts':checks},indent=2)+'\n')

md = '# VCM launch posts\n\nTwelve X drafts over four weeks, plus a pinned introduction. Dates are relative slots, not confirmed schedules. Each image is in the [asset catalog](../README.md).\n\n'
for p in posts:
    a=assets[p['asset']]
    md+=f"## {p['id']} — {p['slot']}\n\n{p['series']} · Draft · {p['weightedCharacters']} weighted characters\n\n![{p['alt']}](../{a['png']})\n\n" + p['text'] + '\n\n**Alt text:** '+p['alt']+'\n\n'
(root/'content/LAUNCH-POSTS.md').write_text(md)

readme='''# VCM brand kit

**Big ideas deserve a team.**

The adopted VCM identity, ready for GitHub and social: original VCM wordmark, warm cream, orange, Rubik Bold and the V-shaped companion. The source mascot name is Vic. The product is always **Virtual Corporation Manager**.

![VCM campaign](exports/09-team-sculpture.png)

## Use it

- [VCM on X: @virtualcorpman](https://x.com/virtualcorpman)
- [X profile fields and upload files](content/X-PROFILE.md)
- [Twelve launch posts and pinned introduction](content/LAUNCH-POSTS.md)
- [Structured draft queue with alt text](content/posts.json)
- [Three-series content rhythm and Pressmaster handoff](content/CONTENT-ENGINE.md)
- [Brand brief](content/BRAND-BRIEF.md)
- [Offline gallery](gallery.html) — download the kit and open this HTML file locally.

Public values: **Play 2 win · Be adaptable · Never stop hacking · Hackers first · Be open.**

## Assets

Use PNG for publishing. SVGs retain editable text and embedded Rubik Bold; logos are original vector paths. All alt text and dimensions are also in [manifest.json](manifest.json).

| Asset | Size | PNG | Editable SVG |
| --- | --- | --- | --- |
'''
for a in assets.values():
    readme+=f"| {a['purpose']} | {a['width']} × {a['height']} | [PNG]({a['png']}) | [SVG]({a['svg']}) |\n"
readme+='''
## Source and production

The wordmark geometry, palette, Rubik font and V-shaped companion come from the adopted 6 September 2026 brand system. The team-sculpture illustration was generated on 8 September with the original character master as its reference. The illustration is a campaign asset, not a product screenshot, customer result or execution record. Original identity SVGs and the font's SIL OFL 1.1 notice are preserved in `assets/`.

Run `python3 brand/source/build.py`, then `node brand/source/render.cjs` with Playwright and Chrome available. Set `VCM_PLAYWRIGHT_MODULE` to your installed Playwright module if needed. Run `python3 brand/source/catalog.py` last to rebuild the gallery and catalog. These helpers do not change the application or publish to any platform.

The renderer verifies text bounds and output sizes. Visually review modified art at mobile size before publishing. Org-chart connections must describe the intended relationship: membership, reporting or ownership. Use the real product screenshot in the repository README when showing actual UI.

GitHub's [official social-preview guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview) specifies 1280 × 640 for best display and a file under 1 MB. The supplied preview is opaque PNG. X dimensions and profile rules are linked in the profile brief. Specifications checked on 8 September 2026.

The repository's license and the included third-party notices remain applicable. This kit makes no exclusive trademark or audience-performance claim.
'''
(root/'README.md').write_text(readme)

cards=''
for p in posts:
    a=assets[p['asset']]
    cards+=f'''<article class="post" data-series="{html.escape(p['series'],quote=True)}"><div class="posthead"><span>{html.escape(p['slot'])}</span><span>{html.escape(p['series'])}</span></div><img loading="lazy" src="{a['png']}" alt="{html.escape(p['alt'],quote=True)}"><div class="copy"><small>{p['id']} · DRAFT · {p['weightedCharacters']} / 280</small><pre class="caption">{html.escape(p['text'])}</pre><div class="actions"><button onclick="copyText(this)">Copy post</button><a href="{a['png']}" download>Download image ↗</a><a href="{a['svg']}" download>SVG ↗</a></div><details><summary>Alt text</summary><p>{html.escape(p['alt'])}</p></details></div></article>'''
catalog=''.join(f'<a class="asset" href="{a["png"]}" download><img loading="lazy" src="{a["png"]}" alt="{html.escape(a["alt"],quote=True)}"><strong>{a["purpose"]}</strong><small>{a["width"]} × {a["height"]} · PNG ↓</small></a>' for a in assets.values())
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VCM — Social launch kit</title><style>
@font-face{font-family:Rubik;src:url(assets/Rubik-Bold.ttf);font-weight:700}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#F6F3E8;color:#17252A;font:16px/1.55 Arial,sans-serif}a{color:inherit}header{border-bottom:1px solid #17252a30;padding:20px 4vw;display:flex;justify-content:space-between;align-items:center}header img{width:124px}nav{display:flex;gap:24px}nav a{text-decoration:none;font-weight:bold}.intro{padding:64px 4vw 52px;max-width:1440px;margin:auto}.eyebrow{font:13px monospace;letter-spacing:.1em}h1,h2,h3{font-family:Rubik,Arial,sans-serif;line-height:1.02;letter-spacing:-.045em}h1{font-size:clamp(50px,7.5vw,106px);max-width:1000px;margin:26px 0}h1 em{font-style:normal;color:#FF5A2A}.lead{font-size:22px;max-width:730px}.pills{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}.pills span{border:1px solid #17252a40;border-radius:30px;padding:7px 16px;font:13px monospace}.hero{width:100%;display:block;border-radius:24px;margin-top:40px}.section{max-width:1440px;padding:48px 4vw;margin:auto}h2{font-size:56px;margin:0 0 30px}.split{display:grid;grid-template-columns:1.2fr 1fr;gap:40px}.profile{background:#fff;border:1px solid #17252a20;border-radius:22px;overflow:hidden}.profile .banner{width:100%;display:block}.profilebody{padding:0 28px 32px}.avatar{width:100px;height:100px;border:5px solid white;border-radius:50%;margin-top:-38px;position:relative}.profile h3{font-size:24px;letter-spacing:-.025em;margin:10px 0 2px}.muted{color:#526469;font-size:14px}.profilebody p{margin:16px 0}.profilebody>a{color:#2441d8}.brief{display:flex;flex-direction:column;justify-content:center}.brief h3{font-size:36px;margin:0 0 18px}.brief p{margin:0 0 20px}.note{border-left:4px solid #ff5a2a;padding:14px 18px;background:#fff6}.downloads{display:flex;flex-wrap:wrap;gap:12px}.downloads a,.actions button,.actions a{background:#17252A;color:#F6F3E8;border:0;padding:12px 16px;border-radius:8px;text-decoration:none;font:700 14px Arial;cursor:pointer}.downloads a:first-child{background:#FF5A2A;color:#17252A}.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}.post{border:1px solid #17252a25;border-radius:18px;overflow:hidden;background:white}.posthead{display:flex;justify-content:space-between;gap:12px;padding:14px 20px;font:12px monospace}.post>img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#f6f3e8;display:block}.copy{padding:22px}.copy small{font:12px monospace;color:#526469}.caption{font:inherit;white-space:pre-wrap;line-height:1.55;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:8px}.actions a{background:#F6F3E8;color:#17252A}.copy details{margin-top:18px;font-size:13px;color:#526469}.catalog{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.asset{display:flex;flex-direction:column;gap:5px;background:white;border-radius:12px;overflow:hidden;text-decoration:none;padding:12px}.asset img{width:100%;height:175px;object-fit:contain;background:#f6f3e8}.asset strong{font-size:14px}.asset small{font:12px monospace;color:#526469}footer{padding:40px 4vw;border-top:1px solid #17252a30;max-width:1440px;margin:30px auto 0;font-size:14px}.rhythm{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.rhythm>div{border-radius:16px;padding:26px;background:#ff5a2a}.rhythm>div:nth-child(2){background:#A8DED0}.rhythm>div:nth-child(3){background:#F7D85B}.rhythm h3{font-size:28px;margin:16px 0}.rhythm p{margin:0}#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 22px;background:#17252A;color:#fff;border-radius:10px;display:none}button:focus-visible,a:focus-visible{outline:3px solid #2d4df0;outline-offset:4px}@media(max-width:800px){.split,.grid{grid-template-columns:1fr}.catalog{grid-template-columns:1fr 1fr}.rhythm{grid-template-columns:1fr}h2{font-size:40px}nav{gap:12px;font-size:13px}.intro{padding-top:32px}.section{padding-top:30px}.profilebody{padding:0 20px 24px}.lead{font-size:19px}.posthead{font-size:10px}.asset img{height:125px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><header><img src="assets/vcm-logo-ink.svg" alt="VCM"><nav><a href="#profile">The profile</a><a href="#posts">The posts</a><a href="#assets">The assets</a></nav></header><main><section class="intro"><div class="eyebrow">VCM / SOCIAL LAUNCH KIT / 08 SEPTEMBER 2026</div><h1>Big ideas deserve<br><em>a following.</em></h1><p class="lead">One recognizable brand. Seventeen ready-to-use assets. Four weeks of useful posts about teams, building and the work behind the product.</p><div class="pills"><span>BIG IDEAS DESERVE A TEAM.</span><span>SOLO. NEVER SMALL.</span><span>BUILD WHAT COMES NEXT.</span></div><img class="hero" src="exports/09-team-sculpture.png" alt="VCM team sculpture campaign"></section><section class="section" id="profile"><h2>The front door.</h2><div class="split"><div class="profile"><img class="banner" src="exports/x-header.png" alt="VCM X header"><div class="profilebody"><img class="avatar" src="exports/x-avatar.png" alt="VCM avatar"><h3>VCM · Virtual Corporation Manager</h3><div class="muted">@virtualcorpman</div><p>__BIO__</p><a href="https://github.com/strobl/virtual-corporation-manager">github.com/strobl/virtual-corporation-manager</a></div></div><div class="brief"><div class="eyebrow">LIVE PROFILE / @VIRTUALCORPMAN</div><h3>Built to be recognized<br>before it is read.</h3><p>The original V mark reads at avatar size. The headline and companion keep the header recognizable. The public name explains what VCM does.</p><p class="note">The profile is live at <a href="https://x.com/virtualcorpman">@virtualcorpman</a>. Avatar, header, name, bio and GitHub link are verified. The launch posts remain drafts until publication is authorized.</p><div class="downloads"><a href="exports/x-header.png" download>Download header</a><a href="exports/x-avatar.png" download>Download avatar</a><a href="content/X-PROFILE.md">Profile copy ↗</a></div></div></div></section><section class="section"><h2>A reason to come back.</h2><div class="rhythm"><div><span class="eyebrow">MONDAY</span><h3>Show your team.</h3><p>A useful org chart. Explicit roles. A question worth answering.</p></div><div><span class="eyebrow">WEDNESDAY</span><h3>Built in the open.</h3><p>A real product change. A clear visual. A source you can inspect.</p></div><div><span class="eyebrow">FRIDAY</span><h3>Never stop hacking.</h3><p>A practical contribution, an experiment or an invitation to build.</p></div></div></section><section class="section" id="posts"><h2>The first four weeks.</h2><p>One pinned introduction and twelve copy-ready drafts. Relative slots become dates after the publishing schedule is approved.</p><div class="grid">__POSTS__</div></section><section class="section" id="assets"><h2>The whole family.</h2><p>Download a PNG. Edit its SVG. Keep the same identity.</p><div class="catalog">__CATALOG__</div></section></main><footer>VCM — Virtual Corporation Manager · <a href="README.md">Source & asset catalog</a> · <a href="content/CONTENT-ENGINE.md">Content engine</a> · <a href="content/posts.json">Structured queue</a><p>Original brand system preserved. Org charts are illustrative; the actual application screenshot lives in the repository README. Draft, scheduled and published remain distinct states.</p></footer><div id="toast" role="status"></div><script>async function copyText(button){const text=button.closest('.copy').querySelector('.caption').textContent;try{await navigator.clipboard.writeText(text);const toast=document.getElementById('toast');toast.textContent='Post copied';toast.style.display='block';setTimeout(()=>toast.style.display='none',1800)}catch{const range=document.createRange();range.selectNodeContents(button.closest('.copy').querySelector('.caption'));getSelection().removeAllRanges();getSelection().addRange(range);button.textContent='Text selected — copy manually'}}</script></body></html>'''
page=page.replace('__BIO__',html.escape(bio)).replace('__POSTS__',cards).replace('__CATALOG__',catalog)
(root/'gallery.html').write_text(page)
print(json.dumps({'assets':len(assets),'posts':len(posts),'bioCharacters':len(bio),'maxPostCharacters':max(x['weightedCharacters'] for x in posts)},indent=2))
