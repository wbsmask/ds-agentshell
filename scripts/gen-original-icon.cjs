'use strict'

/**
 * Generate an ORIGINAL app icon (assets/icon.png + assets/icon.ico).
 *
 * This is a generic terminal-prompt mark (a chevron + cursor), drawn from
 * scratch so it does NOT reproduce the DeepSeek whale logo or any third-party
 * trademark. MIT covers the code, not DeepSeek's logo — using the whale as an
 * app icon would carry trademark risk, so this project ships its own mark.
 */

const fs = require('node:fs')
const path = require('node:path')
const { Resvg } = require('@resvg/resvg-js')

const OUT_DIR = path.resolve(__dirname, '..', 'assets')

function svg(size) {
  // Rounded tile, blue-violet gradient, a bold terminal ">" chevron and a
  // blinking-cursor underscore. Purely geometric, no text, no trademark.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b5bfe"/>
      <stop offset="1" stop-color="#12206b"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="M188 176 L324 256 L188 336" fill="none" stroke="#ffffff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="336" y="304" width="84" height="44" rx="10" fill="#ffffff"/>
</svg>`
}

function buildIco(pngs) {
  const count = pngs.length
  const headerSize = 6
  const entrySize = 16
  const dataOffset = headerSize + count * entrySize
  const entries = []
  let cursor = dataOffset
  const body = []
  for (const png of pngs) {
    const dim = png.size >= 256 ? 0 : png.size
    entries.push({ dim, bytesInRes: png.data.length, offset: cursor })
    cursor += png.data.length
    body.push(png.data)
  }
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const dir = Buffer.alloc(count * entrySize)
  entries.forEach((e, i) => {
    const o = i * entrySize
    dir.writeUInt8(e.dim, o)
    dir.writeUInt8(e.dim, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(e.bytesInRes, o + 8)
    dir.writeUInt32LE(e.offset, o + 12)
  })
  return Buffer.concat([header, dir, ...body])
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const png = new Resvg(svg(512), { fitTo: { mode: 'width', value: 512 } }).render().asPng()
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), png)

  const sizes = [256, 128, 64, 48, 32, 16]
  const pngs = sizes.map((s) => ({ size: s, data: new Resvg(svg(s), { fitTo: { mode: 'width', value: s } }).render().asPng() }))
  const ico = buildIco(pngs)
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico)
  console.log(`wrote assets/icon.png (${png.length} bytes) and assets/icon.ico (${ico.length} bytes)`)
}

main()
