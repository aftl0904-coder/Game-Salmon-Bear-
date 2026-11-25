/**
 * Stage 10 story pack — boss dialogue only for art-s9s10 / Leon reveal.
 * Lines stay verbatim from data/stage10-story.json.
 */
import storyRaw from '../../data/stage10-story.json'

type Pack = {
  bossDialogue: {
    leon: {
      preFight?: string[]
      phase2?: string
      postFight?: string[]
      defeatBanner?: string
    }
  }
}

const PACK = storyRaw as Pack

export function stage10BossDialogue() {
  return PACK.bossDialogue.leon
}
