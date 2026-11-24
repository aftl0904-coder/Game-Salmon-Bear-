# Quiz batch3+4 lint blockers

工單要求：lint 唔過就列 id，唔好自己改寫。

## quiz-option-lint（8 錯）

- **mall-15** `ban-prompt` — 收銀區每分鐘到達18人，3個櫃位各每分鐘服務5人；忽略隨機波動，隊伍每分鐘淨增加幾多人？
- **mall-33** `ban-prompt` — 兩個租戶方案的年租收入均為120萬元；甲有20%機率全年收不到租，乙有5%機率全年收不到租，其餘情況全收，忽略其他差異。乙的期望年收租較甲高幾多？
- **mall-35** `length` — lengths 4,1,3,1 (max/min > 3)
- **hard-13** `length` — lengths 7,7,7,2 (max/min > 3)
- **iq-09** `length` — lengths 1,1,1,10 (max/min > 3)
- **iq-13** `length` — lengths 2,1,2,5 (max/min > 3)
- **iq-20** `ban-prompt` — 工作可任意分割，每人效率相同且固定，沒有協作損耗；6人8日完成。先由4人做3日，餘下改由6人做，總共幾日完成？
- **iq-32** `length` — lengths 1,1,1,4 (max/min > 3)

## grep 睇樓（預存，非今批 rewritten）

- Q014
- dev-68
