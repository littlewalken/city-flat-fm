import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface WavOptions {
  ms?: number
  title?: string
  artist?: string
  album?: string
  track?: number
}

function infoField(id: string, value: string): Buffer {
  const text = Buffer.from(value + '\0', 'utf8')
  const padded = text.length % 2 ? Buffer.concat([text, Buffer.alloc(1)]) : text
  const head = Buffer.alloc(8)
  head.write(id, 0, 'ascii')
  head.writeUInt32LE(text.length, 4)
  return Buffer.concat([head, padded])
}

/** Writes a silent 8 kHz mono 16-bit WAV with optional RIFF LIST/INFO tags. */
export function makeWav(file: string, opts: WavOptions = {}): void {
  const sampleRate = 8000
  const samples = Math.round((sampleRate * (opts.ms ?? 500)) / 1000)
  const dataLen = samples * 2

  const fmt = Buffer.alloc(24)
  fmt.write('fmt ', 0, 'ascii')
  fmt.writeUInt32LE(16, 4)
  fmt.writeUInt16LE(1, 8) // PCM
  fmt.writeUInt16LE(1, 10) // mono
  fmt.writeUInt32LE(sampleRate, 12)
  fmt.writeUInt32LE(sampleRate * 2, 16)
  fmt.writeUInt16LE(2, 20)
  fmt.writeUInt16LE(16, 22)

  const data = Buffer.alloc(8 + dataLen)
  data.write('data', 0, 'ascii')
  data.writeUInt32LE(dataLen, 4)

  const fields: Buffer[] = []
  if (opts.title) fields.push(infoField('INAM', opts.title))
  if (opts.artist) fields.push(infoField('IART', opts.artist))
  if (opts.album) fields.push(infoField('IPRD', opts.album))
  if (opts.track !== undefined) fields.push(infoField('ITRK', String(opts.track)))
  let list = Buffer.alloc(0)
  if (fields.length) {
    const body = Buffer.concat([Buffer.from('INFO', 'ascii'), ...fields])
    const head = Buffer.alloc(8)
    head.write('LIST', 0, 'ascii')
    head.writeUInt32LE(body.length, 4)
    list = Buffer.concat([head, body])
  }

  const riff = Buffer.alloc(12)
  riff.write('RIFF', 0, 'ascii')
  riff.writeUInt32LE(4 + fmt.length + list.length + data.length, 4)
  riff.write('WAVE', 8, 'ascii')

  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.concat([riff, fmt, list, data]))
}
