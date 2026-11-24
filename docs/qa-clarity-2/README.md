# Clarity-2 QA

## 本階段做咗咩
`safeKnockX` 避開坑／刺／榴槤／雜物／其他敵人（反向或只彈高）；第 1 關地刺 hurtbox 縮到尖端闊度；第 5 關輸送帶貼坑最後 40px 唔再推。

## 證據
- `summary.json` ok=true
- 地刺：`s1-spikes-4700-hitbox.png`（bodyW 10 ≤ dispW 16）
- 彈開前後：`{1p,2p}-s{1,5,6}-knock-{before,after}.png`
- 輸送帶：`s5-belt-deadzone-580.png`、`s5-belt-stand-firm.png`（580–615 唔郁，560 仍推）

## 已確認事實
- Stage1 @4650 向右彈：右有刺、左有坑 → kx=0（只彈高）
- Belt deadzone：x≥580 喺 420–620 帶上唔推

## 未驗證
- 真機手機 `?hitbox=1` 觸控
