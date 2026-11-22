# QA · PR-G minigames (舉旗大賽 + 記貨單)

## Cases
- F1–F5 舉旗大賽（取代第1關攪咖啡；`stirCoffee` 保留）
- M1–M4 記貨單（第7關 Boss 前攤檔；會員中心金魚眼仍在）

## 2P note
暫無專用 2P 小遊戲按鍵分配；舉旗／記貨單均用 1P 鍵（←→／WASD／觸控）。

## Run
```
npx vite --host 127.0.0.1 --port 47461 --strictPort
node scripts/qa/minigames-prg.mjs
```

## Result
See `summary.json`. ok=true
