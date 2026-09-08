"""Build the Buzz.xyz / Slack campaign from VCM's existing vector identity.

Python standard library only. No network access; campaign raster masters are preserved.
Run build.py, then render.cjs. Output is an offline asset kit, not a hosted site.
"""
from pathlib import Path
import base64
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT.parent
OUT = ROOT / 'exports'
OUT.mkdir(parents=True, exist_ok=True)
INK, ORANGE, CREAM, BLUE, MINT, BUTTER = '#17252A', '#FF5A2A', '#F6F3E8', '#2D4DF0', '#A8DED0', '#F7D85B'
FONT = base64.b64encode((BRAND / 'assets/Rubik-Bold.ttf').read_bytes()).decode()
assets = []


def text(x, y, value, size=24, color=INK, bold=False, mono=False, anchor='start'):
    family = 'monospace' if mono else ('Rubik' if bold else 'Arial, sans-serif')
    return f'<text x="{x}" y="{y}" fill="{color}" font-family="{family}" font-size="{size}" font-weight="{700 if bold else 400}" text-anchor="{anchor}">{html.escape(value)}</text>'


def rect(x, y, w, h, fill, radius=0, stroke=None):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="2"' if stroke else '') + '/>'


def line(d, color=INK, width=3):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'


def identity(file, x, y, w, h):
    # Embed the original SVG bytes without modifying the mascot or wordmark.
    source = base64.b64encode((BRAND / 'assets' / file).read_bytes()).decode()
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/svg+xml;base64,{source}"/>'


def logo(x=60, y=38, dark=False):
    return identity('vcm-logo-white.svg' if dark else 'vcm-logo-ink.svg', x, y, 164, 60)


def vic(x, y, size=230):
    return identity('vic-flat.svg', x, y, size, size*150/140)


def pill(x, y, title, width, bg=INK, fg=CREAM):
    return rect(x, y, width, 40, bg, 20) + text(x+20, y+27, title, 17, fg, mono=True)


def top(kicker, w=1600, dark=False):
    return logo(dark=dark) + text(w-64, 77, kicker, 17, CREAM if dark else INK, mono=True, anchor='end')


def footer(w=1600, h=900, note='BIG IDEAS DESERVE A TEAM.', dark=False):
    color = CREAM if dark else INK
    return line(f'M64 {h-87} H{w-64}', color, 1) + text(64,h-42,note,17,color,mono=True) + text(w-64,h-42,'VCM / OPEN SOURCE',17,color,mono=True,anchor='end')


def save(name, w, h, body, bg, purpose, alt, status):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{html.escape(alt,quote=True)}"><title>{html.escape(alt)}</title><defs><style>@font-face{{font-family:Rubik;src:url(data:font/ttf;base64,{FONT}) format("truetype");font-weight:700}}</style></defs>' + rect(0,0,w,h,bg) + body + '</svg>'
    (OUT/f'{name}.svg').write_text(svg)
    assets.append(dict(id=name,width=w,height=h,purpose=purpose,alt=alt,status=status,svg=f'exports/{name}.svg',png=f'exports/{name}.png'))


# Editorial banner: the two optional routes share an organization, not a relay.
b=top('BUZZ.XYZ + SLACK / OPTIONAL CONNECTIONS')
b+=text(64,220,'Your team.',82,INK,True)+text(64,326,'In the conversation.',74,INK,True)
b+=text(68,401,'Organize in VCM. Explore Buzz.xyz and Slack.',27)
b+=pill(68,448,'LOCAL CORE',176)+pill(258,448,'OPTIONAL CONNECTIONS',280,BLUE,'#FFFFFF')
b+=line('M1108 297 H1180 V184 H1230 M1180 297 V406 H1230',BLUE,5)
b+=rect(972,206,178,185,ORANGE,28)+identity('vcm-logo-ink.svg',990,270,140,51)
b+=rect(1218,130,318,108,CREAM,22,INK)+text(1250,194,'Buzz.xyz',41,INK,True)
b+=rect(1218,356,318,108,CREAM,22,INK)+text(1250,420,'Slack',41,INK,True)
b+=footer(h=640,note='TEAM IMPORT / EXPERIMENTAL TASK CONNECTIONS')
save('01-conversation',1600,640,b,CREAM,'README integration banner','VCM: Your team. In the conversation. Organize in VCM and explore optional Buzz.xyz and Slack connections. Team import and experimental task connections.','Configuration import; execution experimental')

# Buzz: a portable team, with the native preview as the human decision point.
b=top('BUZZ.XYZ / TEAM IMPORT')+text(64,232,'Give your',78,INK,True)+text(64,328,'agents a room.',78,INK,True)
b+=text(68,394,'Take roles and instructions',28)+text(68,434,'into Buzz.',28)
b+=vic(79,483,255)+vic(292,529,172)
b+=rect(679,175,856,563,INK,28)+pill(715,211,'VCM → BUZZ.XYZ',241,BUTTER,INK)
for i,(title,detail) in enumerate([('Export your team','Download a .team.json from VCM.'),('Preview in Buzz','Review the imported roles and instructions.'),('Make the connection','Configure your runtime before starting agents.')]):
    y=312+i*129
    b+=text(719,y,f'0{i+1}',24,MINT,mono=True)+text(788,y,title,35,CREAM,True)+text(789,y+40,detail,23,CREAM)
b+=footer(note='CONFIGURATION TRANSFER / AGENTS START SEPARATELY')
save('02-buzz-team',1600,900,b,CREAM,'Buzz team-import social card','Give your agents a room. Export a VCM team file, review its roles and instructions in Buzz, then configure the runtime separately before starting agents. Orange Vic companions stand beside three steps.','Configuration transfer; no activation implied')

# Slack: an illustrative command, never a fabricated delivery receipt.
b=top('SLACK / EXPERIMENTAL TASK CONNECTION')+text(64,241,'A mention.',96,INK,True)+text(64,350,'A mission.',96,INK,True)
b+=text(68,423,'Give a named role a focused task.',28)+rect(98,474,296,278,CREAM,34)+vic(124,481,245)
b+=rect(700,182,836,562,CREAM,28)+pill(735,217,'ILLUSTRATED FLOW',268,INK,CREAM)
b+=text(742,323,'You → VCM',23,INK,True)+rect(738,349,756,112,'#FFFFFF',16)
b+=text(762,395,'@VCM Reviewer: find three gaps',27,INK,True)+text(762,435,'in this launch brief: [paste brief]',27,INK,True)
b+=line('M776 482 V577 H815',BLUE,4)+text(837,529,'Your local runtime',29,INK,True)
b+=text(837,569,'executes the named role’s task.',24)+text(837,631,'The result returns to this thread.',25,INK,True)
b+=footer(note='SOCKET MODE / ONE ALLOWED OWNER + CHANNEL')
save('03-slack-mention',1600,900,b,ORANGE,'Slack task-flow social card','A mention. A mission. An illustrated Slack flow: an owner mentions VCM and names a Reviewer task; the local runtime executes and returns the result to the thread. Experimental; one allowed owner and channel.','Illustrated flow; live execution unverified')

# Accurate directionality: these are separate adapter routes.
b=top('LOCAL WORKSPACE / OPTIONAL CONNECTIONS',dark=True)+text(64,231,'Local roots. Open doors.',83,CREAM,True)
b+=text(68,295,'Keep your corporation local. Choose how agents connect.',29,CREAM)
for y,title,left,right,detail,color in [(366,'BUZZ.XYZ','VCM team','Buzz Desktop','Export roles → preview import → set up runtime',BUTTER),(572,'SLACK','Slack mention','Local VCM + Codex','Allowed mention → local execution → threaded reply',MINT)]:
    b+=rect(64,y,1472,171,color,22)+text(96,y+46,title,20,INK,mono=True)
    b+=text(96,y+107,left,36,INK,True)+line(f'M512 {y+94} H654 M641 {y+83} L654 {y+94} L641 {y+105}',INK,4)
    b+=text(691,y+107,right,36,INK,True)+text(691,y+144,detail,20)
b+=footer(note='CORE WORKS OFFLINE / CONNECTIONS REQUIRE EXTERNAL SETUP',dark=True)
save('04-local-open',1600,900,b,INK,'Integration architecture explainer','Local roots. Open doors. Two separate routes: VCM team configuration exports to Buzz Desktop; an allowed Slack mention goes to local VCM and Codex, then returns a threaded reply. The core works offline; connections need external setup.','Architecture illustration; execution experimental')

b=top('BUZZ.XYZ + SLACK',w=1080)+text(64,254,'Big ideas.',94,INK,True)+text(64,360,'Meet the',94,INK,True)+text(64,466,'channel.',94,INK,True)
b+=vic(666,319,305)+pill(68,567,'BUZZ.XYZ',187,BLUE,'#FFFFFF')+pill(270,567,'SLACK',143,INK,CREAM)
b+=text(68,695,'Organize your team in VCM.',33,INK,True)+text(68,750,'Explore optional connections.',30)
b+=text(68,866,'Team import. Experimental task connections.',23)
b+=footer(w=1080,h=1080)
save('05-meet-the-channel',1080,1080,b,CREAM,'Square community campaign','Big ideas. Meet the channel. Organize your team in VCM and explore optional Buzz.xyz and Slack connections. Team import; experimental task connections. The original orange Vic appears on cream.','Campaign illustration')

# A VCM identity for user-created apps/agents, never a partner certification badge.
for name,bg,purpose in [('06-slack-app-icon',ORANGE,'VCM Slack app icon'),('07-buzz-agent-avatar',CREAM,'VCM Buzz agent avatar')]:
    b=identity('vcm-icon.svg',92,92,328,328) if bg==ORANGE else vic(66,40,380)
    save(name,512,512,b,bg,purpose,'Original VCM identity for a user-configured '+('Slack app.' if bg==ORANGE else 'Buzz agent profile.'),'Identity asset; upload manually')

b=logo(64,35)+text(330,128,'Big ideas deserve a team.',61,INK,True)+text(334,194,'Bring yours into the conversation.',29)+vic(1290,50,230)
b+=pill(335,250,'BUZZ.XYZ + SLACK',282,BLUE,'#FFFFFF')
save('08-community-cover',1600,400,b,CREAM,'Community announcement cover','VCM. Big ideas deserve a team. Bring yours into the conversation. Buzz.xyz and Slack. Orange Vic on cream.','Editorial cover; no platform placement guarantee')

campaign=json.loads((ROOT/'campaign/manifest.json').read_text())
assets=campaign['assets']+assets
(ROOT/'manifest.json').write_text(json.dumps(dict(brand='VCM — Virtual Corporation Manager',brandLine='Big ideas deserve a team.',created='2026-09-08',sourceIdentity='../assets/',primaryAsset=campaign['primaryAsset'],assets=assets),indent=2,ensure_ascii=False)+'\n')

queue=json.loads((ROOT/'posts.json').read_text())
by_id={a['id']:a for a in assets}
cards=''
for p in queue['posts']:
    a=by_id[p['asset']]
    p['alt']=a['alt']
    p['weightedCharacters']=len(re.sub(r'https://\S+','x'*23,p['text']))
    if p['channel']=='X':
        assert p['weightedCharacters']<=280,p['id']
    source_link=f'<a href="{a["svg"]}" download>Editable SVG ↓</a>' if a.get('svg') else '<a href="campaign/README.md">Screenshot sources ↗</a>'
    cards+=f'<article class="post"><img src="{a["png"]}" alt="{html.escape(a["alt"],quote=True)}"><div class="copy"><small>{p["channel"]} · DRAFT</small><h3>{html.escape(p["title"])}</h3><p class="caption">{html.escape(p["text"])}</p><div class="actions"><button onclick="copyText(this)">Copy text</button><a href="{a["png"]}" download>PNG ↓</a>{source_link}</div><details><summary>Alt text</summary><p>{html.escape(a["alt"])}</p></details></div></article>'
(ROOT/'posts.json').write_text(json.dumps(queue,indent=2,ensure_ascii=False)+'\n')
catalog=''.join(f'<a class="asset" href="{a["png"]}" download><img src="{a["png"]}" loading="lazy" alt="{html.escape(a["alt"],quote=True)}"><strong>{a["purpose"]}</strong><small>{a["width"]} × {a["height"]} · PNG ↓</small></a>' for a in assets)
template=(ROOT/'source/gallery-template.html').read_text()
(ROOT/'gallery.html').write_text(template.replace('__POSTS__',cards).replace('__ASSETS__',catalog))
md='# Buzz.xyz + Slack campaign copy\n\nCopy-ready drafts. Images are editorial illustrations; no live delivery or publishing is claimed.\n\n'
for p in queue['posts']:
    md+=f'## {p["title"]}\n\n{p["channel"]} · Draft\n\n[Image]({by_id[p["asset"]]["png"]})\n\n{p["text"]}\n\n**Alt text:** {p["alt"]}\n\n'
(ROOT/'COPY.md').write_text(md)
print(json.dumps({'assets':len(assets),'drafts':len(queue['posts'])}))
