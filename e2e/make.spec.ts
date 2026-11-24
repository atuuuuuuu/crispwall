import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

mkdirSync('test-results', { recursive: true })

import { expect, test } from '@playwright/test'

/** Width and height from a PNG header. */
const pngSize = (buf: Buffer) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) })

test('a small picture becomes a sharp wallpaper of exactly the chosen size, without leaving the device', async ({
  page,
}) => {
  const outside: string[] = []
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://localhost') &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      outside.push(r.url())
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await page.setInputFiles('#file', 'e2e/fixtures/small.png')
  await expect(page.locator('#frame')).toBeVisible()
  await page.selectOption('#screen', 'macbook-air-13')
  await expect(page.locator('#make')).toHaveText('Make it sharp')
  await page.click('#make')
  await expect(page.locator('#status')).toContainText('Done in', { timeout: 150_000 })

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download')])
  expect(download.suggestedFilename()).toBe('crispwall-2560x1664.png')
  const file = readFileSync((await download.path())!)
  expect(pngSize(file)).toEqual({ width: 2560, height: 1664 })

  // Edge strength (variance of the Laplacian) of the middle of the wallpaper: the AI version must be clearly sharper
  // than a normal resize, or the model didn't do its job.
  const sharpness = await page.evaluate(() => {
    const measure = (id: string) => {
      const c = document.getElementById(id) as HTMLCanvasElement
      const { data, width, height } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
      const g = (x: number, y: number) => {
        const i = (y * width + x) * 4
        return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
      }
      let sum = 0
      let sq = 0
      let n = 0
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const l = 4 * g(x, y) - g(x - 1, y) - g(x + 1, y) - g(x, y - 1) - g(x, y + 1)
          sum += l
          sq += l * l
          n++
        }
      }
      return sq / n - (sum / n) ** 2
    }
    return { before: measure('before'), after: measure('after') }
  })
  console.log('sharpness', sharpness)
  expect(sharpness.after).toBeGreaterThan(sharpness.before * 1.5)
  for (const id of ['before', 'after']) {
    const url = await page.evaluate(
      (i) => (document.getElementById(i) as HTMLCanvasElement).toDataURL(),
      id,
    )
    writeFileSync(`test-results/${id}.png`, Buffer.from(url.split(',')[1]!, 'base64'))
  }
  expect(outside).toEqual([])
  expect(errors).toEqual([])
})

test('a picture that is already big enough is only cropped, no AI', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#file', 'e2e/fixtures/big.jpg')
  await page.selectOption('#screen', 'fhd')
  await expect(page.locator('#make')).toHaveText('Make wallpaper')
  await expect(page.locator('#status')).toContainText('already big enough')
  await page.click('#make')
  await expect(page.locator('#status')).toContainText('Done in')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download')])
  expect(pngSize(readFileSync((await download.path())!))).toEqual({ width: 1920, height: 1080 })
})
