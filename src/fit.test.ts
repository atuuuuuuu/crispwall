import { describe, expect, it } from 'vitest'
import { cropFor, fileName, plan, tiles } from './fit'
import { SCREENS, thisScreen } from './screens'

describe('cropFor', () => {
  it('cuts a landscape photo to a portrait phone shape, centred', () => {
    const c = cropFor(4000, 3000, 1206, 2622)
    expect(c.height).toBe(3000)
    expect(c.width).toBe(Math.round(3000 * (1206 / 2622)))
    expect(c.x).toBe(Math.round((4000 - c.width) / 2))
    expect(c.y).toBe(0)
  })

  it('cuts a portrait photo to a laptop shape and follows the focus', () => {
    const top = cropFor(1000, 3000, 2560, 1664, 0.5, 0)
    const bottom = cropFor(1000, 3000, 2560, 1664, 0.5, 1)
    expect(top.width).toBe(1000)
    expect(top.y).toBe(0)
    expect(bottom.y + bottom.height).toBe(3000)
  })

  it('clamps focus outside 0..1', () => {
    expect(cropFor(4000, 1000, 1000, 1000, 5).x).toBe(3000)
    expect(cropFor(4000, 1000, 1000, 1000, -2).x).toBe(0)
  })
})

describe('plan', () => {
  it('skips the AI when the picture is already big enough', () => {
    expect(plan({ x: 0, y: 0, width: 3000, height: 2000 }, 2560).useAI).toBe(false)
  })
  it('uses the AI for small pictures and warns past 4x', () => {
    expect(plan({ x: 0, y: 0, width: 800, height: 520 }, 2560)).toMatchObject({
      useAI: true,
      tooSmall: false,
    })
    expect(plan({ x: 0, y: 0, width: 400, height: 260 }, 2560)).toMatchObject({
      useAI: true,
      tooSmall: true,
    })
  })
  it('keeps the AI output at most twice the screen width', () => {
    expect(plan({ x: 0, y: 0, width: 2000, height: 1300 }, 3456).aiInputWidth).toBe(1728)
    expect(plan({ x: 0, y: 0, width: 800, height: 520 }, 2560).aiInputWidth).toBe(800)
  })
})

describe('tiles', () => {
  it('covers every pixel exactly once', () => {
    const w = 500
    const h = 333
    const seen = new Uint8Array(w * h)
    for (const t of tiles(w, h, 128, 10)) {
      for (let y = t.y; y < t.y + t.height; y++)
        for (let x = t.x; x < t.x + t.width; x++) seen[y * w + x]! += 1
      expect(t.x - t.padLeft).toBeGreaterThanOrEqual(0)
      expect(t.y + t.height + t.padBottom).toBeLessThanOrEqual(h)
    }
    expect(seen.every((v) => v === 1)).toBe(true)
  })
})

describe('screens', () => {
  it('turns points into pixels and keeps phones portrait', () => {
    expect(thisScreen(402, 874, 3, true)).toMatchObject({
      width: 1206,
      height: 2622,
      overlay: 'phone',
    })
    expect(thisScreen(874, 402, 3, true)).toMatchObject({ width: 1206, height: 2622 })
    expect(thisScreen(1470, 956, 2, false)).toMatchObject({
      width: 2940,
      height: 1912,
      overlay: 'none',
    })
    expect(thisScreen(1280, 832, 2, false).name).toBe('This screen (MacBook Air 13")')
  })
  it('has unique ids', () => {
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(SCREENS.length)
  })
  it('names files by size', () => {
    expect(fileName(1206, 2622, 'png')).toBe('crispwall-1206x2622.png')
  })
})
