# ART REQUEST 09 — 噗噗褪色效果修正

From: Claude → To: Cursor (image generation). Same owner, same game.

## 問題

`art-src/story/c3-market.png`（第 3 關前・夜市，`docs/bible/story.md` C5）入面，噗噗而家係
**一刀切嘅半邊白、半邊橙**，好似張圖壞咗／未畫完，而唔係「慢慢褪色」。

故事設定：噗噗食咗假蜜會慢慢變灰、失去顏色（`docs/bible/story.md`）。遊戲入面呢一幕用
`"grey": 0.5`（0 = 本來顏色，1 = 全灰），即係噗噗應該係「褪緊色褪到一半」，唔係「被一刀切做
兩半」。

## 參考：已經畫啱嘅版本

`art-src/story/c1-hollow.png`（第 1 關開頭，噗噗食咗假蜜全灰嗰張）已經畫得好靚：全身均勻嘅
灰藍色、冇晒血色、眼神無力。嗰種「全身一齊褪色」嘅質感就係 c3-market.png 嗰隻噗噗應該有嘅
方向，只係褪到一半（仲有少少原本嘅暖色）。

## 想點改

重畫 `art-src/story/c3-market.png`（640×360，背景、倫寶、琪寶寶原封不動，淨係改噗噗）：

- 噗噗全身都帶一層灰，唔好係垂直一刀切做兩種顏色。
- 可以不均勻（斑駁）—— 例如肚、耳仔邊位灰得深啲，其他位置仲有返少少暖色，模仿「褪色緊
  中，仲未褪晒」嘅質感，但唔好有銳利嘅分界線。
- 表情/姿勢跟番而家張圖（企喺度，有少少驚訝／唔舒服），淨係改佢身上嘅顏色處理。
- 跟 c1-hollow.png 嗰種灰藍（唔好用純灰／純白）。

如果同一張圖覺得仲有第二隻噗噗（或者第二張 story 圖）都係呢種一刀切嘅褪色畫法，一拼跟呢個
方向改。

Branch: **`art/batch-09`**.

## Delivery

1. `git pull` first.
2. Overwrite `art-src/story/c3-market.png`（同大細、同構圖，淨係噗噗顏色處理改咗）。
3. Commit 同 push 上 branch **`art/batch-09`**。

Other rules:
- 唔好改 `src/`、`data/` 或 `public/`。
- 用瀏覽器 GitHub 登入 push，唔好貼 token。
