/**
 * Durable gallery unlocks — survive 「重新開始」wiping a run.
 * The /gallery/ page also merges live progress into this store.
 */
const KEY = 'sake-kuma-gallery-v1'

type GallerySave = {
  heroes: string[]
  friends: string[]
  enemies: string[]
  bosses: string[]
  scenes: string[]
  stories: string[]
}

function read(): GallerySave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<GallerySave>
    return {
      heroes: Array.isArray(raw.heroes) ? raw.heroes : [],
      friends: Array.isArray(raw.friends) ? raw.friends : [],
      enemies: Array.isArray(raw.enemies) ? raw.enemies : [],
      bosses: Array.isArray(raw.bosses) ? raw.bosses : [],
      scenes: Array.isArray(raw.scenes) ? raw.scenes : [],
      stories: Array.isArray(raw.stories) ? raw.stories : [],
    }
  } catch {
    return { heroes: [], friends: [], enemies: [], bosses: [], scenes: [], stories: [] }
  }
}

function write(data: GallerySave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* private mode */
  }
}

function add(list: string[], id: string) {
  if (id && !list.includes(id)) list.push(id)
}

const BOSS_BY_STAGE: Record<number, string> = {
  1: 'warriorking',
  2: 'queen',
  3: 'mirrorowl',
  4: 'mudmane',
  5: 'triboss',
  6: 'mall-scrubber',
  7: 'trainer',
  8: 'researcher',
  9: 'warden',
  10: 'leon',
}

/** Call when the player reaches / enters a stage. */
export function galleryMarkStageEnter(stage: number) {
  const g = read()
  add(g.scenes, `scene-${stage}`)
  write(g)
}

/** Call when a stage is cleared (boss down / go-next). */
export function galleryMarkStageClear(stage: number) {
  const g = read()
  add(g.scenes, `scene-${stage}`)
  const boss = BOSS_BY_STAGE[stage]
  if (boss) add(g.bosses, boss)
  write(g)
}

export function galleryMarkFriend(id: string) {
  const g = read()
  add(g.friends, id)
  write(g)
}

export function galleryMarkStory(id: string) {
  const g = read()
  add(g.stories, id)
  write(g)
}

export function galleryMarkEnemy(id: string) {
  const g = read()
  add(g.enemies, id)
  write(g)
}

export function galleryMarkC2Ending() {
  const g = read()
  for (let i = 1; i <= 10; i++) add(g.stories, `ending-c2-${String(i).padStart(2, '0')}`)
  write(g)
}
