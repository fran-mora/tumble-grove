"""Measure existing sprite body colours. Read-only image analysis; no artwork is changed.
Requires Pillow, matching the existing geometry scripts. Run from the repo with
python3 scripts/measure-fruit-colours.py. Fruit metadata is read using Node.
"""
import json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
fruits=json.loads(subprocess.check_output(['node','--experimental-strip-types','--input-type=module','-e',"import {FRUIT_COLLECTION} from './app/fruit-collection.ts'; console.log(JSON.stringify(FRUIT_COLLECTION));"],cwd=ROOT))
sheets={f:Image.open(ROOT/'public'/f).convert('RGB') for f in {fruit['sheet'] for fruit in fruits}}
def lab(rgb):
    r,g,b=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in (x/255 for x in rgb)]
    l=(.4122214708*r+.5363325363*g+.0514459929*b)**(1/3)
    m=(.2119034982*r+.6806995451*g+.1073969566*b)**(1/3)
    s=(.0883024619*r+.2817188376*g+.6299787005*b)**(1/3)
    return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s]
rows=[]
for fruit in fruits:
    g=fruit['geometry'];x,y,w,h=g['crop'];sprite=sheets[fruit['sheet']].crop((x,y,x+w,y+h))
    mask=Image.new('1',(w,h));ImageDraw.Draw(mask).polygon([(g['center'][0]+px*g['radius'],g['center'][1]+py*g['radius']) for px,py in g['hull']],fill=1)
    pixels=[sprite.getpixel((px,py)) for py in range(0,h,2) for px in range(0,w,2) if mask.getpixel((px,py))]
    # Ignore white highlights/background and nearly black facial features.
    pixels=[rgb for rgb in pixels if not(min(rgb)>210 and max(rgb)-min(rgb)<27) and max(rgb)>38]
    # Channel medians resist shadows, white shine and small pink cheeks/green stems.
    rgb=tuple(sorted(p[channel] for p in pixels)[len(pixels)//2] for channel in range(3))
    rows.append({'hex':'#'+''.join(f'{v:02x}' for v in rgb),'lab':[round(v,5) for v in lab(rgb)]})
output='// Measured from sprite body pixels by scripts/measure-fruit-colours.py.\n// Artwork IDs, not fruit names or climate, determine these colours.\nexport const FRUIT_COLOURS = [\n'
for fruit,row in zip(fruits,rows):output+='  '+json.dumps(row,separators=(',',':'))+', // '+fruit['name']+'\n'
(ROOT/'app/fruit-colours.ts').write_text(output+'] as const;\n')
print('Measured',len(rows),'fruit bodies.')
for fruit,row in zip(fruits,rows):print(f"{fruit['name']:24} {row['hex']}")
