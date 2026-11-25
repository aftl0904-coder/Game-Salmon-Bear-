#!/usr/bin/env python3
"""Check standalone atlas dimensions, binary alpha, color counts, and every cell border."""
import json, sys
from pathlib import Path
from PIL import Image
import numpy as np

cfg=json.loads(Path(sys.argv[1]).read_text())
results=[]
for item in cfg['items']:
    path=Path(item['path']); im=Image.open(path)
    arr=np.asarray(im.convert('RGBA')); h,w=arr.shape[:2]
    fw,fh=item['frameWidth'],item['frameHeight']
    cols=item.get('columns',item['frames']);rows=item.get('rows',1);n=item['frames']
    alpha=arr[:,:,3]; colors=len(np.unique(arr[alpha>0,:3],axis=0))
    cells=[]
    for i in range(n):
        y,x=(i//cols)*fh,(i%cols)*fw
        a=alpha[y:y+fh,x:x+fw]
        if a.shape!=(fh,fw): cells.append({'frame':i,'bad_shape':list(a.shape)});continue
        yy,xx=np.nonzero(a)
        edges=int(np.count_nonzero(a[0,:])+np.count_nonzero(a[-1,:])+np.count_nonzero(a[:,0])+np.count_nonzero(a[:,-1]))
        cells.append({'frame':i,'opaque_pixels':int(len(xx)),'bbox':([int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)] if len(xx) else None),'edge_pixels':edges})
    one={'name':item['name'],'path':str(path),'mode':im.mode,'size':[w,h],'expected':[fw*cols,fh*rows],
         'frames':n,'columns':cols,'rows':rows,'frame_size':[fw,fh],
         'alpha_values':list(map(int,np.unique(alpha))),'opaque_colors':colors,'cells':cells}
    one['pass']=im.mode=='RGBA' and [w,h]==one['expected'] and set(one['alpha_values'])<={0,255} and colors<=64 and all(c.get('opaque_pixels',0)>0 and c.get('edge_pixels',-1)==0 for c in cells)
    results.append(one)
print(json.dumps(results,ensure_ascii=False,indent=2))
if not all(r['pass'] for r in results):sys.exit(1)
