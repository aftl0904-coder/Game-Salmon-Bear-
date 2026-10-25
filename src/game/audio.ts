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
  land: () => noise(0.05, 0.09, 0, 700),
  swing: () => {
    noise(0.05, 0.1, 0, 1600)
    tone(260, 0.08, 'triangle', 0.12, 80)
  },
  hit: () => {
    noise(0.04, 0.16, 0, 700)
    tone(170, 0.07, 'triangle', 0.2)
    tone(90, 0.11, 'sine', 0.12, 50)
  },
  hurt: () => {
    voiceUh('hurt')
    noise(0.05, 0.08, 0, 500)
  },
  die: () => {
    voiceUh('die')
    tone(150, 0.4, 'sine', 0.1, 50)
    noise(0.12, 0.06, 0.1, 350)
  },
  spike: () => {
    noise(0.1, 0.12, 0, 600)
    tone(95, 0.14, 'triangle', 0.14, 40)
  },
  kill: () => {
    tone(620, 0.07, 'sine', 0.12)
    tone(930, 0.12, 'triangle', 0.1, 400)
  },
  boss: () => {
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
  coin: () => {
    tone(988, 0.08, 'sine', 0.12)
    tone(1480, 0.14, 'triangle', 0.09)
  },
  /** 金鮭 weapon level up — rising arpeggio. */
  powerUp: () => {
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
}

// ── Chiptune sequencer (original compositions, synthesised live) ─────────────
//
// Each song is a set of step strings (one token per 16th note):
//   note "A5" / "C#6" / "Bb4" starts a note · "-" holds it · "." is a rest.
//   drums: "k" kick · "s" snare · "h" closed hat · "o" open hat · "." rest.
// Bass and arpeggio lines are generated from the chord list (one chord per bar).

export type SongId = 'title' | 'stage1' | 'ambush'
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
    vol: 1,
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
  g.connect(master)
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
    const duck = t < fanfareUntil ? 0.25 : 1
    const v = song.vol * duck
    // Lead: start a note and measure its held length.
    const tok = lead[step] ?? '.'
    if (tok !== '-' && tok !== '.') {
      let len = 1
      while (lead[(step + len) % total] === '-' && len < 32) len++
      voice(c, song.leadWave, noteHz(tok), t, len * stepDur * 0.95, 0.09 * v, { vibrato: true })
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
