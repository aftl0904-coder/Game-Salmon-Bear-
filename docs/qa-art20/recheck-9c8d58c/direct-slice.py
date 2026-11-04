#!/usr/bin/env python3
"""QA-only exact-grid/nearest preview. Not wired into the game or Cursor branch."""
import json, os
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(os.environ.get('ART20_ROOT','/tmp/salmon-art20-9c8d-readonly'))
OUT=Path(os.environ.get('ART20_OUT','/tmp/qa-art20-fixed/direct'))
OUT.mkdir(parents=True, exist_ok=True)
manifest=json.loads((ROOT/'art-src/anim/manifest.json').read_text())
specs={
 'enemies/c2-human-guard': 56,
 'enemies/c2-product-zombie': 56,
 'boss/c2-mall-scrubber': 128,
 'boss/c2-trainer': 100,
 'fx/c2-mall-scrubber': 80,
 'fx/c2-trainer': 80,
}
records=[]
for e in manifest:
 rel=e['file']
 if not rel.startswith('art-src/anim/') or not rel.endswith('.png'):
  continue
 sub=rel.removeprefix('art-src/anim/')
 group=sub.rsplit('/',1)[0]
 if group not in specs: continue
 image=Image.open(ROOT/rel).convert('RGBA')
 n,cols,rows=e['frames'],e['cols'],e['rows']
 assert image.width%cols==0 and image.height%rows==0
 sw,sh=image.width//cols,image.height//rows
 oh=specs[group];ow=max(1,round(sw*oh/sh))
 atlas=Image.new('RGBA',(ow*n,oh),(0,0,0,0))
 color_counts=[];half=0
 for i in range(n):
  frame=image.crop(((i%cols)*sw,(i//cols)*sh,(i%cols+1)*sw,(i//cols+1)*sh))
  arr=np.array(frame); key=(arr[:,:,0]==255)&(arr[:,:,1]==0)&(arr[:,:,2]==255)
  arr[key]=[0,0,0,0]
  frame=Image.fromarray(arr).resize((ow,oh),Image.Resampling.NEAREST)
  pix=np.array(frame); alpha=pix[:,:,3]
  half+=int(((alpha>0)&(alpha<255)).sum())
  rgb=pix[alpha>0,:3]
  color_counts.append(len(np.unique(rgb,axis=0)) if len(rgb) else 0)
  atlas.paste(frame,(i*ow,0))
 safe=sub.replace('/','__');atlas.save(OUT/safe)
 records.append({'source':rel,'frames':n,'cell':[ow,oh],'colors':color_counts,'partial_alpha_pixels':half,'pass':half==0 and max(color_counts)<=64 and min(color_counts)>0})
(OUT/'report.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('PNG files',len(records),'PASS',sum(r['pass'] for r in records),'FAIL',[(r['source'],r['colors'],r['partial_alpha_pixels']) for r in records if not r['pass']])
