# QA — C2 bugs B1/B2/B3 (PR-I)

- **B1** scrubber attacks: PASS (≥3 attacks / 15s, warn telegraph, charge/acid −1 HP)
- **B2** stall over pit: PASS (stages 6–7 checkpoints on solid ground; stall triggers)
- **B3** air contact damage: PASS (side-bump damages; top-stomp safe; C1+C2)

Evidence: `b1-*.png`, `b2-stage{6,7}-checkpoints.png`, `b3-air-contact-c{1,2}.png`, `report.json`

Run: `npx vite --host 127.0.0.1 --port 47651` then `QA_PORT=47651 node scripts/qa/c2-bugs-b1-b3.mjs`
