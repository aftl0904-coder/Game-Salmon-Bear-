# QA — C2 bugs B1/B2/B3/B6 (PR-I)

- B1 scrubber attacks: PASS
- B2 stall over pit: PASS
- B3 air contact damage: PASS
- B6 pit vs ground: PASS

Evidence: `b1-*.png`, `b2-stage{6,7}-checkpoints.png`, `b3-air-contact-c{1,2}.png`, `docs/qa-pit-contrast/`, `report.json`

Run: `npx vite --host 127.0.0.1 --port 47651` then `QA_PORT=47651 node scripts/qa/c2-bugs-b1-b3.mjs`
