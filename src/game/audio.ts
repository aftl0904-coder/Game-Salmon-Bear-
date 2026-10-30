import { buzz, HAPTIC } from './phone'
/**
 * Warm riverside BGM + soft SFX (Flash / phone-game feel — not MIDI chip square).
 * Original WebAudio composition; no copyright samples.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
/** Scheduled BGM sources (pruned as they finish; stopped on song change). */
let bgmNodes: Array<{ n: AudioScheduledSourceNode; end: number }> = []
let bgmPlaying = false
let muted = false
let bgmTimer: number | null = null
/** Suppress loop BGM while fanfare plays. */
let fanfareUntil = 0

const MUTE_KEY = 'sake-kuma-muted'

try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  /* ignore */
}

export function isMuted() {
  return muted
}

/** Mute / unmute SFX + BGM. Persists in localStorage. */
export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (master) {
    master.gain.value = muted ? 0 : 0.42
  }
  if (muted) stopBgm()
  else {
    ensureRunning()
    startBgm()
  }
}

export function toggleMute() {
  setMuted(!muted)
  return muted
}

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.42
    master.connect(ctx.destination)
  }
  return ctx
}

function ensureRunning() {
  const c = ac()
  if (c.state === 'suspended') void c.resume()
  return c
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.22,
  slideTo?: number,
  delay = 0,
) {
  if (muted) return
  const c = ensureRunning()
  const t0 = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo != null) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
  }
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(master!)
  o.start(t0)
  o.stop(t0 + dur + 0.04)
}

function noise(dur: number, vol = 0.12, delay = 0, freq = 1400) {
  if (muted) return
  const c = ensureRunning()
  const t0 = c.currentTime + delay
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(master!)
  src.start(t0)
  src.stop(t0 + dur + 0.03)
}

/** Soft voice-ish formant — hurt / die (warm, not chip). */
function voiceUh(kind: 'hurt' | 'die') {
  if (muted) return
  const c = ensureRunning()
  const t0 = c.currentTime
  const o = c.createOscillator()
  const o2 = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o2.type = 'triangle'
  if (kind === 'hurt') {
    o.frequency.setValueAtTime(210, t0)
    o.frequency.exponentialRampToValueAtTime(130, t0 + 0.2)
    o2.frequency.setValueAtTime(420, t0)
    o2.frequency.exponentialRampToValueAtTime(260, t0 + 0.2)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24)
    o.start(t0)
    o2.start(t0)
    o.stop(t0 + 0.28)
    o2.stop(t0 + 0.28)
  } else {
    o.frequency.setValueAtTime(170, t0)
    o.frequency.exponentialRampToValueAtTime(65, t0 + 0.6)
    o2.frequency.setValueAtTime(255, t0)
    o2.frequency.exponentialRampToValueAtTime(85, t0 + 0.6)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7)
    o.start(t0)
    o2.start(t0)
    o.stop(t0 + 0.75)
    o2.stop(t0 + 0.75)
  }
  o.connect(g)
  o2.connect(g)
  g.connect(master!)
}

export const SFX = {
  jump: () => {
    tone(420, 0.1, 'triangle', 0.14, 280)
    tone(640, 0.06, 'sine', 0.08)
  },
  land: () => {
    noise(0.05, 0.1, 0, 600)
    tone(80, 0.06, 'sine', 0.1, 50)
  },
  swing: () => {
    noise(0.05, 0.1, 0, 1600)
    tone(260, 0.08, 'triangle', 0.12, 80)
  },
  /** Hit confirm: sharp transient + mid crunch + low body thump (three layers = "weight"). */
  hit: () => {
    noise(0.025, 0.22, 0, 3200)
    noise(0.06, 0.14, 0.005, 900)
    tone(190, 0.07, 'square', 0.12, 120)
    tone(70, 0.14, 'sine', 0.2, 40)
  },
  hurt: () => {
    buzz(HAPTIC.hurt)
    voiceUh('hurt')
    noise(0.05, 0.08, 0, 500)
  },
  die: () => {
    buzz(HAPTIC.die)
    voiceUh('die')
    tone(150, 0.4, 'sine', 0.1, 50)
    noise(0.12, 0.06, 0.1, 350)
  },
  spike: () => {
    noise(0.1, 0.12, 0, 600)
    tone(95, 0.14, 'triangle', 0.14, 40)
  },
  /** Enemy down: pop + falling sweep + a bright chime (reward). */
  kill: () => {
    buzz(HAPTIC.kill)
    noise(0.05, 0.16, 0, 1800)
    tone(420, 0.16, 'square', 0.07, 120)
    tone(988, 0.08, 'sine', 0.1, undefined, 0.06)
    tone(1318, 0.14, 'triangle', 0.08, undefined, 0.1)
  },
  boss: () => {
    buzz(HAPTIC.bossIn)
    tone(100, 0.3, 'triangle', 0.18, 50)
    tone(150, 0.24, 'sine', 0.1)
  },
  win: () => {
    const c = ensureRunning()
    fanfareUntil = c.currentTime + 3.2
    const notes: Array<[number, number, number]> = [
      [0.0, 523, 0.2],
      [0.18, 659, 0.2],
      [0.36, 784, 0.2],
      [0.54, 1046, 0.32],
      [0.95, 784, 0.16],
      [1.12, 880, 0.16],
      [1.3, 988, 0.16],
      [1.52, 1175, 0.38],
      [2.0, 1046, 0.22],
      [2.25, 1318, 0.5],
      [2.7, 1046, 0.55],
    ]
    for (const [d, f, dur] of notes) {
      tone(f, dur, 'sine', 0.14, undefined, d)
      tone(f * 1.5, dur * 0.9, 'triangle', 0.07, undefined, d)
    }
    noise(0.08, 0.05, 2.5, 1800)
  },
  lose: () => {
    SFX.die()
    tone(190, 0.45, 'triangle', 0.1, 65)
  },
  step: () => noise(0.022, 0.035, 0, 900),
  /** Footsteps by surface: grass (soft swish), wood (hollow knock), bark (dry tap). */
  stepOn: (surface: 'grass' | 'wood' | 'bark' = 'grass') => {
    if (surface === 'wood') {
      tone(230, 0.04, 'triangle', 0.05, 180)
      noise(0.015, 0.03, 0, 1200)
    } else if (surface === 'bark') {
      noise(0.02, 0.05, 0, 2200)
      tone(150, 0.03, 'triangle', 0.03)
    } else {
      noise(0.03, 0.035, 0, 2600)
    }
  },
  coin: () => {
    tone(988, 0.08, 'sine', 0.12)
    tone(1480, 0.14, 'triangle', 0.09)
  },
  /** 金鮭 weapon level up — rising arpeggio. */
  powerUp: () => {
    buzz(HAPTIC.power)
    const f = [523, 659, 784, 1046, 1318]
    f.forEach((hz, i) => tone(hz, 0.09, 'square', 0.06, undefined, i * 0.055))
    tone(1568, 0.3, 'triangle', 0.08, undefined, 0.28)
  },
  /** Weapon level lost on hit — falling triad. */
  powerDown: () => {
    ;[784, 622, 466].forEach((hz, i) => tone(hz, 0.1, 'square', 0.05, hz * 0.9, i * 0.07))
  },
  /** Paper lantern torn open. */
  paperTear: () => {
    noise(0.09, 0.14, 0, 2600)
    noise(0.06, 0.08, 0.05, 1800)
  },
  /** Clay pot shatters. */
  potShatter: () => {
    noise(0.05, 0.16, 0, 3200)
    tone(1200, 0.05, 'triangle', 0.06, 900, 0.02)
    tone(1650, 0.04, 'triangle', 0.05, undefined, 0.06)
    noise(0.08, 0.06, 0.07, 1400)
  },
  /** Crusher: chain rattle before the drop. */
  chain: () => {
    for (let i = 0; i < 4; i++) tone(1900 + i * 140, 0.025, 'square', 0.03, undefined, i * 0.05)
  },
  /** Dialogue typewriter blip — each speaker has their own pitch. */
  blip: (hz = 520) => tone(hz, 0.035, 'square', 0.035),
  /** Horror sting: low detuned drone + high scrape (triangle shadow). */
  dread: () => {
    tone(55, 2.2, 'sawtooth', 0.07, 49)
    tone(58, 2.2, 'sawtooth', 0.05, 52)
    tone(1760, 1.4, 'sine', 0.02, 1650, 0.3)
    noise(1.2, 0.04, 0.2, 300)
  },
  /** Gulp (噗噗 drinks honey). */
  gulp: () => {
    tone(180, 0.09, 'sine', 0.14, 320)
    tone(200, 0.09, 'sine', 0.12, 360, 0.16)
  },
  /** Soft magical sparkle (real honey). */
  sparkle: () => {
    ;[1318, 1568, 1976, 2637].forEach((hz, i) => tone(hz, 0.16, 'sine', 0.05, undefined, i * 0.07))
  },
  /** Crusher slams the floor. */
  slam: () => {
    noise(0.14, 0.2, 0, 500)
    tone(70, 0.22, 'sine', 0.22, 40)
  },
  continue: () => {
    tone(523, 0.09, 'sine', 0.12)
    tone(784, 0.12, 'triangle', 0.1)
    tone(1046, 0.18, 'sine', 0.1, undefined, 0.1)
  },
  /** Boss alarm: three rising-falling square sweeps. */
  siren: () => {
    for (let i = 0; i < 3; i++) {
      tone(440, 0.26, 'square', 0.07, 880, i * 0.55)
      tone(880, 0.26, 'square', 0.07, 440, i * 0.55 + 0.27)
    }
  },
  /** Score tally tick. */
  tick: () => tone(1320, 0.03, 'square', 0.04),
  /** Rank stamp thud + sparkle. */
  stamp: () => {
    noise(0.08, 0.2, 0, 500)
    tone(90, 0.2, 'sine', 0.2, 50)
    tone(1568, 0.25, 'triangle', 0.08, undefined, 0.12)
  },
}

// ── Chiptune sequencer (original compositions, synthesised live) ─────────────
//
// Each song is a set of step strings (one token per 16th note):
//   note "A5" / "C#6" / "Bb4" starts a note · "-" holds it · "." is a rest.
//   drums: "k" kick · "s" snare · "h" closed hat · "o" open hat · "." rest.
// Bass and arpeggio lines are generated from the chord list (one chord per bar).

export type SongId =
  | 'title'
  | 'stage1'
  | 'ambush'
  | 'stage2'
  | 'boss2'
  | 'stage3'
  | 'boss3'
  | 'stage4'
  | 'boss4'
  | 'stage5'
  | 'boss5'
  | 'ending'
  | 'sad'
  | 'story'
  | 'victory'
type Song = {
  bpm: number
  chords: string[]
  lead: string
  drums: string[]
  /** Bars (by index) that get the 16th-note arpeggio layer. */
  arpBars?: number[]
  bassStyle: 'walk' | 'drive' | 'pad'
  leadWave: 'pulse25' | 'pulse12' | 'triangle'
  vol: number
  /** Bars where a second voice harmonises the lead (nearest chord tone ≥ a minor third below). */
  harmBars?: number[]
  /** Bars that get a soft sustained chord pad ("strings"). */
  padBars?: number[]
}

const NOTE_IDX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
function noteHz(tok: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok)
  if (!m) return 0
  let n = NOTE_IDX[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  const oct = Number(m[3])
  n += (oct + 1) * 12
  return 440 * Math.pow(2, (n - 69) / 12)
}
/** Chord name → triad note names at a given octave. "Bm", "F#m", "A", "Em", "G", "D", "Asus". */
function chordTones(ch: string, oct: number): number[] {
  const m = /^([A-G][#b]?)(m|sus)?$/.exec(ch)
  if (!m) return []
  const root = noteHz(`${m[1]}${oct}`)
  const third = m[2] === 'm' ? 3 : m[2] === 'sus' ? 5 : 4
  return [root, root * Math.pow(2, third / 12), root * Math.pow(2, 7 / 12)]
}
function tokens(src: string): string[] {
  return src.split(/[\s|]+/).filter(Boolean)
}

const SONGS: Record<SongId, Song> = {
  // 標題：期待、溫暖 (100 BPM)
  title: {
    bpm: 100,
    chords: ['D', 'G', 'Bm', 'A', 'D', 'G', 'Em', 'A'],
    lead: `
      F#5 - - - A5 - - - D6 - - - - - C#6 -   | B5 - - - G5 - - - D5 - - - - - . .
      F#5 - - - A5 - - - B5 - - - A5 - F#5 -   | E5 - - - - - - - C#5 - E5 - A5 - - -
      F#5 - - - A5 - - - D6 - - - E6 - F#6 -   | G6 - - - F#6 - E6 - D6 - - - B5 - - -
      G5 - - - B5 - - - E6 - - - D6 - B5 -     | A5 - - - - - - - - - - - . . . .`,
    drums: ['k . . . h . . . s . . . h . . .', 'k . . . h . k . s . . . h . h .'],
    arpBars: [4, 5, 6, 7],
    bassStyle: 'pad',
    leadWave: 'pulse25',
    harmBars: [2, 3, 6, 7],
    padBars: [0, 1, 2, 3, 4, 5, 6, 7],
    vol: 0.9,
  },
  // 第 1 關・百畝樹林：輕快、少少不安 (120 BPM)，C 段轉小調
  stage1: {
    bpm: 120,
    chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A', 'Bm', 'F#m', 'G', 'A'],
    lead: `
      F#5 - A5 - D6 - A5 - B5 - A5 - F#5 - - -   | D5 - F#5 - B5 - - - A5 - F#5 - D5 - E5 -
      G5 - B5 - D6 - E6 - D6 - B5 - G5 - A5 -    | A5 - - - E5 - A5 - C#6 - B5 - A5 - - -
      F#5 - A5 - D6 - E6 - F#6 - E6 - D6 - A5 -  | B5 - - - A5 - F#5 - A5 - B5 - D6 - - -
      E6 - D6 - B5 - G5 - E5 - G5 - B5 - - -     | A5 - G5 - F#5 - E5 - C#5 - E5 - A5 - - -
      B4 - D5 - F#5 - G5 - F#5 - D5 - B4 - - -   | C#5 - F#5 - A5 - - - G#5 - F#5 - F5 - F#5 -
      G5 - - - B5 - D6 - C6 - B5 - A5 - G5 -     | A5 - - - - - - - E5 - G5 - A5 - C#6 -`,
    drums: [
      'k . h . s . h . k . h k s . h .',
      'k . h . s . h . k . h . s . o .',
      'k . h . s . h . k . h k s . h .',
      'k . h . s . h k k . h . s s s s',
    ],
    arpBars: [4, 5, 6, 7, 8, 9, 10, 11],
    bassStyle: 'walk',
    leadWave: 'pulse25',
    harmBars: [2, 3, 6, 7, 10, 11],
    padBars: [8, 9, 10, 11],
    vol: 1,
  },
  // 祭壇伏兵 / Boss：壓迫 (138 BPM)，B 小調
  ambush: {
    bpm: 138,
    chords: ['Bm', 'Bm', 'G', 'F#', 'Bm', 'Bm', 'G', 'A', 'Em', 'Bm', 'C', 'F#'],
    lead: `
      B5 - . B5 . . D6 - C#6 - . A5 - - . .     | B5 - . B5 . . F#6 - E6 - D6 - C#6 - . .
      D6 - . D6 . . B5 - G5 - . B5 - D6 - .     | C#6 - - - A#5 - - - F#5 - - - - - . .
      B5 - . B5 . . D6 - C#6 - . A5 - - . .     | B5 - . B5 . . F#6 - G6 - F#6 - E6 - . .
      D6 - . D6 . . B5 - G5 - . B5 - D6 - .     | E6 - - - C#6 - - - A5 - - - - - . .
      G5 - B5 - E6 - - - D6 - B5 - G5 - . .     | F#5 - B5 - D6 - - - C#6 - B5 - F#5 - . .
      E5 - G5 - C6 - - - B5 - G5 - E5 - . .     | F#5 - - - A#5 - - - C#6 - - - F#6 - - -`,
    drums: ['k . h k s . h . k k h . s . h h', 'k . h k s . h . k k h . s s s s'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bassStyle: 'drive',
    leadWave: 'pulse12',
    harmBars: [4, 5, 6, 7, 8, 9, 10, 11],
    vol: 1,
  },
  // 第 2 關・蜜樹丘：好奇、有啲壓迫 (112 BPM)，E 小調，薄身 12.5% 方波似蜜蜂嗡嗡
  stage2: {
    bpm: 112,
    chords: ['Em', 'Em', 'C', 'B', 'Em', 'Em', 'Am', 'B', 'C', 'D', 'Bm', 'Em'],
    lead: `
      E5 - - G5 F#5 - E5 - B4 - - - . . E5 F#5   | G5 - - B5 A5 - G5 - F#5 - - - E5 - - -
      E5 - G5 - C6 - B5 - A5 - G5 - E5 - - -   | D#5 - F#5 - B5 - - - A5 - F#5 - D#5 - - -
      E5 - - G5 F#5 - E5 - B4 - - - . . E5 F#5   | G5 - - B5 A5 - G5 - B5 - - - E6 - - -
      C6 - B5 - A5 - E5 - C5 - E5 - A5 - - -   | B5 - - - A5 - G5 - F#5 - - - D#5 - - -
      G5 - - - E5 - G5 - C6 - - - B5 - A5 -   | F#5 - - - D5 - F#5 - A5 - - - G5 - F#5 -
      F#5 - - - D5 - B4 - D5 - F#5 - B5 - - -   | E5 - - - - - - - . . B4 - E5 - - -`,
    drums: ['k . . h s . . h k . h . s . . h', 'k . . h s . . h k . h k s . o .'],
    arpBars: [2, 3, 6, 7, 8, 9, 10, 11],
    bassStyle: 'walk',
    leadWave: 'pulse12',
    harmBars: [4, 5, 6, 7, 8, 9],
    padBars: [0, 1, 2, 3, 8, 9, 10, 11],
    vol: 0.95,
  },
  // 女王蜂 Boss：急、重 (150 BPM)，C 小調
  boss2: {
    bpm: 150,
    chords: ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'G', 'Fm', 'Cm', 'Ab', 'G'],
    lead: `
      C5 . C5 . Eb5 - G5 - C6 - . Bb5 - G5 - .   | C5 . C5 . Eb5 - G5 - Bb5 - Ab5 - G5 - Eb5 -
      Ab5 - - - C6 - Eb6 - D6 - C6 - Ab5 - - -   | Bb5 - - - D6 - F6 - Eb6 - D6 - Bb5 - - -
      C5 . C5 . Eb5 - G5 - C6 - . Bb5 - G5 - .   | C5 . C5 . Eb5 - G5 - C6 - D6 - Eb6 - - -
      C6 - Ab5 - Eb5 - Ab5 - C6 - Eb6 - D6 - C6 -   | B5 - - - D6 - G6 - F6 - D6 - B5 - G5 -
      F5 - Ab5 - C6 - - - Bb5 - Ab5 - F5 - - -   | Eb5 - G5 - C6 - - - Bb5 - G5 - Eb5 - - -
      Ab5 - C6 - Eb6 - - - D6 - C6 - Ab5 - - -   | G5 - - - B5 - - - D6 - - - G6 - - -`,
    drums: ['k . h k s . h k k . h k s . h h', 'k . h k s . h k k k h . s s s s'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bassStyle: 'drive',
    leadWave: 'pulse25',
    harmBars: [2, 3, 6, 7, 8, 9, 10, 11],
    vol: 1,
  },
  // 月影夜市：詭異，鐘聲（三角波）+ 突然靜默 (92 BPM)，D 小調
  stage3: {
    bpm: 92,
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'A', 'Bb', 'C', 'A', 'Dm'],
    lead: `
      D5 - - - F5 - A5 - D6 - - - C6 - A5 -   | A5 - - - - - - - . . . . . . . .
      Bb5 - - - A5 - G5 - F5 - - - D5 - - -   | E5 - - - C#5 - E5 - A5 - - - . . . .
      D5 - - - F5 - A5 - D6 - - - E6 - F6 -   | G5 - - - Bb5 - D6 - C6 - Bb5 - G5 - - -
      A5 - - - C#6 - E6 - A6 - - - . . . .   | . . . . . . . . E5 - F5 - G5 - A5 -
      Bb5 - - - D6 - - - F6 - - - D6 - Bb5 -   | C6 - - - E6 - - - G6 - - - E6 - C6 -
      C#6 - - - A5 - - - E5 - - - C#5 - - -   | D5 - - - - - - - . . . . . . . .`,
    drums: ['k . . . . . h . s . . . . . h .', 'k . . . . . h . s . . . k . . .'],
    arpBars: [0, 4, 5, 8, 9, 10],
    bassStyle: 'walk',
    leadWave: 'triangle',
    padBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    vol: 0.9,
  },
  // 月橋鏡鴞 Boss：華爾茲感（3+3+3+3+4）(138 BPM)，G 小調
  boss3: {
    bpm: 138,
    chords: ['Gm', 'Gm', 'Eb', 'D', 'Gm', 'Cm', 'D', 'D', 'Eb', 'F', 'D', 'Gm'],
    lead: `
      G5 - - Bb5 - - D6 - - G6 - - F6 - D6 -   | Eb6 - - D6 - - C6 - - Bb5 - - A5 - - -
      G5 - - Bb5 - - Eb6 - - D6 - - C6 - Bb5 -   | A5 - - F#5 - - A5 - - D6 - - C6 - A5 -
      G5 - - Bb5 - - D6 - - G6 - - A6 - Bb6 -   | C6 - - Eb6 - - G6 - - F6 - - Eb6 - C6 -
      D6 - - F#6 - - A6 - - F#6 - - D6 - - -   | A5 - - C6 - - D6 - - F#6 - - A6 - - -
      G6 - - Eb6 - - Bb5 - - G5 - - Bb5 - Eb6 -   | F6 - - C6 - - A5 - - F5 - - A5 - C6 -
      F#6 - - D6 - - A5 - - F#5 - - A5 - D6 -   | G5 - - - - - - - D6 - - - G6 - - -`,
    drums: ['k . . h . . s . . h . . k . h .', 'k . . h . . s . . h . . s s s .'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bassStyle: 'drive',
    leadWave: 'pulse25',
    harmBars: [4, 5, 6, 7, 8, 9, 10, 11],
    vol: 1,
  },
  // 第 4 關・鹽霧工地：陰沉、工業感，雨聲底 (100 BPM)，F 小調
  stage4: {
    bpm: 100,
    chords: ['Fm', 'Db', 'Eb', 'Cm', 'Fm', 'Ab', 'Bb', 'Cm'],
    lead: `
      F5 - - - Ab5 - - - C6 - - - Bb5 - Ab5 -   | Gb5 - - - - - - - Eb5 - - - - - - -
      Eb5 - - - F5 - Ab5 - C6 - - - Bb5 - Ab5 -   | G5 - - - Eb5 - C5 - Eb5 - - - . . . .
      F5 - - - Ab5 - - - C6 - - - Db6 - C6 -   | Bb5 - - - Ab5 - Gb5 - Eb5 - - - . . . .
      Ab5 - - - C6 - - - Eb6 - - - Db6 - C6 -   | Bb5 - - - - - - - F5 - - - . . . .`,
    drums: ['k . h h s . h h k . h . s . h h', 'k h h h s . h h k . h h s h h h'],
    arpBars: [2, 3, 6, 7],
    bassStyle: 'walk',
    leadWave: 'triangle',
    padBars: [0, 1, 4, 5],
    vol: 0.9,
  },
  // 泥鬃 Boss：電單車衝撞，急躁 (144 BPM)，C 小調
  boss4: {
    bpm: 144,
    chords: ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Gm', 'Ab', 'Bb', 'Fm', 'Cm', 'Ab', 'Bb'],
    lead: `
      C5 . C5 . Eb5 - F5 - G5 - . Ab5 - G5 - .   | C5 . C5 . Eb5 - G5 - Bb5 - Ab5 - G5 - .
      Ab5 - - - C6 - Eb6 - D6 - C6 - Ab5 - - -   | Bb5 - - - D6 - F6 - Eb6 - D6 - Bb5 - - -
      C5 . C5 . Eb5 - F5 - G5 - . Ab5 - G5 - .   | G5 . G5 . Bb5 - D6 - C6 - Bb5 - G5 - .
      Ab5 - - - C6 - Eb6 - Bb5 - - - G5 - - -   | Bb5 - - - D6 - F6 - Eb6 - D6 - Bb5 - - -
      F5 - Ab5 - C6 - - - Bb5 - Ab5 - F5 - - -   | C5 - Eb5 - G5 - - - F5 - Eb5 - C5 - - -
      Ab5 - C6 - Eb6 - - - D6 - C6 - Ab5 - - -   | Bb5 - - - - - - - D6 - - - F6 - - -`,
    drums: ['k . h k s . h k k . h k s . h h', 'k k h k s . h k k k h . s s h h'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bassStyle: 'drive',
    leadWave: 'pulse12',
    harmBars: [4, 5, 6, 7, 8, 9, 10, 11],
    vol: 1,
  },
  // 第 5 關・△畝大廈：警報感、焦躁但唔亂 (128 BPM)，C 小調
  stage5: {
    bpm: 128,
    chords: ['Cm', 'Ab', 'Bb', 'Gm', 'Cm', 'Fm', 'Gm', 'Bb'],
    lead: `
      C5 - - - Eb5 - - - G5 - - - F5 - Eb5 -   | Ab4 - - - - - - - Bb4 - - - - - - -
      Bb4 - - - C5 - Eb5 - G5 - - - F5 - Eb5 -   | D5 - - - Bb4 - G4 - Bb4 - - - . . . .
      C5 - - - Eb5 - - - G5 - - - Ab5 - G5 -   | F5 - - - Eb5 - D5 - C5 - - - . . . .
      F5 - - - Ab5 - - - C6 - - - Bb5 - Ab5 -   | G5 - - - - - - - Bb4 - - - . . . .`,
    drums: ['k . h . s h h . k . h . s . h h', 'k h h . s h h . k . h h s h h .'],
    arpBars: [2, 3, 6, 7],
    bassStyle: 'drive',
    leadWave: 'pulse12',
    padBars: [0, 4],
    vol: 0.92,
  },
  // △畝大佬 Boss：三段變奏，由沉著到暴走 (150 BPM)，C 小調
  boss5: {
    bpm: 150,
    chords: ['Cm', 'Cm', 'Ab', 'Bb', 'Gm', 'Gm', 'Ab', 'Bb', 'Fm', 'Cm', 'Gm', 'Bb'],
    lead: `
      C5 . C5 . Eb5 - F5 - G5 - . Ab5 - G5 - .   | C5 . C5 . Eb5 - G5 - Bb5 - Ab5 - G5 - .
      G4 . G4 . Bb4 - C5 - D5 - . Eb5 - D5 - .   | G4 . G4 . Bb4 - D5 - F5 - Eb5 - D5 - .
      Ab5 - - - C6 - Eb6 - D6 - C6 - Ab5 - - -   | Bb5 - - - D6 - F6 - Eb6 - D6 - Bb5 - - -
      F5 - Ab5 - C6 - - - Bb5 - Ab5 - F5 - - -   | C5 - Eb5 - G5 - - - F5 - Eb5 - C5 - - -
      Ab5 - - - C6 - Eb6 - - - D6 - C6 - Ab5 - -   | Bb5 - - - - - - - D6 - - - F6 - - -
      C5 . C5 . Eb5 - F5 - G5 - . Ab5 - G5 - .   | Bb5 - - - - - - - - - - - . . . .`,
    drums: ['k . h k s . h k k . h k s . h h', 'k k h k s . h k k k h . s s h h'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bassStyle: 'drive',
    leadWave: 'pulse12',
    harmBars: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    vol: 1,
  },
  // 悲傷：噗噗變灰 (72 BPM)，A 小調，三角波主旋律 + 琶音
  sad: {
    bpm: 72,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'E'],
    lead: `
      A4 - - - C5 - - - E5 - - - D5 - C5 -   | C5 - - - A4 - - - F4 - - - - - - -
      E4 - - - G4 - - - C5 - - - B4 - A4 -   | B4 - - - - - - - G4 - - - - - - -
      A4 - - - C5 - - - E5 - - - A5 - G5 -   | F5 - - - E5 - - - D5 - - - C5 - - -
      B4 - - - G#4 - - - E4 - - - - - - -   | E4 - - - - - - - . . . . . . . .`,
    drums: ['. . . . . . . . . . . . . . . .'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7],
    bassStyle: 'pad',
    leadWave: 'triangle',
    vol: 0.85,
    padBars: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  // 過場：溫暖、有希望 (92 BPM)，F 大調
  story: {
    bpm: 92,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
    lead: `
      A5 - - - G5 - F5 - C5 - - - F5 - G5 -   | E5 - - - - - G5 - C6 - - - - - - -
      D5 - - - F5 - A5 - D6 - C6 - A5 - - -   | Bb5 - - - A5 - G5 - F5 - - - - - - -
      A5 - - - G5 - F5 - C5 - - - F5 - A5 -   | G5 - - - E5 - C5 - E5 - G5 - C6 - - -
      D6 - - - C6 - Bb5 - A5 - - - G5 - - -   | G5 - - - - - - - E5 - - - C5 - - -`,
    drums: ['k . . . h . . . s . . . h . . .', 'k . . . h . . k s . . . h . . .'],
    arpBars: [4, 5, 6, 7],
    bassStyle: 'walk',
    leadWave: 'pulse25',
    vol: 0.85,
    harmBars: [4, 5, 6, 7],
    padBars: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  // 勝利：通關 (132 BPM)，D 大調
  victory: {
    bpm: 132,
    chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'],
    lead: `
      D5 . D5 . D5 . F#5 - A5 - - - D6 - - -   | B5 - - - A5 - G5 - B5 - - - D6 - - -
      C#6 - - - B5 - A5 - E5 - F#5 - G5 - E5 -   | D6 - - - - - - - A5 - - - F#5 - A5 -
      B5 - - - A5 - F#5 - D5 - F#5 - B5 - - -   | D6 - - - B5 - G5 - B5 - D6 - G6 - - -
      E6 - - - C#6 - A5 - C#6 - E6 - G6 - F#6 -   | F#6 - - - - - - - D6 - - - . . . .`,
    drums: ['k . h . s . h . k . h k s . h .', 'k . h . s . h . k k h . s s s s'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7],
    bassStyle: 'drive',
    leadWave: 'pulse25',
    vol: 1,
    harmBars: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  // 結局：溫暖慢版，重用標題旋律 (72 BPM)，D 大調
  ending: {
    bpm: 72,
    chords: ['D', 'G', 'Bm', 'A', 'D', 'G', 'Em', 'A'],
    lead: `
      F#5 - - - A5 - - - D6 - - - - - C#6 -   | B5 - - - G5 - - - D5 - - - - - . .
      F#5 - - - A5 - - - B5 - - - A5 - F#5 -   | E5 - - - - - - - C#5 - E5 - A5 - - -
      F#5 - - - A5 - - - D6 - - - E6 - F#6 -   | G6 - - - F#6 - E6 - D6 - - - B5 - - -
      G5 - - - B5 - - - E6 - - - D6 - B5 -     | A5 - - - - - - - - - - - . . . .`,
    drums: ['. . . . . . . . . . . . . . . .'],
    arpBars: [0, 1, 2, 3, 4, 5, 6, 7],
    bassStyle: 'pad',
    leadWave: 'triangle',
    harmBars: [2, 3, 6, 7],
    padBars: [0, 1, 2, 3, 4, 5, 6, 7],
    vol: 0.85,
  },
}

let currentSong: SongId = 'title'
let songStep = 0
let songNextTime = 0
const waveCache = new Map<string, PeriodicWave>()

function pulseWave(c: AudioContext, duty: number): PeriodicWave {
  const key = `p${duty}`
  const hit = waveCache.get(key)
  if (hit) return hit
  const n = 32
  const real = new Float32Array(n)
  const imag = new Float32Array(n)
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty)
  const w = c.createPeriodicWave(real, imag)
  waveCache.set(key, w)
  return w
}

/**
 * Music bus with an SNES-style echo (the SPC700's feedback delay): every song voice goes
 * through a short filtered delay that repeats and darkens — the "big room" chip sound.
 */
let musicBus: GainNode | null = null
function bus(c: AudioContext): AudioNode {
  if (!musicBus) {
    musicBus = c.createGain()
    musicBus.connect(master!)
    const d = c.createDelay(1)
    d.delayTime.value = 0.21
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2400
    const fb = c.createGain()
    fb.gain.value = 0.34
    const wet = c.createGain()
    wet.gain.value = 0.3
    musicBus.connect(d)
    d.connect(lp)
    lp.connect(fb)
    fb.connect(d)
    lp.connect(wet)
    wet.connect(master!)
  }
  return musicBus
}

function voice(c: AudioContext, wave: Song['leadWave'] | 'triangle' | 'square', hz: number, t: number, dur: number, vol: number, opts: { vibrato?: boolean; decay?: boolean } = {}) {
  if (!master || hz <= 0) return
  const o = c.createOscillator()
  const g = c.createGain()
  if (wave === 'pulse25') o.setPeriodicWave(pulseWave(c, 0.25))
  else if (wave === 'pulse12') o.setPeriodicWave(pulseWave(c, 0.125))
  else o.type = wave
  o.frequency.setValueAtTime(hz, t)
  if (opts.vibrato && dur > 0.3) {
    const lfo = c.createOscillator()
    const lg = c.createGain()
    lfo.frequency.value = 5.5
    lg.gain.setValueAtTime(0, t)
    lg.gain.linearRampToValueAtTime(hz * 0.012, t + dur)
    lfo.connect(lg)
    lg.connect(o.frequency)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)
    bgmNodes.push({ n: lfo, end: t + dur + 0.05 })
  }
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  if (opts.decay) g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.35), t + Math.min(dur, 0.25))
  g.gain.setValueAtTime(opts.decay ? Math.max(0.0002, vol * 0.35) : vol, t + Math.max(0.01, dur - 0.03))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(bus(c))
  o.start(t)
  o.stop(t + dur + 0.02)
  bgmNodes.push({ n: o, end: t + dur + 0.02 })
}

function drum(c: AudioContext, kind: string, t: number, vol: number) {
  if (!master) return
  if (kind === 'k') {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    g.gain.setValueAtTime(0.32 * vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.18)
    bgmNodes.push({ n: o, end: t + 0.18 })
    return
  }
  const len = kind === 's' ? 0.13 : kind === 'o' ? 0.18 : 0.035
  const n = Math.floor(c.sampleRate * len)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = kind === 's' ? 'bandpass' : 'highpass'
  f.frequency.value = kind === 's' ? 1800 : 7000
  const g = c.createGain()
  const v = (kind === 's' ? 0.16 : kind === 'o' ? 0.05 : 0.04) * vol
  g.gain.setValueAtTime(v, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  src.connect(f)
  f.connect(g)
  g.connect(master)
  src.start(t)
  src.stop(t + len + 0.01)
  bgmNodes.push({ n: src, end: t + len + 0.01 })
  if (kind === 's') {
    // Tonal body under the snare noise.
    const o = c.createOscillator()
    const og = c.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(140, t + 0.06)
    og.gain.setValueAtTime(0.08 * vol, t)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    o.connect(og)
    og.connect(master)
    o.start(t)
    o.stop(t + 0.1)
    bgmNodes.push({ n: o, end: t + 0.1 })
  }
}

function scheduleSong(c: AudioContext) {
  const song = SONGS[currentSong]
  const stepDur = 60 / song.bpm / 4
  const lead = tokens(song.lead)
  const total = song.chords.length * 16
  const horizon = c.currentTime + 0.35
  while (songNextTime < horizon) {
    const t = songNextTime
    const step = songStep % total
    const bar = Math.floor(step / 16)
    const inBar = step % 16
    const duck = (t < fanfareUntil ? 0.25 : 1) * (bgmDucked ? 0.3 : 1)
    const v = song.vol * duck
    // Lead: start a note and measure its held length.
    const tok = lead[step] ?? '.'
    if (tok !== '-' && tok !== '.') {
      let len = 1
      while (lead[(step + len) % total] === '-' && len < 32) len++
      const hz = noteHz(tok)
      voice(c, song.leadWave, hz, t, len * stepDur * 0.95, 0.09 * v, { vibrato: true })
      // Harmony: the nearest chord tone at least a minor third under the melody.
      if (song.harmBars?.includes(Math.floor(step / 16))) {
        const ch = song.chords[Math.floor(step / 16)] ?? song.chords[0]!
        const cands = [3, 4, 5].flatMap((o) => chordTones(ch, o)).filter((f) => f <= hz / Math.pow(2, 3 / 12) + 0.5)
        const h = cands.length ? Math.max(...cands) : 0
        if (h) voice(c, 'pulse12', h, t, len * stepDur * 0.9, 0.045 * v)
      }
      // Soft echo one octave down, an 8th later — gives the SNES "two channel" width.
      voice(c, 'triangle', noteHz(tok) / 2, t + stepDur * 2, Math.min(len, 3) * stepDur, 0.025 * v)
    }
    // Bass from the chord.
    const chord = song.chords[bar] ?? song.chords[0]!
    const [r, , fifth] = chordTones(chord, 2)
    if (r) {
      if (song.bassStyle === 'walk' && inBar % 2 === 0) {
        const pat = [r, 0, r * 2, 0, fifth!, 0, r * 2, 0, r, 0, r * 2, 0, fifth!, 0, r * 2, r * 1.122]
        const hz = pat[inBar]!
        if (hz) voice(c, 'triangle', hz, t, stepDur * 1.8, 0.13 * v)
      } else if (song.bassStyle === 'drive') {
        voice(c, 'triangle', inBar % 4 === 2 ? r * 2 : r, t, stepDur * 0.9, 0.13 * v)
      } else if (song.bassStyle === 'pad' && inBar % 8 === 0) {
        voice(c, 'triangle', r, t, stepDur * 7.5, 0.1 * v)
      }
      // Pad: soft sustained triad across the bar.
      if (song.padBars?.includes(bar) && inBar === 0) {
        for (const f of chordTones(chord, 3)) voice(c, 'square', f, t, stepDur * 15.5, 0.012 * v)
      }
      // Arpeggio layer (quiet 12.5% pulse, chord tones up and down).
      if (song.arpBars?.includes(bar)) {
        const tones = chordTones(chord, 4)
        const seq = [0, 1, 2, 1]
        voice(c, 'pulse12', tones[seq[inBar % 4]!]!, t, stepDur * 0.8, 0.022 * v, { decay: true })
      }
    }
    // Drums: pattern per bar (cycled).
    const pat = tokens(song.drums[bar % song.drums.length]!)
    const d = pat[inBar] ?? '.'
    if (d !== '.') drum(c, d, t, duck)
    songStep++
    songNextTime += stepDur
  }
}

let bgmDucked = false
/** Pause screen: keep the song going but quiet. */
export function setBgmDucked(on: boolean) {
  bgmDucked = on
}

/** Start (or switch to) a song. Safe to call repeatedly with the same id. */
export function playSong(id: SongId) {
  if (muted) {
    currentSong = id
    return
  }
  if (bgmPlaying && currentSong === id) return
  stopBgm()
  currentSong = id
  const c = ensureRunning()
  bgmPlaying = true
  songStep = 0
  songNextTime = c.currentTime + 0.08
  const tick = () => {
    if (!bgmPlaying) return
    scheduleSong(c)
    const now = c.currentTime
    bgmNodes = bgmNodes.filter((x) => x.end > now)
    bgmTimer = window.setTimeout(tick, 100)
  }
  tick()
}

/** Resume whichever song is current (menus / unmute). */
export function startBgm() {
  playSong(currentSong)
}

export function stopBgm() {
  bgmPlaying = false
  for (const { n } of bgmNodes) {
    try {
      n.stop()
    } catch {
      /* already stopped */
    }
  }
  bgmNodes = []
  if (bgmTimer != null) {
    window.clearTimeout(bgmTimer)
    bgmTimer = null
  }
}

export function unlockAudio() {
  ensureRunning()
  startBgm()
}

/** Debug hook (bots / level meter): peak of the master output since the last call. */
let meter: AnalyserNode | null = null
export function debugPeak(): number {
  const c = ac()
  if (!meter) {
    meter = c.createAnalyser()
    meter.fftSize = 2048
    master!.connect(meter)
  }
  const buf = new Float32Array(meter.fftSize)
  meter.getFloatTimeDomainData(buf)
  let p = 0
  for (const v of buf) p = Math.max(p, Math.abs(v))
  return p
}
