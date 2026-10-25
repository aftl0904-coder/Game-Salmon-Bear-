/**
 * Warm riverside BGM + soft SFX (Flash / phone-game feel — not MIDI chip square).
 * Original WebAudio composition; no copyright samples.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bgmNodes: AudioNode[] = []
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
  continue: () => {
    tone(523, 0.09, 'sine', 0.12)
    tone(784, 0.12, 'triangle', 0.1)
    tone(1046, 0.18, 'sine', 0.1, undefined, 0.1)
  },
}

/**
 * Warm riverside pad BGM — soft sine/triangle, gentle pulse (phone/Flash vibe).
 */
export function startBgm() {
  if (bgmPlaying || muted) return
  const c = ensureRunning()
  bgmPlaying = true
  bgmNodes = []

  const tempo = 92
  const beat = 60 / tempo
  // Pentatonic riverside melody — slower, airy
  const melody: Array<[number, number]> = [
    [0, 392], [1.5, 440], [3, 523], [4.5, 494],
    [6, 440], [7.5, 392], [9, 349], [10.5, 392],
    [12, 440], [13.5, 523], [15, 587], [16.5, 523],
    [18, 494], [19.5, 440], [21, 392], [22.5, 349],
  ]
  const bass = [98, 98, 110, 98, 130.81, 123.47, 110, 98] as const
  const pads: Array<[number, number, number, number]> = [
    [0, 196, 247, 294],
    [8, 175, 220, 262],
    [16, 220, 277, 330],
  ]

  const scheduleLoop = (startAt: number) => {
    if (!bgmPlaying || !master) return
    const bar = beat * 24
    const duck = startAt < fanfareUntil
    const melVol = duck ? 0.015 : 0.055
    const bassVol = duck ? 0.012 : 0.045
    const padVol = duck ? 0.008 : 0.028

    for (const [i, r, third, fifth] of pads) {
      const t = startAt + i * beat
      for (const f of [r, third, fifth]) {
        const o = c.createOscillator()
        const g = c.createGain()
        o.type = 'sine'
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(padVol, t + 0.2)
        g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 7.5)
        o.connect(g)
        g.connect(master)
        o.start(t)
        o.stop(t + beat * 8)
        bgmNodes.push(o, g)
      }
    }
    for (const [i, f] of melody) {
      const t = startAt + i * beat
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(melVol, t + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.2)
      o.connect(g)
      g.connect(master)
      o.start(t)
      o.stop(t + beat * 1.35)
      bgmNodes.push(o, g)
      const h = c.createOscillator()
      const hg = c.createGain()
      h.type = 'sine'
      h.frequency.value = f * 2
      hg.gain.setValueAtTime(0.0001, t)
      hg.gain.exponentialRampToValueAtTime(melVol * 0.25, t + 0.05)
      hg.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9)
      h.connect(hg)
      hg.connect(master)
      h.start(t)
      h.stop(t + beat)
      bgmNodes.push(h, hg)
    }
    for (let i = 0; i < bass.length; i++) {
      const t = startAt + i * beat * 3
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = bass[i]!
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(bassVol, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 2.4)
      o.connect(g)
      g.connect(master)
      o.start(t)
      o.stop(t + beat * 2.6)
      bgmNodes.push(o, g)
    }
    // Soft shaker pulse (not snare kit)
    for (let i = 0; i < 24; i += 2) {
      const t = startAt + i * beat
      const n = Math.floor(c.sampleRate * 0.04)
      const buf = c.createBuffer(1, n, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let k = 0; k < n; k++) data[k] = (Math.random() * 2 - 1) * (1 - k / n)
      const src = c.createBufferSource()
      src.buffer = buf
      const g = c.createGain()
      const f = c.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = i % 4 === 0 ? 900 : 1400
      g.gain.setValueAtTime(duck ? 0.015 : i % 4 === 0 ? 0.04 : 0.025, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
      src.connect(f)
      f.connect(g)
      g.connect(master)
      src.start(t)
      src.stop(t + 0.08)
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
