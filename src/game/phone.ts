/**
 * Phone extras (Android Chrome first; everything degrades quietly elsewhere):
 *  - fullscreen + landscape lock on the first tap
 *  - haptics (navigator.vibrate)
 *  - motion: shake energy + tilt (devicemotion / deviceorientation)
 *  - microphone loudness: blowing (sustained wind noise) and shouting (short loud burst)
 *  - face-down detection (phone flipped onto the table)
 */

const PREF = 'sake-kuma-phone-v1'
type Prefs = { haptics: boolean; mic: boolean; tilt: boolean }

function loadPrefs(): Prefs {
  try {
    return { haptics: true, mic: false, tilt: false, ...JSON.parse(localStorage.getItem(PREF) ?? '{}') }
  } catch {
    return { haptics: true, mic: false, tilt: false }
  }
}
export const phonePrefs: Prefs = loadPrefs()
export function setPhonePref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  phonePrefs[k] = v
  try {
    localStorage.setItem(PREF, JSON.stringify(phonePrefs))
  } catch {
    /* private mode */
  }
}

export const isTouchDevice = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)

// ── Fullscreen ───────────────────────────────────────────────────────────

function wantFullscreen() {
  const d = document as Document & { webkitFullscreenElement?: Element }
  if (d.fullscreenElement || d.webkitFullscreenElement) return
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  const p = el.requestFullscreen?.({ navigationUI: 'hide' } as FullscreenOptions)
  if (p && typeof p.then === 'function') {
    p.then(() => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      o?.lock?.('landscape').catch(() => undefined)
    }).catch(() => undefined)
  } else el.webkitRequestFullscreen?.()
}

/** Phones go fullscreen + landscape on the first tap (and again after leaving it, on the next tap). */
export function installFullscreen() {
  if (!isTouchDevice()) return
  const go = () => wantFullscreen()
  document.addEventListener('pointerup', go, { passive: true })
  document.addEventListener('touchend', go, { passive: true })
}

// ── Haptics ──────────────────────────────────────────────────────────────

export function buzz(pattern: number | readonly number[]) {
  if (!phonePrefs.haptics) return
  try {
    navigator.vibrate?.(typeof pattern === "number" ? pattern : [...pattern])
  } catch {
    /* not allowed before a user gesture */
  }
}
export const HAPTIC = {
  hurt: 80,
  die: [120, 60, 240],
  kill: 18,
  bossIn: [90, 70, 90, 70, 260],
  honey: [40, 50, 40, 50, 160],
  power: [30, 40, 70],
  /** Slow heartbeat (噗噗 losing his colour). */
  heartbeat: [70, 140, 90, 900, 70, 140, 90, 900, 70, 140, 90, 900],
  click: 12,
} as const

// ── Motion ───────────────────────────────────────────────────────────────

let motionOn = false
let shakeEnergy = 0
let lastAcc: { x: number; y: number; z: number } | null = null
let gravity = { x: 0, y: 0, z: 9.8 }
let tiltX = 0
let faceDown = false
let motionSeen = false

function onMotion(e: DeviceMotionEvent) {
  const a = e.accelerationIncludingGravity
  if (!a || a.x === null || a.y === null || a.z === null) return
  motionSeen = true
  const cur = { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 }
  if (lastAcc) {
    const d = Math.abs(cur.x - lastAcc.x) + Math.abs(cur.y - lastAcc.y) + Math.abs(cur.z - lastAcc.z)
    if (d > 6) shakeEnergy += d
  }
  lastAcc = cur
  gravity = { x: gravity.x * 0.85 + cur.x * 0.15, y: gravity.y * 0.85 + cur.y * 0.15, z: gravity.z * 0.85 + cur.z * 0.15 }
  faceDown = gravity.z < -7.5
}
function onOrient(e: DeviceOrientationEvent) {
  // Landscape: the phone's beta axis is the steering one; flip the sign with the rotation direction.
  const ang = (screen.orientation?.angle ?? 0) as number
  const beta = e.beta ?? 0
  tiltX = ang === 270 || ang === -90 ? -beta : beta
}

/** Start listening (Android needs no permission; iOS asks once — must run inside a tap). */
export async function startMotion(): Promise<boolean> {
  if (motionOn) return true
  try {
    const DM = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof DM?.requestPermission === 'function') {
      const r = await DM.requestPermission()
      if (r !== 'granted') return false
    }
  } catch {
    return false
  }
  if (typeof window.DeviceMotionEvent === 'undefined') return false
  window.addEventListener('devicemotion', onMotion)
  window.addEventListener('deviceorientation', onOrient)
  motionOn = true
  return true
}
/** True once a real motion sample has arrived (desktops never send any). */
export const hasMotion = () => motionSeen
/** Shake energy gathered since the last call (0 when still). */
export function takeShake(): number {
  const v = shakeEnergy
  shakeEnergy = 0
  return v
}
/** Steering tilt in degrees (left −, right +). */
export const tilt = () => tiltX
export const isFaceDown = () => faceDown

// ── Microphone ───────────────────────────────────────────────────────────

let mic: { ctx: AudioContext; an: AnalyserNode; buf: Float32Array<ArrayBuffer>; stream: MediaStream } | null = null
let micFail = false

export async function startMic(): Promise<boolean> {
  if (mic) return true
  if (micFail || !navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } })
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    an.fftSize = 1024
    src.connect(an)
    mic = { ctx, an, buf: new Float32Array(new ArrayBuffer(an.fftSize * 4)), stream }
    return true
  } catch {
    micFail = true
    return false
  }
}
export function stopMic() {
  if (!mic) return
  mic.stream.getTracks().forEach((t) => t.stop())
  void mic.ctx.close()
  mic = null
}
export const micReady = () => !!mic

/** Current input loudness (RMS, 0..~1). */
export function micLevel(): number {
  if (!mic) return 0
  mic.an.getFloatTimeDomainData(mic.buf)
  let s = 0
  for (let i = 0; i < mic.buf.length; i++) s += mic.buf[i]! * mic.buf[i]!
  return Math.sqrt(s / mic.buf.length)
}

/** Blowing = steady loud noise. Feed every frame; returns seconds of blowing so far. */
export class BlowMeter {
  private t = 0
  update(dt: number, level = micLevel()) {
    if (level > 0.08) this.t += dt / 1000
    else this.t = Math.max(0, this.t - dt / 2000)
    return this.t
  }
  reset() {
    this.t = 0
  }
}

/** Shout = a loud burst after quiet. Returns true once per shout. */
export class ShoutDetector {
  private loud = 0
  private cool = 0
  update(dt: number, level = micLevel()) {
    this.cool = Math.max(0, this.cool - dt)
    if (level > 0.22) this.loud += dt
    else this.loud = 0
    if (this.loud > 140 && this.cool <= 0) {
      this.cool = 2500
      this.loud = 0
      return true
    }
    return false
  }
}
