"""Build VCM's editable campaign masters using the adopted native identity.

Python standard library only. Run from any directory: python3 brand/source/build.py
SVG files embed the supplied OFL display font; PNGs are the publishing masters.
"""
from pathlib import Path
import base64
import html
import json

ROOT = Path(__file__).resolve().parents[1]
INK, ORANGE, CREAM, BLUE, MINT, BUTTER = '#17252A', '#FF5A2A', '#F6F3E8', '#2D4DF0', '#A8DED0', '#F7D85B'
OUT = ROOT / 'exports'
OUT.mkdir(exist_ok=True)
MANIFEST = []

def data(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()

FONT = data(ROOT / 'assets/Rubik-Bold.ttf', 'font/ttf')
ART = data(ROOT / 'assets/team-sculpture.png', 'image/png')

def text(x, y, value, size=24, color=INK, bold=False, mono=False, anchor='start'):
    family = 'monospace' if mono else ('Rubik' if bold else 'Arial, sans-serif')
    return f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-family="{family}" font-weight="{700 if bold else 400}" text-anchor="{anchor}">{html.escape(value)}</text>'

def rect(x, y, w, h, color, radius=0, stroke=None):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{color}"' + (f' stroke="{stroke}" stroke-width="2"' if stroke else '') + '/>'

def line(path, color=BLUE, width=6):
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'

def mascot(x, y, scale=1, color=ORANGE, face=True):
    out = f'<g transform="translate({x} {y}) scale({scale})"><path d="M14 12 C4 -8 -17 2 -12 23 L17 103 C23 120 45 120 52 103 L84 24 C92 3 69 -8 59 12 L35 64 Z" fill="{color}"/>'
    if face:
        out += '<circle cx="25" cy="85" r="4.2" fill="#17252A"/><circle cx="47" cy="85" r="4.2" fill="#17252A"/><path d="M31 96 Q36 101 41 96" stroke="#17252A" stroke-width="3.3" fill="none" stroke-linecap="round"/>'
    return out + '</g>'

def logo(x, y, scale=1, color=INK):
    # Exact original 6 September 2026 path geometry, not a typeset approximation.
    return f'<g transform="translate({x} {y}) scale({scale})">' + mascot(14, 0, .43, color, False) + f'<path d="M91 10 C84 1 68 1 59 9 C45 22 49 42 61 48 C72 54 85 51 93 43 L83 32 C77 38 68 38 66 31 C63 23 71 17 80 22 Z M100 3 H116 L128 23 L140 3 H156 V51 H140 V29 L128 46 L116 29 V51 H100 Z" fill="{color}"/></g>'

def dot(x, y, color=BLUE, r=6):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'

def label(x, y, value, bg=INK, fg=CREAM, width=220):
    return rect(x, y, width, 36, bg, 18) + text(x+16, y+24, value, 16, fg, mono=True)

def top(label_text, w=1600, dark=False):
    fg = CREAM if dark else INK
    return logo(64, 44, 1.1, fg) + text(w-64, 77, label_text, 18, fg, mono=True, anchor='end')

def footer(w=1600, h=900, note='BIG IDEAS DESERVE A TEAM.', dark=False):
    fg = CREAM if dark else INK
    return line(f'M64 {h-90} H{w-64}', fg, 1) + text(64, h-46, note, 18, fg, mono=True) + text(w-64, h-46, 'VCM / OPEN SOURCE', 18, fg, mono=True, anchor='end')

def node(x, y, title, detail, color, w=280, h=146, human=False):
    out = rect(x+5,y+6,w,h,INK,20) + rect(x,y,w,h,color,20)
    if human:
        out += dot(x+39,y+38,INK,12) + line(f'M{x+17} {y+76} Q{x+39} {y+48} {x+61} {y+76}',INK,8)
    else:
        out += mascot(x+24,y+22,.53,INK,False)
    out += text(x+86,y+50,title,26,INK,True) + text(x+24,y+min(116,h-25),detail,18)
    return out

def save(name, width, height, body, bg=CREAM, purpose='', alt=''):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{html.escape(alt, quote=True)}"><title>{html.escape(alt)}</title><defs><style>@font-face{{font-family:Rubik;src:url({FONT}) format("truetype");font-weight:700}}</style></defs>'
    svg += rect(0,0,width,height,bg) + body + '</svg>'
    (OUT / f'{name}.svg').write_text(svg)
    MANIFEST.append(dict(id=name, width=width, height=height, purpose=purpose, alt=alt, svg=f'exports/{name}.svg', png=f'exports/{name}.png'))

# One clear, high-contrast identity at avatar sizes; the face sits inside circular crops.
save('x-avatar',400,400,mascot(100,58,2.7,INK,False),ORANGE,'X profile photo','VCM V symbol in dark ink on orange.')
save('mascot-avatar',800,800,mascot(205,105,5.4,ORANGE),CREAM,'Community mascot avatar','The orange VCM mascot with two eyes and a smile on cream.')

# Avatar overlaps the lower-left of an X header; put all headline copy to its right.
b=logo(64,90,1.2)+text(360,205,'Big ideas',74,INK,True)+text(360,290,'deserve a team.',74,INK,True)
b+=text(364,349,'Humans + AI agents. Your corporation.',25)
b+=mascot(1113,92,2.05)+mascot(1320,198,1.30,MINT)
save('x-header',1500,500,b,CREAM,'X header','VCM. Big ideas deserve a team. Humans and AI agents, your corporation. Orange and mint V mascots.')

# README hero and GitHub's actual repository link preview.
def hero(w,h):
    s=w/1600
    b=logo(64,54,1.3)+label(1195,59,'MIT / LOCAL / OPEN',width=338)
    b+=text(64,238,'Big ideas',102,INK,True)+text(64,352,'deserve a team.',102,INK,True)
    b+=text(68,428,'The open-source workspace for your virtual corporation.',28)
    b+=mascot(1130,197,2.7)+mascot(1420,295,1.4,MINT)
    b+=rect(0,534,1600,106,ORANGE)+text(66,599,'HUMANS + AI AGENTS. YOUR CORPORATION.',27,INK,True)
    return f'<g transform="scale({s})">{b}</g>'
save('github-social-preview',1280,640,'<g transform="translate(0 64) scale(.8)">'+hero(1600,640)+'</g>',CREAM,'GitHub social preview','VCM. Big ideas deserve a team. The open-source workspace for your virtual corporation. Humans and AI agents, your corporation. MIT, local, open.')
save('readme-hero',1600,640,hero(1600,640),CREAM,'README hero','VCM. Big ideas deserve a team. The open-source workspace for your virtual corporation. Humans and AI agents, your corporation. MIT, local, open.')

# Series 01: organizing the team is the product proof, connectors are reporting lines.
b=top('SHOW YOUR TEAM / 001')+text(64,224,'Solo. Never small.',98,INK,True)
b+=text(67,280,'Give every responsibility a home.',30)
b+=line('M800 442 V502 M304 502 H1296 M304 502 V566 M800 502 V566 M1296 502 V566')
b+=node(660,322,'You','Human / direction',BUTTER,h=120,human=True)
for x,t,d,c in [(164,'Researcher','Sources + useful questions',MINT),(660,'Builder','Implementation + checks',ORANGE),(1156,'Reviewer','Requirements + feedback',CREAM)]:
    b+=node(x,566,t,d,c)
b+=footer(note='EXAMPLE TEAM / A PLACE FOR EVERY ROLE')
save('01-show-your-team',1600,900,b,CREAM,'X launch / org chart','Illustrated example org chart: a human owner above Researcher, Builder and Reviewer AI roles. Lines show reporting, not automatic task execution.')

# Series 02: the actual repo example has three peers, never invent a manager in it.
b=top('TEAM RECIPE / 002',dark=True)+text(64,220,'Three roles. One starting point.',76,CREAM,True)
b+=text(68,278,'Patchwork Studio — the example you can import from the repo.',29,CREAM)
b+=rect(650,335,300,66,BLUE,33)+text(800,378,'PRODUCT',23,'#FFFFFF',True,anchor='middle')
b+=line('M800 402 V450 M322 450 H1278 M322 450 V510 M800 450 V510 M1278 450 V510',MINT,4)
for x,t,d,c in [(172,'Builder','Implement a scoped change',ORANGE),(650,'Reviewer','Check against requirements',MINT),(1128,'Researcher','Trace the supplied sources',BUTTER)]:
    b+=node(x,510,t,d,c,w=300)
b+=text(800,724,'Three peers. Configured roles. Your next move.',28,CREAM,True,anchor='middle')+footer(note='PATCHWORK STUDIO / FICTIONAL IMPORTABLE EXAMPLE',dark=True)
save('02-team-recipe',1600,900,b,INK,'X educational post','Patchwork Studio fictional importable example: Builder, Reviewer and Researcher are three peer AI roles in the Product department. No work has executed.')

# Series 03: stable functionality and a visible preview/save decision.
b=top('BUILD NOTES / 003')+text(64,236,'Name it. Team it. Make it yours.',72,INK,True)
for i,(title,sub,c) in enumerate([('Company','Name + purpose',BUTTER),('Members','Humans + AI agents',ORANGE),('Context','Roles + responsibilities',MINT)]):
    x=64+i*505
    b+=rect(x,332,464,336,c,24)+text(x+30,395,f'0{i+1}',29,INK,mono=True)+text(x+30,527,title,52,INK,True)+text(x+30,600,sub,26)
b+=text(68,744,'Review your changes. Save your team. Come back tomorrow.',30)+footer(note='VCM / CORPORATION MANAGEMENT')
save('03-name-your-corporation',1600,900,b,CREAM,'X product walkthrough','Three steps in VCM: company name and purpose; human and AI members; roles and responsibilities. Review changes, save and return later.')

# Series 04: local by construction, no inflated privacy or autonomy promise.
b=top('YOUR WORKSPACE / 004',dark=True)+text(64,249,'Your company.',110,CREAM,True)+text(64,375,'On your machine.',110,CREAM,True)
b+=rect(988,454,512,246,BLUE,24)+rect(1010,476,468,192,CREAM,12)+mascot(1175,493,1.28)+line('M954 718 H1534',MINT,16)
b+=text(68,488,'Local SQLite. No account required for the core.',29,CREAM)+text(68,568,'Organize. Back up. Export. Keep building.',29,CREAM)
b+=footer(dark=True)
save('04-your-machine',1600,900,b,INK,'X local-first positioning','Your company on your machine. The VCM core uses local SQLite and requires no account. Organize, back up and export. Orange mascot on a cobalt laptop.')

# Series 05: human and agent are explicitly distinct.
b=top('PEOPLE + AGENTS / 005')+text(64,222,'Same team. Different kinds.',82,INK,True)
b+=node(120,348,'Human','Direction, decisions, context',BUTTER,w=570,h=230,human=True)
b+=node(910,348,'AI agent','Role, instructions, responsibility',MINT,w=570,h=230)
b+=text(800,490,'+',90,INK,True,anchor='middle')+text(800,720,'Put both in the picture.',49,INK,True,anchor='middle')+footer()
save('05-people-and-agents',1600,900,b,CREAM,'X product distinction','A human member and an AI agent side by side. Different member kinds belong in the same VCM company.')

# Series 06: a culture poster with the original flat mascot.
b=top('NEVER STOP HACKING / 006',dark=True)+text(64,285,'TRY IT.',132,CREAM,True)+text(64,431,'BREAK IT.',132,CREAM,True)+text(64,577,'MAKE IT BETTER.',116,CREAM,True)
b+=mascot(1280,247,2.85,ORANGE)+text(68,728,'Read the code. Change a little. Share what you learn.',29,CREAM)+footer(note='HACKERS FIRST / CURIOSITY IS THE ENTRY TICKET',dark=True)
save('06-never-stop-hacking',1600,900,b,INK,'X culture / contribution','Try it. Break it. Make it better. Read the code, change a little and share what you learn. Orange VCM mascot.')

# Series 07: a precise public release fact, with no fabricated product shipment.
b=top('BUILT IN THE OPEN / 007')+label(66,165,'RELEASE NOTE',BLUE,'#FFFFFF',200)
b+=text(64,300,'Same local core.',102,INK,True)+text(64,416,'Now wearing VCM.',102,INK,True)
b+=rect(64,488,1472,195,INK,24)+text(102,552,'vcm-0.1.0-alpha.8.tgz',51,CREAM,mono=True)+text(104,619,'The download uses VCM. The installed package keeps compatibility.',27,CREAM)
b+=footer(note='ALPHA.8 / DISTRIBUTION-NAME MAINTENANCE')
save('07-alpha8-release',1600,900,b,CREAM,'X verified release update','Alpha.8 distribution-name maintenance: download vcm-0.1.0-alpha.8.tgz. The local core and installed package compatibility remain.')

# Series 08: clearly marked invitation, no invented users or traction.
b=top('SHOW YOUR TEAM / 008')+text(64,259,'What would your',108,INK,True)+text(64,386,'first three roles be?',108,INK,True)
for x,c in [(170,ORANGE),(650,MINT),(1130,BUTTER)]:
    b+=rect(x,478,300,230,c,24)+text(x+150,639,'?',126,INK,True,anchor='middle')
b+=footer(note='SKETCH YOUR TEAM / SHARE YOUR REASONING')
save('08-first-three-roles',1600,900,b,CREAM,'X community prompt','What would your first three roles be? Three empty role cards invite builders to sketch their team.')

# New campaign artwork remains unchanged; typography is a separate editable SVG layer.
b=f'<image x="0" y="0" width="1600" height="1067" href="{ART}"/>'
b+=logo(64,52,1.25)+text(64,256,'SOLO.',105,INK,True)+text(64,374,'NEVER',105,INK,True)+text(64,492,'SMALL.',105,INK,True)
b+=text(68,641,'Big ideas deserve',28)+text(68,680,'a team.',28)+rect(0,994,1600,86,ORANGE)+text(68,1049,'VCM / VIRTUAL CORPORATION MANAGER',26,INK,True)
save('09-team-sculpture',1600,1080,b,CREAM,'X campaign illustration','Solo. Never small. A clay sculpture shows a human founder connected to three V-shaped orange, mint and yellow teammates. Editorial brand illustration.')

# Mobile-native companion formats, not center-cropped landscape posts.
b=top('SHOW YOUR TEAM',1080)+text(60,292,'SOLO.',148,INK,True)+text(60,450,'NEVER',148,INK,True)+text(60,608,'SMALL.',148,INK,True)
b+=node(360,739,'You','Human / direction',BUTTER,w=350,h=130,human=True)+line('M535 869 V937 M227 937 H853 M227 937 V1004 M853 937 V1004')
b+=node(77,1004,'Builder','Implementation',ORANGE,w=300)+node(703,1004,'Reviewer','Checks + feedback',MINT,w=300)
b+=text(64,1425,'Big ideas deserve a team.',52,INK,True)+text(67,1490,'The open-source workspace',32)+text(67,1535,'for your virtual corporation.',32)
b+=text(67,1645,'EXAMPLE TEAM / REPORTING ONLY',20,INK,mono=True)
save('10-story-team',1080,1920,b,CREAM,'Story / Reel cover','Solo. Never small. Fictional reporting chart with a human, a Builder and a Reviewer. VCM, the open-source workspace for your virtual corporation.')

b=top('BIG IDEAS. FULL TEAM.',1080)+text(62,250,'BUILD WHAT',100,INK,True)+text(62,365,'COMES NEXT.',100,INK,True)
b+=mascot(195,451,3.15)+mascot(640,584,2.1,MINT)+footer(1080,1080,'HACKERS FIRST / BE OPEN')
save('11-square-culture',1080,1080,b,CREAM,'Square social cover','Build what comes next. Orange and mint VCM mascots. Hackers first. Be open.')

# README explanation uses the same series without relying on marketing artwork as UI proof.
b=top('YOUR CORPORATION, IN CONTEXT')+text(64,215,'People. Agents. Clear responsibilities.',69,INK,True)
b+=line('M800 373 V428 M330 428 H1270 M330 428 V483 M800 428 V483 M1270 428 V483')
b+=node(650,264,'Your company','Name + purpose',BUTTER,w=300,h=110,human=True)
for x,t,d,c,human in [(180,'You','Human / decisions',BUTTER,True),(650,'Builder','AI / implementation',ORANGE,False),(1120,'Reviewer','AI / checks',MINT,False)]:
    b+=node(x,483,t,d,c,w=300,h=137,human=human)
b+=text(800,712,'Illustrated example: membership structure, not automatic execution.',25,INK,anchor='middle')
save('readme-team-map',1600,780,b,CREAM,'README product model','Illustrated VCM company membership: human owner and Builder and Reviewer AI agents, with explicit responsibilities. This is not a software screenshot or automatic execution.')

(ROOT/'manifest.json').write_text(json.dumps({'brand':'VCM — Virtual Corporation Manager','brandLine':'Big ideas deserve a team.','created':'2026-09-08','assets':MANIFEST},indent=2)+'\n')
print(f'Built {len(MANIFEST)} SVG masters.')
