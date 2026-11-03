from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter, ImageOps
from pathlib import Path
from fontTools.ttLib import TTFont
P=Path('/tmp/salmon-trailer-render/plates'); P.mkdir(parents=True,exist_ok=True)
S=Path('public/art')
# Convert the repo's licensed Fusion Pixel WOFF2 for FFmpeg's FreeType renderer.
font=TTFont('public/fonts/fusion-pixel-12-zh-hk.woff2');font.flavor=None;font.save('/tmp/salmon-trailer-render/fusion-pixel.ttf')
# Food, basket and honey are a crop of the existing picnic still, not new art.
food=Image.open(S/'story/c1-picnic.png').convert('RGB').crop((110,395,720,720))
ImageOps.fit(food,(1280,720),method=Image.Resampling.LANCZOS).save(P/'picnic-food.png')
# Existing picnic background and real/fake jar assets, no generated artwork.
bg=Image.open(S/'story/c1-picnic.png').convert('RGB').filter(ImageFilter.GaussianBlur(8)); bg=ImageEnhance.Brightness(bg).enhance(.25).convert('RGBA')
pot=Image.open(S/'props/honey-pot.png').convert('RGBA').resize((315,360),Image.Resampling.NEAREST)
jar=Image.open(S/'items/jar-fake.png').convert('RGBA').resize((180,220),Image.Resampling.NEAREST)
bg.alpha_composite(pot,(330,180)); bg.alpha_composite(jar,(735,260)); bg.convert('RGB').save(P/'honey.png')
# Crop only one half of each subject. The source strip does not contain a complete face.
def painted_crop(src, box, bright, dst):
    patch=Image.open(S/src).convert('RGB').crop(box)
    patch.thumbnail((570,630),Image.Resampling.LANCZOS)
    patch=ImageEnhance.Brightness(patch).enhance(bright)
    canvas=Image.new('RGB',(1280,720),(5,6,10))
    x=(1280-patch.width)//2; y=(720-patch.height)//2
    canvas.paste(patch,(x,y)); canvas.save(P/dst)
painted_crop('story/s2-boss-intro.png',(430,50,700,600),.34,'boss-queen.png')
painted_crop('story/s3-boss-intro.png',(370,60,640,600),.34,'boss-owl.png')
painted_crop('story/s4-boss-intro.png',(410,50,700,600),.30,'boss-mud.png')
painted_crop('story/c7-boss.png',(500,130,640,620),.30,'boss-trinity.png')
# Actual game uses hatsoldier as Warrior King, triboss tinted as security-director placeholder.
def sprite_half(file, frame, crop, tint, out):
    full=Image.open(S/('anim/'+file+'.png')).convert('RGBA').crop((0,0,*frame))
    patch=full.crop(crop).resize((280,560),Image.Resampling.NEAREST)
    r,g,b,a=patch.split(); solid=Image.new('RGBA',patch.size,tint); solid.putalpha(a)
    bg=Image.new('RGBA',(1280,720),(6,8,13,255)); d=ImageDraw.Draw(bg)
    d.rectangle((436,65,840,655),fill=(18,24,32,255));bg.alpha_composite(solid,(490,80))
    bg.convert('RGB').save(P/out)
sprite_half('hatsoldier',(124,130),(37,17,68,129),(60,39,25,255),'boss-king.png')
sprite_half('triboss',(172,204),(44,3,86,203),(31,48,67,255),'boss-security.png')
# One ending image becomes an unidentifiable, heavily blurred, small abstract shard.
bg=Image.new('RGB',(1280,720),(2,3,6));frag=Image.open('docs/trailer/source/ending-abstract.png').convert('RGB');bg.paste(frag,(500,270));bg.save(P/'ending-shard.png')
# Exact sole trailer copy. Do not add title, tagline or subtitle.
bg=Image.new('RGB',(1280,720),(4,7,12));d=ImageDraw.Draw(bg)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',51)
text='Coming Christmas 2026';box=d.textbbox((0,0),text,font=font);x=(1280-(box[2]-box[0]))//2
d.text((x,320),text,font=font,fill=(231,214,177));bg.save(P/'end-card.png')
print('Created masked and composited production plates in',P)
