#!/usr/bin/env python3
import concurrent.futures, subprocess, shlex, json, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
captions=json.loads(Path('docs/trailer/subtitles.json').read_text())
if any(c['text'] == '待補' for c in captions):
 raise SystemExit('預告片暫停：字幕待補，請勿重剪。')
ROOT=Path.cwd(); TEMP=Path('/tmp/salmon-trailer-render'); PL=TEMP/'plates'; SEG=TEMP/'segments'; SEG.mkdir(parents=True,exist_ok=True)
subprocess.run(['python3','docs/qa-trailer/prepare-plates.py'],check=True)
# start, duration, source, mode; actual dates and source ranges also in shot-list.md
shots=[
 ('00a',4,'public/art/story/c1-picnic.png','still'),('00b',3,str(PL/'picnic-food.png'),'still'),('01',6,str(PL/'honey.png'),'still'),
 ('02',7,'public/art/story/c1-hollow.png','still'),('03',5,'public/art/story/c2-bike.png','still'),
 ('04',4,'docs/trailer/source/stage1.webm','game1'),
 ('05',2,str(PL/'boss-king.png'),'boss'),('06',2,str(PL/'boss-queen.png'),'boss'),
 ('07',2,str(PL/'boss-owl.png'),'boss'),('08',2,str(PL/'boss-mud.png'),'boss'),
 ('09',1,str(PL/'boss-trinity.png'),'boss'),('09k',1,'docs/trailer/source/cursor/ken-optB-silhouette.png','boss'),
 ('10',1,str(PL/'boss-security.png'),'boss'),('10l',1,'docs/trailer/source/cursor/leon-silhouette.png','boss'),
 ('11',7,'docs/trailer/source/stage6.webm','game6'),('12',4,'docs/trailer/source/cursor/c2s2-expo-hall-dark.png','still'),
 ('13a',3,'docs/trailer/source/cursor/c2s2-cage-corridor-dark.png','still'),('13b',5,'docs/trailer/source/cursor/bear-chained-dark.png','still'),
 ('14',1,str(PL/'ending-shard.png'),'shard'),
 ('15',6,'docs/trailer/source/stage1.webm','game1'),('16',8,str(PL/'end-card.png'),'card'),
]
assert sum(s[1] for s in shots)==75
story=json.loads(Path('data/story.json').read_text())
c1={step['text'] for step in story['scenes']['C1']['steps'] if 'text' in step}
for c in captions:
 assert c['text'] in c1 and 0<=c['start']<c['end']<=67, f"Unapproved subtitle: {c}"
font=ImageFont.truetype(str(TEMP/'fusion-pixel.ttf'),42)
for i,c in enumerate(captions):
 layer=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(layer)
 box=d.textbbox((0,0),c['text'],font=font,stroke_width=1);w=box[2]-box[0];h=box[3]-box[1]
 x=(1280-w)//2; y=602-box[1]
 d.rectangle((x-12,590,x+w+12,602+h+10),fill=(0,0,0,185))
 d.text((x,y),c['text'],font=font,fill=(246,232,204,255),stroke_width=1,stroke_fill=(0,0,0,255))
 layer.save(TEMP/f'caption-{i}.png')
offset=0; tagged=[]
for s in shots:
 tagged.append((*s,offset)); offset+=s[1]
commands=[]
def make(s):
 id,duration,src,mode,start=s; out=SEG/f'{id}.mp4'; args=['ffmpeg','-y','-hide_banner','-loglevel','error','-filter_threads','1']
 active=[(i,c,max(c['start'],start),min(c['end'],start+duration)) for i,c in enumerate(captions) if max(c['start'],start)<min(c['end'],start+duration)]
 if os.getenv('TRAILER_REUSE')=='1' and (not active or os.getenv('TRAILER_REDO_ONLY')=='1') and out.exists() and id not in os.getenv('TRAILER_REDO','').split(','):
  print('reused unchanged',id,flush=True);return out
 if mode.startswith('game'):
  args+=['-i',src]
  # Chosen visual-only source ranges. Crop away all HUD, top action messages,
  # bottom HUD, and right-side shop labels/combat scores. Slow to fit the cut.
  a,b=(.8,2.6) if mode=='game1' else (1.8,4.0)
  speed=duration/(b-a)
  crop=('crop=750:430:0:190,scale=1256:720:flags=lanczos,pad=1280:720:12:0:black' if mode=='game6' else 'crop=900:430:0:190,scale=1280:612:flags=lanczos,pad=1280:720:0:54:black')
  vf=f'trim=start={a}:end={b},setpts=(PTS-STARTPTS)*{speed},fps=30,{crop},setsar=1,tpad=stop_mode=clone:stop_duration=1,fade=t=in:st=0:d=0.3,fade=t=out:st={duration-.3}:d=0.3,format=yuv420p'
 else:
  args+=['-loop','1','-framerate','30','-i',src]
  if mode=='still':
   vf="zoompan=z='min(zoom+0.00045,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,drawbox=x=0:y=0:w=iw:h=48:color=black:t=fill,drawbox=x=0:y=672:w=iw:h=48:color=black:t=fill"
   vf+=f',fade=t=in:st=0:d=0.45,fade=t=out:st={duration-.45}:d=0.45,format=yuv420p'
  elif mode=='boss':
   vf='scale=1280:720,fade=t=in:st=0:d=0.15,fade=t=out:st=0.55:d=0.25,format=yuv420p'
  elif mode=='shard':
   vf='scale=1280:720,fade=t=in:st=0:d=0.1,fade=t=out:st=0.4:d=0.2,format=yuv420p'
  else:
   vf=f'scale=1280:720,fade=t=in:st=0:d=1.2,fade=t=out:st={duration-1}:d=1,format=yuv420p'
 if active:
  assert len(active)==1, 'One subtitle per shot supported'
  i,c,a,b=active[0]
  args+=['-loop','1','-framerate','30','-i',str(TEMP/f'caption-{i}.png')]
  args+=['-filter_complex',f"[0:v]{vf}[bg];[1:v]format=rgba[cap];[bg][cap]overlay=0:0:enable='between(t,{a-start},{b-start})':eof_action=repeat[v]",'-map','[v]']
 else:
  args+=['-vf',vf]
 args+=['-frames:v',str(duration*30),'-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-g','60','-threads','2',str(out)]
 commands.append(shlex.join(args)); subprocess.run(args,check=True); print('rendered',id,flush=True);return out
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: list(pool.map(make,tagged))
concat=TEMP/'concat.txt';concat.write_text(''.join(f"file '{SEG / (s[0]+'.mp4')}'\n" for s in shots))
joined=TEMP/'visual.mp4'
cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(joined)];commands.append(shlex.join(cmd));subprocess.run(cmd,check=True)
out='docs/trailer/salmon-bear-trailer-first-cut.mp4'
cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(joined),'-i','docs/trailer/source/game-audio.webm','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-af','aresample=async=1:first_pts=0,volume=4dB,afade=t=in:st=0:d=1,afade=t=out:st=73.5:d=1.5','-t','75','-movflags','+faststart',out]
commands.append(shlex.join(cmd));subprocess.run(cmd,check=True)
Path('docs/qa-trailer/render-commands.txt').write_text('\n'.join(commands)+'\n');print('completed',out,flush=True)
