/** Tiny WebAudio SFX + loop BGM — no asset files needed */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bgmNodes: AudioNode[] = []
let bgmPlaying = false
let muted = false

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.22
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
  vol = 0.2,
  slideTo?: number,
) {
  if (muted) return
  const c = ensureRunning()
  const t0 = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(master!)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function noise(dur: number, vol = 0.12) {
  if (muted) return
  const c = ensureRunning()
  const t0 = c.currentTime
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 1200
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(master!)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

export const SFX = {
  jump: () => tone(420, 0.09, 'square', 0.12, 280),
  land: () => noise(0.05, 0.08),
  swing: () => tone(180, 0.07, 'sawtooth', 0.1, 90),
  hit: () => {
    tone(520, 0.05, 'square', 0.14)
    tone(260, 0.08, 'triangle', 0.1)
  },
  hurt: () => tone(160, 0.18, 'sawtooth', 0.16, 70),
  spike: () => {
    noise(0.08, 0.1)
    tone(90, 0.12, 'square', 0.12, 40)
  },
  kill: () => {
    tone(600, 0.06, 'square', 0.12)
    tone(900, 0.1, 'triangle', 0.1, 400)
  },
  boss: () => {
    tone(100, 0.25, 'sawtooth', 0.18, 60)
    tone(150, 0.2, 'square', 0.1)
  },
  win: () => {
    // Clear fanfare — rising arcade jingle
    ;[392, 523, 659, 784, 1046, 1318].forEach((f, i) => {
      setTimeout(() => tone(f, 0.18, i % 2 ? 'triangle' : 'square', 0.16), i * 85)
    })
    setTimeout(() => {
      tone(1568, 0.35, 'triangle', 0.14)
      noise(0.08, 0.06)
    }, 520)
  },
  lose: () => tone(220, 0.35, 'sawtooth', 0.16, 80),
  step: () => noise(0.025, 0.035),
  coin: () => {
    tone(880, 0.06, 'square', 0.1)
    tone(1320, 0.1, 'triangle', 0.09)
  },
  continue: () => {
    // Punchy insert-coin sting
    tone(523, 0.07, 'square', 0.14)
    tone(784, 0.1, 'triangle', 0.13)
    setTimeout(() => tone(1046, 0.14, 'square', 0.12), 90)
  },
}

/** Simple 4-bar riverside chiptune loop */
export function startBgm() {
  if (bgmPlaying || muted) return
  const c = ensureRunning()
  bgmPlaying = true
  bgmNodes = []

  const tempo = 132
  const beat = 60 / tempo
  const pattern = [
    // melody-ish (pentatonic-ish warm)
    [0, 392],
    [1, 440],
    [2, 523],
    [3, 440],
    [4, 349],
    [5, 392],
    [6, 330],
    [7, 392],
    [8, 440],
    [9, 523],
    [10, 587],
    [11, 523],
    [12, 440],
    [13, 392],
    [14, 349],
    [15, 330],
  ] as const
  const bass = [196, 196, 220, 174, 196, 196, 165, 196] as const

  const scheduleLoop = (startAt: number) => {
    if (!bgmPlaying || !master) return
    const bar = beat * 16
    for (const [i, f] of pattern) {
      const t = startAt + i * beat
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.85)
      o.connect(g)
      g.connect(master)
      o.start(t)
      o.stop(t + beat)
      bgmNodes.push(o, g)
    }
    for (let i = 0; i < bass.length; i++) {
      const t = startAt + i * beat * 2
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'square'
      o.frequency.value = bass[i]!
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.028, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.5)
      o.connect(g)
      g.connect(master)
      o.start(t)
      o.stop(t + beat * 1.6)
      bgmNodes.push(o, g)
    }
    // soft pulse hat
    for (let i = 0; i < 16; i++) {
      const t = startAt + i * beat
      if (i % 2 !== 0) continue
      const n = Math.floor(c.sampleRate * 0.03)
      const buf = c.createBuffer(1, n, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let k = 0; k < n; k++) data[k] = Math.random() * 2 - 1
      const src = c.createBufferSource()
      src.buffer = buf
      const g = c.createGain()
      g.gain.setValueAtTime(0.02, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
      src.connect(g)
      g.connect(master)
      src.start(t)
      src.stop(t + 0.04)
      bgmNodes.push(src, g)
    }
    const next = startAt + bar
    const waitMs = Math.max(0, (next - c.currentTime) * 1000 - 50)
    window.setTimeout(() => scheduleLoop(next), waitMs)
  }

  scheduleLoop(c.currentTime + 0.05)
}

export function stopBgm() {
  bgmPlaying = false
  bgmNodes = []
}

export function unlockAudio() {
  ensureRunning()
  startBgm()
}
