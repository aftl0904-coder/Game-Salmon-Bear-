#!/usr/bin/env python3
"""Read-only ART-20 sprite audit; writes ONLY to /tmp/qa-art20-fixed/sprites.
Run: python3 /tmp/qa-art20-fixed/sprites/check_sprites.py
Requires Python 3, Pillow and numpy. Numeric flags are screeners, not semantic verdicts.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import json, csv, hashlib, math, subprocess, shutil

ROOT = Path('/tmp/salmon-art20-9c8d-readonly')
OUT = Path('/tmp/qa-art20-fixed/sprites')
EXPECTED_HEAD = '9c8d58ca6fa87cd24ba409ecb38810c5a6e1949e'
# model-sheet has 4 specified views, not an animation.
SPECS = {
 'enemies/c2-human-guard': {'model-sheet':4,'idle':3,'walk':4,'detect':3,'warning':3,'attack':3,'recover':3,'hit':2,'defeat':4},
 'boss/c2-mall-scrubber': {'model-sheet':4,'idle':4,'move':4,'scan':3,'warn-charge':3,'charge':4,'charge-stop':3,'warn-brush':3,'brush-spin':4,'recover':3,'hurt':2,'defeat':5},
 'fx/c2-mall-scrubber': {'scan-warning':2,'charge-warning':2,'brush-warning':2},
 'boss/c2-trainer': {'model-sheet':4,'idle':4,'point':3,'rain':4,'shield':4,'hurt':2,'defeat':5},
 'enemies/c2-product-zombie': {'model-sheet':4,'walk':4,'reach':3,'hit':2,'die':4},
 'fx/c2-trainer': {'whip':3,'chain-net-warning':2,'chain-net':3},
}
ORDER = list(SPECS)
KEY = np.array([255,0,255],dtype=np.int16)
OUT.mkdir(parents=True, exist_ok=True)
head=subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'],text=True).strip()
if head != EXPECTED_HEAD: raise SystemExit('Wrong HEAD: '+head)
manifest=json.loads((ROOT/'art-src/anim/manifest.json').read_text())
byfile={}
for e in manifest: byfile.setdefault(e.get('file'),[]).append(e)
records=[]
for category in ORDER:
 for stem,expected in SPECS[category].items():
  rel=f'art-src/anim/{category}/{stem}.png'; path=ROOT/rel
  rr={'file':rel,'expected':expected,'is_model_sheet':stem=='model-sheet','exists':path.exists()}
  entries=byfile.get(rel,[]); rr['manifest_entries']=len(entries)
  if not path.exists() or len(entries)!=1:
   rr['error']='missing PNG or exactly one manifest entry required'; records.append(rr); continue
  e=entries[0]; frames,cols,rows=e.get('frames'),e.get('cols'),e.get('rows')
  rr.update({'frames':frames,'cols':cols,'rows':rows,'facing':e.get('facing'),'has_prompt':bool(e.get('prompt'))})
  im=Image.open(path).convert('RGBA'); arr=np.asarray(im); h,w=arr.shape[:2]; rgb=arr[:,:,:3].astype(np.int16)
  # Anything <=32 from the key in all channels is treated as key-like for geometry;
  # this removes magenta halos from the subject metric but exact-key warnings remain.
  dist=np.max(np.abs(rgb-KEY),axis=2); keylike=dist<=32; exact=dist==0; foreground=~keylike
  edge=np.concatenate([exact[0,:], exact[-1,:], exact[:,0], exact[:,-1]])
  alpha=arr[:,:,3]
  rr.update({'width':w,'height':h,'mode':Image.open(path).mode,'nonopaque_pixels':int((alpha!=255).sum()),'exact_key_pixels':int(exact.sum()),'near_key_nonexact_pixels':int((keylike&~exact).sum()),'edge_exact_pct':round(float(edge.mean()*100),4),'non_keylike_pixels':int(foreground.sum()),'manifest_count_ok':frames==expected and cols*rows==frames,'facing_metadata_ok':e.get('facing')=='right','divisible':w%cols==0 and h%rows==0,'capacity_ok':frames<=cols*rows})
  # Float-divided boundaries (floor) visualize declared layout; when dimensions are
  # nondivisible no runtime-independent integer grid exists, so boundary is illustrative.
  xs=[math.floor(w*i/cols) for i in range(cols+1)]; ys=[math.floor(h*i/rows) for i in range(rows+1)]
  seams=[]
  for x in xs[1:-1]:
   both=foreground[:,x-1]&foreground[:,x]
   cols_ink=foreground.any(axis=0)
   li=np.flatnonzero(cols_ink[:x]); ri=np.flatnonzero(cols_ink[x:])
   left_clear=x-1-int(li[-1]) if li.size else x
   right_clear=int(ri[0]) if ri.size else w-x
   seams.append({'x':x,'crossing_rows':int(both.sum()),'left_ink':int(foreground[:,x-1].sum()),'right_ink':int(foreground[:,x].sum()),'continuous_clear_columns_at_seam':int(left_clear+right_clear)})
  cells=[]
  for n in range(frames):
   col=n%cols; row=n//cols
   if row>=rows: cells.append({'frame':n+1,'error':'outside declared rows'}); continue
   x0,x1=xs[col],xs[col+1]; y0,y1=ys[row],ys[row+1]
   mask=foreground[y0:y1,x0:x1]; iy,ix=np.nonzero(mask)
   cell_rgb=arr[y0:y1,x0:x1,:3]
   # Count colours per cell, including its one key colour; no conversion is applied.
   rgb32=cell_rgb.astype(np.uint32)
   packed=(rgb32[:,:,0]<<16)|(rgb32[:,:,1]<<8)|rgb32[:,:,2]
   color_count=len(np.unique(packed))
   cell={'frame':n+1,'rect':[x0,y0,x1,y1], 'ink_pixels':int(mask.sum()), 'ink_pct':round(float(mask.mean()*100),3), 'has_ink':bool(mask.sum()>100), 'unique_rgb_colors':color_count, 'sha256':hashlib.sha256(arr[y0:y1,x0:x1].tobytes()).hexdigest()}
   if len(ix):
    cell.update({'bbox_local':[int(ix.min()),int(iy.min()),int(ix.max()),int(iy.max())], 'bbox_center_x':round(float((ix.min()+ix.max())/2),2), 'mass_center_x':round(float(ix.mean()),2), 'bottom_y':int(iy.max())})
   cells.append(cell)
  rr['cells']=cells; rr['seams']=seams; rr['seam_crossing_rows']=sum(a['crossing_rows'] for a in seams)
  rr['minimum_seam_gap_px']=min((a['continuous_clear_columns_at_seam'] for a in seams), default=None)
  rr['outer_ink_px']=int(foreground[0,:].sum()+foreground[-1,:].sum()+foreground[:,0].sum()+foreground[:,-1].sum())
  rr['all_cells_ink']=all(c.get('has_ink') for c in cells)
  rr['exact_duplicate_cells']=len({c['sha256'] for c in cells if 'sha256' in c})<len(cells)
  rr['cell_color_min']=min(c['unique_rgb_colors'] for c in cells if 'unique_rgb_colors' in c)
  rr['cell_color_max']=max(c['unique_rgb_colors'] for c in cells if 'unique_rgb_colors' in c)
  valid=[c for c in cells if 'bottom_y' in c]
  rr['bottom_range_px']=max(c['bottom_y'] for c in valid)-min(c['bottom_y'] for c in valid) if valid else None
  rr['center_range_px']=round(max(c['bbox_center_x'] for c in valid)-min(c['bbox_center_x'] for c in valid),2) if valid else None
  rr['sha256_png']=hashlib.sha256(path.read_bytes()).hexdigest()
  records.append(rr)

extras=[]
for category in ORDER:
 expected_names={name+'.png' for name in SPECS[category]}
 extras.extend(str(p.relative_to(ROOT)) for p in (ROOT/'art-src/anim'/category).glob('*.png') if p.name not in expected_names)
(OUT/'measurements.json').write_text(json.dumps({'head':head,'method':'non-key-like foreground: max RGB distance from FF00FF >32; seam=foreground on adjacent columns same row; floor proportional boundaries when nondivisible','extra_pngs':extras,'records':records},ensure_ascii=False,indent=2)+'\n')
fields=['file','width','height','frames','cols','rows','expected','manifest_entries','manifest_count_ok','facing','has_prompt','divisible','nonopaque_pixels','exact_key_pixels','near_key_nonexact_pixels','edge_exact_pct','all_cells_ink','seam_crossing_rows','minimum_seam_gap_px','outer_ink_px','bottom_range_px','center_range_px','exact_duplicate_cells','cell_color_min','cell_color_max','sha256_png']
with (OUT/'measurements.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fields,extrasaction='ignore'); writer.writeheader(); writer.writerows(records)
# Audit contact sheets: one source image per row, overlaid declared boundaries.
# These are inspection/evaluation artifacts, not modified asset deliverables.
font=ImageFont.load_default()
for category in ORDER:
 items=[r for r in records if r['file'].startswith('art-src/anim/'+category+'/') and r.get('width')]
 panels=[]
 for r in items:
  src=Image.open(ROOT/r['file']).convert('RGB'); d=ImageDraw.Draw(src)
  for i in range(1,r['cols']):
   x=math.floor(r['width']*i/r['cols']); d.line((x,0,x,r['height']-1),fill=(0,255,255),width=3)
  src=src.resize((640,360),Image.Resampling.NEAREST)
  panel=Image.new('RGB',(640,386),'#151515'); panel.paste(src,(0,26)); pd=ImageDraw.Draw(panel)
  short=Path(r['file']).name
  label=f"{short}  {r['frames']}F {r['cols']}x{r['rows']}  {'OK' if r['divisible'] else 'NON-DIV'}  seam={r['seam_crossing_rows']}"
  pd.text((5,5),label,fill='white',font=font); panels.append(panel)
 for page in range((len(panels)+7)//8):
  group=panels[page*8:(page+1)*8]; sheet=Image.new('RGB',(1280,386*math.ceil(len(group)/2)),'#151515')
  for i,panel in enumerate(group): sheet.paste(panel,((i%2)*640,(i//2)*386))
  outname=category.replace('/','__')+f'__p{page+1}.png'; sheet.save(OUT/outname)
# Unmodified source evidence: separators and vertically stacked FX remain visible.
for src in ['fx/c2-trainer/whip.png','fx/c2-mall-scrubber/scan-warning.png','fx/c2-mall-scrubber/charge-warning.png']:
 shutil.copyfile(ROOT/'art-src/anim'/src, OUT/('original-'+Path(src).name))
print('HEAD',head,'files',len(records),'PNG present',sum(x['exists'] for x in records),'manifest-count OK',sum(x.get('manifest_count_ok',False) for x in records),'divisible',sum(x.get('divisible',False) for x in records),'seam-crossing',sum(x.get('seam_crossing_rows',0)>0 for x in records),'outer-ink',sum(x.get('outer_ink_px',0)>0 for x in records))
for r in records:
 print(f"{r['file'].replace('art-src/anim/',''):44} {r.get('width')}x{r.get('height')} {r.get('frames')}F div={r.get('divisible')} seams={r.get('seam_crossing_rows')} outer={r.get('outer_ink_px')} ink={r.get('all_cells_ink')} bottom={r.get('bottom_range_px')} center={r.get('center_range_px')} near={r.get('near_key_nonexact_pixels')} edge={r.get('edge_exact_pct')}")
