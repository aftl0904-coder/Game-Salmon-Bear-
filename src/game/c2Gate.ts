/** 第二大陸 is work in progress. ?c2=1 opens it in this browser; ?c2=0 hides it again. */
const C2_KEY = 'sake-kuma-c2-v1'

export function c2Enabled(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('c2')
    if (q === '1') localStorage.setItem(C2_KEY, '1')
    if (q === '0') localStorage.removeItem(C2_KEY)
    return localStorage.getItem(C2_KEY) === '1'
  } catch {
    return false
  }
}
