/**
 * Self-made MIDI/chip WebAudio — Japanese riverside vibe (Goemon-ish),
 * SFX matched to on-screen meaning (no copyright assets).
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bgmNodes: AudioNode[] = []
let bgmPlaying = false
let muted = false
let bgmTimer: number | null = null
/** Suppress loop BGM while fanfare plays. */
let fanfareUntil = 0

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.45
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
  type: OscillatorType = 'square',
  vol = 0.28,
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
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(master!)
  o.start(t0)
  o.stop(t0 + dur + 0.03)
}

function noise(dur: number, vol = 0.16, delay = 0, freq = 1400) {
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

/** Soft “voice-ish” formant blip — painful uh / die moan (chip, not sample). */
function voiceUh(kind: 'hurt' | 'die') {
  if (muted) return
  const c = ensureRunning()
  const t0 = c.currentTime
  const o = c.createOscillator()
  const o2 = c.createOscillator()
  const g = c.createGain()
  o.type = 'sawtooth'
  o2.type = 'triangle'
  if (kind === 'hurt') {
    // Short painful “uh!”
    o.frequency.setValueAtTime(220, t0)
    o.frequency.exponentialRampToValueAtTime(140, t0 + 0.18)
    o2.frequency.setValueAtTime(440, t0)
    o2.frequency.exponentialRampToValueAtTime(280, t0 + 0.18)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
    o.start(t0)
    o2.start(t0)
    o.stop(t0 + 0.25)
    o2.stop(t0 + 0.25)
  } else {
    // Longer poor / sad die moan
    o.frequency.setValueAtTime(180, t0)
    o.frequency.exponentialRampToValueAtTime(70, t0 + 0.55)
    o2.frequency.setValueAtTime(270, t0)
    o2.frequency.exponentialRampToValueAtTime(90, t0 + 0.55)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65)
    o.start(t0)
    o2.start(t0)
    o.stop(t0 + 0.7)
    o2.stop(t0 + 0.7)
  }
  o.connect(g)
  o2.connect(g)
  g.connect(master!)
}

export const SFX = {
  /** Jump whoosh — rising chip */
  jump: () => {
    tone(480, 0.08, 'square', 0.2, 320)
    tone(720, 0.05, 'triangle', 0.1)
  },
  land: () => noise(0.05, 0.12, 0, 900),
  /** Attack swing / gun fire — sharp whoosh into hit ready */
  swing: () => {
    noise(0.05, 0.14, 0, 2200)
    tone(280, 0.07, 'sawtooth', 0.18, 90)
  },
  /** Solid hit — wooden/metal impact (hitting) */
  hit: () => {
    noise(0.045, 0.22, 0, 800)
    tone(180, 0.06, 'square', 0.28)
    tone(90, 0.1, 'triangle', 0.16, 50)
    tone(520, 0.04, 'square', 0.12)
  },
  /** Painful uh when hero is hurt */
  hurt: () => {
    voiceUh('hurt')
    noise(0.06, 0.1, 0, 600)
  },
  /** Poor / sad die effect */
  die: () => {
    voiceUh('die')
    tone(160, 0.35, 'triangle', 0.12, 55)
    noise(0.12, 0.08, 0.1, 400)
  },
  spike: () => {
    noise(0.1, 0.16, 0, 700)
    tone(100, 0.14, 'square', 0.18, 45)
  },
  kill: () => {
    tone(660, 0.06, 'square', 0.18)
    tone(990, 0.1, 'triangle', 0.14, 440)
  },
  boss: () => {
    tone(110, 0.28, 'sawtooth', 0.24, 55)
    tone(165, 0.22, 'square', 0.14)
  },
  /**
   * Stage clear — short congratulations fanfare (~3s), Japanese festival cadence.
   * Duck BGM briefly while it plays.
   */
  win: () => {
    const c = ensureRunning()
    fanfareUntil = c.currentTime + 3.2
    // Congrats phrase (major pentatonic climb + resolve)
    const notes: Array<[number, number, number]> = [
      [0.0, 523, 0.18],
      [0.16, 659, 0.18],
      [0.32, 784, 0.18],
      [0.48, 1046, 0.28],
      [0.85, 784, 0.14],
      [1.0, 880, 0.14],
      [1.15, 988, 0.14],
      [1.35, 1175, 0.35],
      [1.85, 1046, 0.2],
      [2.1, 1318, 0.45],
      [2.55, 1046, 0.5],
    ]
    for (const [d, f, dur] of notes) {
      tone(f, dur, 'square', 0.2, undefined, d)
      tone(f * 1.5, dur * 0.9, 'triangle', 0.1, undefined, d)
    }
    noise(0.08, 0.08, 2.5, 2000)
  },
  lose: () => {
    SFX.die()
    tone(200, 0.4, 'sawtooth', 0.12, 70)
  },
  step: () => noise(0.025, 0.05, 0, 1100),
  coin: () => {
    tone(988, 0.07, 'square', 0.16)
    tone(1480, 0.12, 'triangle', 0.12)
  },
  continue: () => {
    tone(523, 0.08, 'square', 0.18)
    tone(784, 0.1, 'triangle', 0.16)
    tone(1046, 0.16, 'square', 0.14, undefined, 0.09)
  },
}

/**
 * Japanese riverside stage BGM — shamisen-ish pentatonic melody + taiko pulse.
 * (Chip approximation; original composition, not a rip.)
 */
export function startBgm() {
  if (bgmPlaying || muted) return
  const c = ensureRunning()
  bgmPlaying = true
  bgmNodes = []

  const tempo = 118
  const beat = 60 / tempo
  // Min'yo-ish pentatonic (C D F G A) — warm festival walk
  const melody = [
    [0, 392],
    [1, 440],
    [2, 523],
    [3, 440],
    [4, 349],
    [5, 392],
    [6, 294],
    [7, 349],
    [8, 440],
    [9, 523],
    [10, 587],
    [11, 523],
    [12, 440],
    [13, 392],
    [14, 349],
    [15, 330],
  ] as const
  const bass = [196, 196, 175, 196, 220, 196, 165, 196] as const

  const scheduleLoop = (startAt: number) => {
    if (!bgmPlaying || !master) return
    const bar = beat * 16
    const duck = startAt < fanfareUntil
    const melVol = duck ? 0.02 : 0.085
    const bassVol = duck ? 0.015 : 0.05

    for (const [i, f] of melody) {
      const t = startAt + i * beat
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(melVol, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.8)
      o.connect(g)
      g.connect(master)
      o.start(t)
      o.stop(t + beat)
      bgmNodes.push(o, g)
      // light 5th harmony (koto-ish stack)
      const h = c.createOscillator()
      const hg = c.createGain()
      h.type = 'square'
      h.frequency.value = f * 1.498
      hg.gain.setValueAtTime(0.0001, t)
      hg.gain.exponentialRampToValueAtTime(melVol * 0.35, t + 0.02)
      hg.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.7)
      h.connect(hg)
      hg.connect(master)
      h.start(t)
      h.stop(t + beat)
      bgmNodes.push(h, hg)
    }
    for (let i = 0; i < bass.length; i++) {
      const t = startAt + i * beat * 2
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'square'
      o.frequency.value = bass[i]!
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(bassVol, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.5)
      o.connect(g)
      g.connect(master)
      o.start(t)
      o.stop(t + beat * 1.6)
      bgmNodes.push(o, g)
    }
    // Taiko-ish pulse on 1 & 3
    for (let i = 0; i < 16; i++) {
      if (i % 4 !== 0) continue
      const t = startAt + i * beat
      const n = Math.floor(c.sampleRate * 0.06)
      const buf = c.createBuffer(1, n, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let k = 0; k < n; k++) data[k] = (Math.random() * 2 - 1) * (1 - k / n)
      const src = c.createBufferSource()
      src.buffer = buf
      const g = c.createGain()
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = i % 8 === 0 ? 180 : 280
      g.gain.setValueAtTime(duck ? 0.03 : 0.1, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
      src.connect(f)
      f.connect(g)
      g.connect(master)
      src.start(t)
      src.stop(t + 0.1)
      bgmNodes.push(src, g)
    }
    const next = startAt + bar
    const waitMs = Math.max(0, (next - c.currentTime) * 1000 - 50)
    if (bgmTimer != null) window.clearTimeout(bgmTimer)
    bgmTimer = window.setTimeout(() => scheduleLoop(next), waitMs)
  }

  scheduleLoop(c.currentTime + 0.05)
}

export function stopBgm() {
  bgmPlaying = false
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
