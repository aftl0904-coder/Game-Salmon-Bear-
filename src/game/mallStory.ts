import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { GAME_W, GAME_H } from './display'
import { FONT_UI } from './ui/fonts'
import { TouchInput } from './touchInput'

type Line = readonly [string, string]
// Approved §4 full A–E and 6→7 dialogue; no seventh-stage or C1 ending text.
export const MALL_STORY: readonly (readonly Line[])[] = [
  [['倫寶', '嘩，呢度真係好大！'], ['琪寶寶', '點解啲保安都行過嚟？'], ['倫寶', '小心，我哋先睇清楚！']],
  [['倫寶', '噗噗，你聽到乜？'], ['琪寶寶', '入面好似有聲，我哋行近啲。'], ['倫寶', '小心前面嗰啲機械臂！']],
  [['琪寶寶', '咦？前面點解變咗工地？'], ['倫寶', '上面有碎石，小心！'], ['琪寶寶', '等佢落完，我哋再過去。']],
  [['琪寶寶', '嗰邊好似有個籠……'], ['倫寶', '噗噗都望住嗰邊。入面有乜？'], ['琪寶寶', '我哋再搵條路，睇清楚啲。']],
  [['倫寶', '個鏡頭望住我哋！'], ['琪寶寶', '佢郁緊，小心個轉刷！'], ['倫寶', '等佢停低，再搵空檔！']],
  [['琪寶寶', '頭先嗰啲聲，好似由前面傳嚟。'], ['倫寶', '森友展銷中心？我哋去睇下。']],
]

/** Dialogue overlays the real scene. Keyboard/touch advances; it also auto-advances. */
export function playMallDialogue(scene: Phaser.Scene, lines: readonly Line[], done: () => void): { destroy: () => void } {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 220)
  root.add(scene.add.rectangle(12, GAME_H - 102, GAME_W - 24, 90, 0x15151e, 0.96).setOrigin(0).setStrokeStyle(2, 0xe3bf73))
  const name = scene.add.text(28, GAME_H - 92, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffd982' })
  const body = scene.add.text(28, GAME_H - 68, '', { fontFamily: FONT_UI, fontSize: '17px', color: '#fff8e8', wordWrap: { width: GAME_W - 65 } })
  root.add([name, body, scene.add.text(GAME_W - 27, GAME_H - 28, '▼', { fontFamily: FONT_UI, fontSize: '12px', color: '#e0b86a' }).setOrigin(1)])
  let index = 0, dead = false
  let timer: Phaser.Time.TimerEvent
  const finish = () => {
    if (dead) return
    dead = true; timer?.remove(false); poll.remove(false)
    scene.input.keyboard?.off('keydown', onKey); scene.input.off('pointerdown', onTap)
    root.destroy(true); done()
  }
  const advance = () => {
    if (dead) return
    timer?.remove(false)
    if (index >= lines.length) return finish()
    const line = lines[index++]!
    name.setText(line[0]); body.setText(line[1])
    timer = scene.time.delayedCall(2800, advance)
  }
  const onKey = (e: KeyboardEvent) => {
    if (['f', 'j', ' ', 'g', 'k', 'Enter', 'Escape'].includes(e.key)) advance()
  }
  const onTap = () => advance()
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  const poll = scene.time.addEvent({ delay: 50, loop: true, callback: () => {
    if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump') || TouchInput.justPressed('start')) advance()
  } })
  advance()
  return { destroy: finish }
}
