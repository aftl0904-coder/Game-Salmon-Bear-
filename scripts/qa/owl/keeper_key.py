import sys
import numpy as np
from PIL import Image
from scipy import ndimage

def key(src, dst, height=128):
    im = np.asarray(Image.open(src).convert('RGB')).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    bg = (g - r > 60) & (g - b > 60) & (g > 100)
    lab, n = ndimage.label(bg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(border))
    bgm = ndimage.binary_dilation(bgm, iterations=1) & ((g - r > 25) & (g - b > 25) | bgm)
    a = np.where(bgm, 0, 255).astype(np.uint8)
    rgb = im.copy()
    edge = ndimage.binary_dilation(bgm, iterations=3) & ~bgm
    gcap = np.maximum(r, b)
    rgb[..., 1] = np.where(edge & (g > gcap), gcap, g)
    out = np.dstack([rgb.astype(np.uint8), a])
    img = Image.fromarray(out, 'RGBA')
    img = img.crop(img.getchannel('A').getbbox())
    w = round(img.width * height / img.height)
    img = img.resize((w, height), Image.LANCZOS)
    img.save(dst)
    print(dst, img.size)

if __name__ == '__main__':
    key(sys.argv[1], sys.argv[2])
