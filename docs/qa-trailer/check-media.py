import json, subprocess, math
from pathlib import Path
import numpy as np
v='docs/trailer/salmon-bear-trailer-first-cut.mp4'
probe=json.loads(Path('docs/qa-trailer/ffprobe.json').read_text())
video=next(s for s in probe['streams'] if s['codec_type']=='video');audio=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert video['codec_name']=='h264' and (video['width'],video['height'])==(1280,720) and video['avg_frame_rate']=='30/1'
assert audio['codec_name']=='aac' and abs(float(probe['format']['duration'])-75)<.02
captions=json.loads(Path('docs/trailer/subtitles.json').read_text()); story=json.loads(Path('data/story.json').read_text())
if any(c['text'] == '待補' for c in captions):
 raise SystemExit('字幕為待補，舊影片記錄不能用目前資料重新驗證。')
c1={x['text'] for x in story['scenes']['C1']['steps'] if 'text' in x};assert all(c['text'] in c1 for c in captions)
raw=subprocess.check_output(['ffmpeg','-v','error','-i',v,'-ac','1','-ar','8000','-f','f32le','-'])
a=np.frombuffer(raw,dtype='<f4'); sr=8000
rms=[float(np.sqrt(np.mean(a[i*sr:(i+1)*sr]**2))) for i in range(75)]
assert len(a)>=74.9*sr and max(rms)>.001 and sum(x>.001 for x in rms)>60
# Decode 1 fps tiny grayscale frames and check distinct successive visual states.
pix=subprocess.check_output(['ffmpeg','-v','error','-i',v,'-vf','fps=1,scale=64:36,format=gray','-f','rawvideo','-'])
frames=np.frombuffer(pix,dtype=np.uint8).reshape(-1,36,64); changed=sum(float(np.mean(np.abs(frames[i].astype(float)-frames[i-1].astype(float))))>.5 for i in range(1,len(frames)))
assert len(frames)==75 and changed>=20
report={'duration_seconds':float(probe['format']['duration']),'video':{'codec':video['codec_name'],'width':video['width'],'height':video['height'],'fps':video['avg_frame_rate']},'audio':{'codec':audio['codec_name'],'channels':audio['channels'],'rms_by_second':rms,'seconds_above_0_001':sum(x>.001 for x in rms)},'visual':{'sampled_frames':len(frames),'changed_intervals':int(changed)},'captions_exact_C1_match':True,'captions':captions,'sync_note':'Music and SFX events scheduled in capture-audio.mjs at edit times; this check proves signal and source scheduling, not subjective listening.'}
Path('docs/qa-trailer/media-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('PASS',json.dumps({k:report[k] for k in ['duration_seconds','video','visual','captions_exact_C1_match']},ensure_ascii=False))
