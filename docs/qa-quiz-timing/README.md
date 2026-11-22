# QA — PR-H / T13_QUIZ_FIX

Fails: **0** / 17

```
PASS static-buzzOpen
PASS static-rival
PASS static-answer
PASS static-hard-notice
PASS static-hint
PASS static-no-bank-change
PASS static-debounce
PASS Q5-timing-table
PASS Q2-keyboard-cursor
PASS Q4-debounce
PASS Q6-rival-1p-min
PASS Q6-2p-no-rival-ui
PASS Q5-hard-notice-and-9800
PASS Q3-gamepad-sim
PASS Q7-stage7-quiz
PASS Q1-mobile-tap
PASS no-pageerror
```

Final numbers: buzz 6000/5400/4200; rival 3200/2900/2500; answer 6800/9800/rival1600; debounce 200ms.

Run: `URL=… OUT=docs/qa-quiz-timing node scripts/qa/quiz-timing.mjs`
