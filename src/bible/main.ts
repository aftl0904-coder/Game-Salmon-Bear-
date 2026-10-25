import {
  TERRAIN,
  HAZARDS,
  ENEMIES,
  CAMERA,
  SIGNS,
  STAGES,
} from '../game/config/gameData'

function el(html: string) {
  const d = document.createElement('div')
  d.innerHTML = html
  return d
}

function table(headers: string[], rows: string[][]) {
  const head = headers.map((h) => `<th>${h}</th>`).join('')
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

const root = document.getElementById('root')!
root.innerHTML = ''

root.appendChild(
  el(`<section id="sec-camera">
    <h2>Camera · data/camera.json</h2>
    <p>mode=<code>${CAMERA.mode}</code> · deadZone=<code>${CAMERA.deadZonePx.x}×${CAMERA.deadZonePx.y}</code></p>
    <div id="cam-lookahead" data-testid="cam-lookahead">lookAheadPx = <strong>${CAMERA.lookAheadPx}</strong></div>
    ${table(
      ['stage', 'fromTile', 'toTile', 'reason'],
      CAMERA.lockZones.map((z) => [
        `<code>${z.stage}</code>`,
        String(z.fromTile),
        String(z.toTile),
        z.reason,
      ]),
    )}
  </section>`),
)

root.appendChild(
  el(`<section id="sec-terrain">
    <h2>Terrain · data/terrain.json</h2>
    ${table(
      ['id', 'type', 'note'],
      TERRAIN.tiles.map((t) => [
        `<code>${t.id}</code>`,
        t.type,
        'note' in t && t.note ? String(t.note) : '—',
      ]),
    )}
  </section>`),
)

root.appendChild(
  el(`<section id="sec-hazards">
    <h2>Hazards · data/hazards.json</h2>
    ${table(
      ['id', 'name', 'type', 'answer'],
      HAZARDS.map((h) => [
        `<code>${h.id}</code>`,
        h.name,
        h.type,
        `<code>${h.answer}</code>`,
      ]),
    )}
  </section>`),
)

root.appendChild(
  el(`<section id="sec-enemies">
    <h2>Enemies · data/enemies.json</h2>
    ${table(
      ['id', 'name', 'role', 'answer'],
      ENEMIES.map((e) => [
        `<code>${e.id}</code>`,
        e.name,
        e.role,
        `<code>${e.answer}</code>`,
      ]),
    )}
  </section>`),
)

root.appendChild(
  el(`<section id="sec-signs">
    <h2>Signs · data/signs.json</h2>
    ${table(
      ['id', 'name', 'type', 'detail'],
      SIGNS.map((s) => [
        `<code>${s.id}</code>`,
        s.name,
        s.type,
        'text' in s && s.text
          ? String(s.text)
          : 'note' in s && s.note
            ? String(s.note)
            : '—',
      ]),
    )}
  </section>`),
)

root.appendChild(
  el(`<section id="sec-stages">
    <h2>Stages · data/stages.json（stub · camera refs）</h2>
    ${table(
      ['id', 'name'],
      STAGES.map((s) => [`<code>${s.id}</code>`, s.name]),
    )}
  </section>`),
)

document.title = `鮭鮭熊・圖鑑 (${HAZARDS.length} hazards / ${ENEMIES.length} enemies)`
