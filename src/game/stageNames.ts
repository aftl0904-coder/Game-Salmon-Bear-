/** Stage names as shown on the HUD plaque, the world map banner, the clear card and the stage picker. */
export const STAGE_TITLES: Record<number, string> = {
  1: '第一關・百畝樹林',
  2: '第二關・蜜樹丘',
  3: '第三關・月影夜市',
  4: '第四關・鹽霧工地',
  5: '第五關・△畝大廈',
  6: '大陸2・第一關・購物中心',
  7: '大陸2・第二關・森友展銷中心',
  8: '大陸2・第三關・配方控制中心',
  9: '大陸2・第四關・地底監禁層',
  10: '大陸2・第五關・頂層控制室',
}

/** First stage that belongs to 第二大陸. */
export const C2_FIRST_STAGE = 6
const ORDINAL = '一二三四五六七八九十'

export function stageTitle(stage: number): string {
  const known = STAGE_TITLES[stage]
  if (known) return known
  if (stage >= C2_FIRST_STAGE) return `大陸2・第${ORDINAL[stage - C2_FIRST_STAGE] ?? stage - C2_FIRST_STAGE + 1}關`
  return STAGE_TITLES[1]!
}

/** 「第一關」 / 「大陸2・第一關」: the stage number part only (clear card heading). */
export function stageLabel(stage: number): string {
  const parts = stageTitle(stage).split('・')
  return parts.length >= 3 ? `${parts[0]}・${parts[1]}` : parts[0]!
}

/** Progressively shorter forms of a title for tight spots (phone HUD plaque): full, then without the place name. */
export function titleFallbacks(title: string): string[] {
  const parts = title.split('・')
  return parts.length >= 3 ? [title, `${parts[0]}・${parts[1]}`] : [title]
}
