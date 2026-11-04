import type { AnimSetId } from './heroAnims'

export type GalleryAction = { label: string; anim?: string; still?: string; pending?: '待繪' | '待切格驗收' }
export type GalleryEntry = { id: string; name: string; group: 'good' | 'bad'; where: string; note?: string; set?: AnimSetId; actions: [GalleryAction, GalleryAction, GalleryAction] }
const a = (label: string, anim: string): GalleryAction => ({ label, anim })
const pending = (label: string, status: '待繪' | '待切格驗收' = '待繪'): GalleryAction => ({ label, pending: status })
const still = (label: string, key: string): GalleryAction => ({ label, still: key })
const anim = (id: string, name: string, group: GalleryEntry['group'], where: string, set: AnimSetId, names: [string, string, string], note?: string): GalleryEntry => ({ id, name, group, where, set, note, actions: names.map(n => a(n, n)) as GalleryEntry['actions'] })
const friend = (id: string, name: string, where: string, raw: boolean): GalleryEntry => ({ id, name, group: 'good', where, actions: [still('靜態姿勢', `friend-${id}`), pending('歡呼', raw ? '待切格驗收' : '待繪'), pending('行走', raw ? '待切格驗收' : '待繪')] })
const vendor = (id: string, name: string, where: string, texture: string, raw: boolean): GalleryEntry => ({ id, name, group: 'good', where, actions: [still('靜態姿勢', texture), pending('遞食物', raw ? '待切格驗收' : '待繪'), pending('招手', '待繪')] })
// In-game visible appearances (not dialogue name-drops): C1 actors, then level entities by x;
// unmerged #91 candidates go last, not represented as accepted runtime sprites.
export const GALLERY: GalleryEntry[] = [
  anim('lunbo', '倫寶', 'good', '封面／第1關開場', 'lunbo', ['idle', 'shoot', 'win']),
  anim('kibobo', '琪寶寶', 'good', '封面／第1關開場', 'kibobo', ['idle', 'slash3', 'fan-glide']),
  anim('pupu', '噗噗', 'good', '封面／第1關開場', 'pupu', ['idle', 'cute-pose', 'tackle']),
  vendor('mama', '咖啡媽媽', '第1關開場', 'cs-mama', false),
  friend('huihui', '熊仔', '第1關 x760', true),
  friend('guard-friend', '英國熊', '第1關 x1064', true),
  vendor('waffle', '夾餅叔叔', '第2關存檔點', 'cs-keeper2', true),
  friend('denim', '小熊仔', '第2關 x1640', true),
  friend('brownie', '招積熊', '第2關 x2560', true),
  vendor('tart', '蛋撻哥哥', '第3關存檔點', 'cs-keeper3', true),
  friend('shiba', '柴柴', '第3關 x1700', true),
  friend('snowcat', '北極熊', '第3關 x2815', false),
  vendor('coconut', '開椰青嘅泰國人', '第4關存檔點', 'cs-keeper4', true),
  friend('ginger', '薑餅', '第4關 x1660', false),
  friend('fleecy', '大pat熊', '第4關 x2960', false),
  friend('kuro', '喵仔', '第5關 x1200', true),
  vendor('sashimi', '刺身師傅', '第5關存檔點', 'cs-keeper5', true),
  friend('gnome', '聖誕伯伯', '第5關 x1850', false),
  friend('tigercub', '虎仔', '第5關 x2820', true),
  { id: 'ending-guardian', name: '結局守護者（待確認）', group: 'good', where: '大陸2結局插畫；首次出場待核', note: '可能與現有角色重複，身份未確認；未有獨立切圖', actions: [pending('正常'), pending('招手'), pending('擁抱')] },
  anim('fish', '紅魚', 'bad', '第1關 x520', 'fish', ['walk', 'charge', 'dash']),
  anim('hatsoldier', '帽仔兵', 'bad', '第1關 x1700', 'hatsoldier', ['walk', 'throw-low', 'throw-high']),
  anim('mechpig', '機械豬', 'bad', '第1關 x3050', 'mechpig', ['walk', 'lunge', 'block']),
  { id: 'warriorking', name: '武者王', group: 'bad', where: '第1關祭壇 Boss', note: '故事：被面罩所控；現借用帽仔兵圖，專屬圖待繪', actions: [pending('正常'), pending('投擲'), pending('衝刺')] },
  anim('beesoldier', '蜜蜂兵', 'bad', '第2關 x600', 'beesoldier', ['fly', 'aim', 'dive']),
  { id: 'squirrel', name: '蜜僵松鼠', group: 'bad', where: '第2關 x900', set: 'squirrel', actions: [a('walk', 'walk'), a('lunge', 'lunge'), pending('警戒轉身')] },
  anim('queen', '蜜冠女王蜂', 'bad', '第2關 Boss', 'queen', ['hover', 'summon', 'spray'], '故事：被皇冠所控'),
  { id: 'minibee', name: '小蜜蜂', group: 'bad', where: '第2關 Boss 戰召喚', set: 'minibee', actions: [a('fly', 'fly'), pending('俯衝'), pending('警戒盤旋')] },
  anim('egg', '假蜜蛋', 'bad', '第2關 Boss 戰產卵', 'egg', ['idle', 'hatch', 'break']),
  { id: 'lobster', name: '龍蝦兵', group: 'bad', where: '第3關 x520', set: 'lobster', actions: [a('walk', 'walk'), a('block', 'block'), pending('夾擊', '待切格驗收')] },
  anim('stallkeeper', '油甘魚攤主（敵人）', 'bad', '第3關 x800', 'stallkeeper', ['idle', 'throw', 'duck']),
  anim('mirrorshade', '鏡影雜兵', 'bad', '第3關 x1640', 'mirrorshade', ['float', 'dash', 'split']),
  anim('mirrorowl', '月橋鏡鴞', 'bad', '第3關 Boss', 'mirrorowl', ['perch', 'feather-curtain', 'split'], '故事：被鏡所控'),
  { id: 'honeyzombie', name: '蜜僵', group: 'bad', where: '第4關 x420', set: 'honeyzombie', actions: [a('walk', 'walk'), a('reach', 'reach'), pending('踉蹌轉身')] },
  anim('clockpunch', '打卡鐘怪', 'bad', '第4關 x850', 'clockpunch', ['walk', 'tick', 'burst']),
  anim('taximonster', '的士怪', 'bad', '第4關 x1050', 'taximonster', ['idle', 'flash', 'dash']),
  anim('mudmane', '泥鬃', 'bad', '第4關 Boss', 'mudmane', ['ride', 'nailgun', 'punch'], '故事：被蜜印所控'),
  anim('triboss', '△畝大佬', 'bad', '第5關 Boss', 'triboss', ['idle', 'point', 'shield']),
  { id: 'security-guard', name: '商場保安', group: 'bad', where: '第6關 x520（現版佔位）', note: '現版借用蜜僵；#91 人類保安切格未過 QA', actions: [pending('正常', '待切格驗收'), pending('近身攻擊', '待切格驗收'), pending('回復', '待切格驗收')] },
  { id: 'robotarm', name: '輸送機械臂', group: 'bad', where: '第6關 x1280', actions: [still('靜態姿勢', 's6-robotarm'), pending('瞄準'), pending('發射')] },
  { id: 'securitydirector', name: '商場保安總監', group: 'bad', where: '第6關 Boss（現版）', note: '故事卡：被制服所控；現版借用大佬圖', actions: [pending('正常'), pending('掃描'), pending('投射')] },
  { id: 'drone', name: '巡邏無人機', group: 'bad', where: '第6關 Boss 戰召喚', actions: [still('靜態姿勢', 's6-drone'), pending('鎖定'), pending('發射')] },
  { id: 'scrubber', name: '商場清潔機械人', group: 'bad', where: '第6關確認方案；現版未上線', note: '#91 原圖尚待切格 QA，並非保安總監', actions: [pending('正常', '待切格驗收'), pending('衝撞', '待切格驗收'), pending('轉刷', '待切格驗收')] },
  { id: 'trainer', name: '馴獸師', group: 'bad', where: '第7關方案；main 未出場', note: '#91 原圖尚待切格 QA；Boss 卡文字待補', actions: [pending('正常', '待切格驗收'), pending('鞭擊', '待切格驗收'), pending('鏈網', '待切格驗收')] },
  { id: 'product-zombie', name: '產品化蜜僵', group: 'bad', where: '第7關方案；main 未出場', note: '#91 原圖尚待切格 QA', actions: [pending('正常', '待切格驗收'), pending('伸手', '待切格驗收'), pending('掙脫籠鏈')] },
]
// `guard` is both a friend ID and an enemy species; keep roster IDs distinct.
GALLERY.find(e => e.id === 'guard-friend')!.actions[0] = still('靜態姿勢', 'friend-guard')
