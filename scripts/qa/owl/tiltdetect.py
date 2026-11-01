import sys, json
from PIL import Image
import numpy as np
im=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)[260:515,425:855]
r,g,b=im[...,0],im[...,1],im[...,2]
def cen(m,n=15):
    ys,xs=np.nonzero(m)
    return [float(xs.mean()),float(ys.mean())] if len(xs)>n else None
print(json.dumps({'hole':cen((g>170)&(r<140)&(b<140)&(g-r>50)),'ball':cen((r>230)&(g>150)&(g<210)&(b<110)),'pit':cen((r<14)&(g<14)&(b<14),60)}))
