#!/usr/bin/env python3
"""Stage 1 length trial: insert a 1900px block (+50%) after S5 by recycling S3/S4/S5/S1 layouts.

Reads scripts/level/stage1.base.json, writes data/levels/stage1.json (adds "worldW").
"""
import json, copy, random

random.seed(11)
base = json.load(open('scripts/level/stage1.base.json'))
INS_AT, ADD = 2140, 1900
BASE_W = 3800

# (src_x0, src_x1, dst_x0): recycled blocks, 1900px in total (3420..3980 is S1 plus 60px of padding).
BLOCKS = [(860, 1300, 2140), (1300, 1500, 2580), (1500, 2140, 2780), (0, 560, 3420)]
SKIP_DECOR = {'picnic', 'sign-post', 'billboard', 'stone-altar'}


def shift(x):
    return x + ADD if x >= INS_AT else x


out = copy.deepcopy(base)
out['worldW'] = BASE_W + ADD


def shift_list(key, fields=('x',)):
    for e in out.get(key, []):
        for f in fields:
            if f in e:
                e[f] = shift(e[f])


for k in ('pits', 'steps', 'platforms', 'spikes', 'honey', 'movingPlatforms', 'crushers', 'breakables', 'coins', 'secrets', 'friends'):
    shift_list(k)
shift_list('enemies', ('x', 'unlockX'))
shift_list('altarAmbush')
out['altarTriggerX'] = shift(out['altarTriggerX'])
out['checkpoints'] = [shift(x) for x in out['checkpoints']]
out['durians'] = [shift(x) for x in out['durians']]
for e in out['decor']['back']:
    e['x'] = shift(e['x'])
for s in out['segments']:
    s['x0'] = shift(s['x0']) if s['x0'] >= INS_AT else s['x0']
    s['x1'] = shift(s['x1']) if s['x1'] > INS_AT else s['x1']


def inside(x, a, b):
    return a <= x < b


added = {k: [] for k in ('pits', 'steps', 'platforms', 'spikes', 'honey', 'movingPlatforms', 'crushers', 'breakables', 'coins', 'enemies')}
checkpoints, durians, decor = [], [], []
for a, b, d in BLOCKS:
    off = d - a
    for k in ('pits', 'steps', 'platforms', 'spikes', 'honey', 'movingPlatforms', 'crushers', 'breakables', 'coins', 'enemies'):
        for e in base.get(k, []):
            if inside(e['x'], a, b):
                n = copy.deepcopy(e)
                n['x'] += off
                if 'unlockX' in n:
                    n['unlockX'] += off
                n.pop('note', None)
                if k == 'breakables' and n.get('loot') == 'power':
                    n['loot'] = 'coin'
                if k == 'platforms' and 'hidden' in str(e.get('note', '')):
                    pass
                added[k].append(n)
    checkpoints += [x + off for x in base['checkpoints'] if inside(x, a, b)]
    durians += [x + off for x in base['durians'] if inside(x, a, b)]
    for e in base['decor']['back']:
        if inside(e['x'], a, b) and e['kind'] not in SKIP_DECOR:
            decor.append({**e, 'x': e['x'] + off})

# Variety: swap some recycled fish for barrels so copies don't read as identical.
swap = [e for e in added['enemies'] if e['species'] == 'fish' and e['kind'] == 'chaser']
for i, e in enumerate(swap):
    if i % 2 == 1:
        e['species'], e['kind'] = 'barrel', 'ambusher'
# An extra tough one in the middle of the new block.
added['enemies'].append({'x': 3050, 'species': 'elephant', 'kind': 'guardian', 'unlockX': 2850})

for k, v in added.items():
    out[k] = sorted(out[k] + v, key=lambda e: e['x'])
out['checkpoints'] = sorted(set(out['checkpoints'] + checkpoints + [2620]))
out['durians'] = sorted(set(out['durians'] + durians))
out['decor']['back'] = sorted(out['decor']['back'] + decor, key=lambda e: e['x'])
out['segments'] = sorted(out['segments'] + [
    {'id': 'S5b', 'role': 'test', 'x0': 2140, 'x1': 2580, 'note': '加長：矮台階＋坑＋追擊（回收 S3）'},
    {'id': 'S5c', 'role': 'rest', 'x0': 2580, 'x1': 2780, 'note': '加長：存檔點'},
    {'id': 'S5d', 'role': 'test', 'x0': 2780, 'x1': 3420, 'note': '加長：刺塊＋寬坑（回收 S5）'},
    {'id': 'S5e', 'role': 'teach', 'x0': 3420, 'x1': 4040, 'note': '加長：地刺＋路障（回收 S1）'},
], key=lambda s: s['x0'])
json.dump(out, open('data/levels/stage1.json', 'w'), ensure_ascii=False, indent=1)
print('stage1 extended:', {k: len(v) for k, v in added.items()}, 'worldW', out['worldW'])
