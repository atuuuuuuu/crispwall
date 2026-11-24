/// <reference lib="webworker" />
// Runs Real-ESRGAN (realesr-general-x4v3) on the picture, tile by tile, on this device's GPU when it can.
import * as ort from 'onnxruntime-web/webgpu'
import { tiles } from './fit'

export type UpscaleRequest = {
  pixels: Uint8ClampedArray
  width: number
  height: number
  base: string
}
/** Sent when a picture is opened, so the model downloads while the user is still framing it. */
export type WarmRequest = { warm: true; base: string }
export type UpscaleMessage =
  | { type: 'progress'; done: number; total: number; device: 'gpu' | 'cpu' }
  | {
      type: 'done'
      pixels: Uint8ClampedArray
      width: number
      height: number
      device: 'gpu' | 'cpu'
    }
  | { type: 'error'; message: string }

const SCALE = 4
type Session = { run: ort.InferenceSession; device: 'gpu' | 'cpu' }
// One shared load: the preload and the first real run must not each create a session.
let session: Promise<Session> | undefined

function load(base: string): Promise<Session> {
  session ??= create(base)
  session.catch(() => {
    session = undefined // let the next attempt try again
  })
  return session
}

async function create(base: string): Promise<Session> {
  // GitHub Pages can't send the headers threads need, so stay single-threaded.
  ort.env.wasm.numThreads = 1
  const model = `${base}models/realesr-general-x4v3.onnx`
  if ('gpu' in navigator) {
    try {
      return {
        run: await ort.InferenceSession.create(model, { executionProviders: ['webgpu'] }),
        device: 'gpu',
      }
    } catch {
      // Some GPUs or browsers expose WebGPU but can't run every layer. The CPU path is slower but always works.
    }
  }
  return {
    run: await ort.InferenceSession.create(model, { executionProviders: ['wasm'] }),
    device: 'cpu',
  }
}

self.onmessage = async (e: MessageEvent<UpscaleRequest | WarmRequest>) => {
  if ('warm' in e.data) {
    load(e.data.base).catch(() => {}) // a real run reports any error
    return
  }
  try {
    const { pixels, width, height, base } = e.data
    const { run, device } = await load(base)
    const outW = width * SCALE
    const outH = height * SCALE
    const out = new Uint8ClampedArray(outW * outH * 4)
    const list = tiles(width, height)
    for (const [i, t] of list.entries()) {
      // Read the tile plus its padding, as a 0..1 float RGB image in CHW order.
      const x0 = t.x - t.padLeft
      const y0 = t.y - t.padTop
      const w = t.padLeft + t.width + t.padRight
      const h = t.padTop + t.height + t.padBottom
      const input = new Float32Array(3 * w * h)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const src = ((y0 + y) * width + (x0 + x)) * 4
          const dst = y * w + x
          input[dst] = pixels[src]! / 255
          input[w * h + dst] = pixels[src + 1]! / 255
          input[2 * w * h + dst] = pixels[src + 2]! / 255
        }
      }
      const result = await run.run({ input: new ort.Tensor('float32', input, [1, 3, h, w]) })
      const data = (result.output as ort.Tensor).data as Float32Array
      const ow = w * SCALE
      const plane = ow * h * SCALE
      // Copy back only the tile itself; its padding is thrown away so seams don't show.
      for (let y = 0; y < t.height * SCALE; y++) {
        for (let x = 0; x < t.width * SCALE; x++) {
          const sx = x + t.padLeft * SCALE
          const sy = y + t.padTop * SCALE
          const s = sy * ow + sx
          const d = ((t.y * SCALE + y) * outW + (t.x * SCALE + x)) * 4
          out[d] = data[s]! * 255
          out[d + 1] = data[plane + s]! * 255
          out[d + 2] = data[2 * plane + s]! * 255
          out[d + 3] = 255
        }
      }
      ;(result.output as ort.Tensor).dispose()
      self.postMessage({
        type: 'progress',
        done: i + 1,
        total: list.length,
        device,
      } satisfies UpscaleMessage)
    }
    self.postMessage(
      { type: 'done', pixels: out, width: outW, height: outH, device } satisfies UpscaleMessage,
      [out.buffer],
    )
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies UpscaleMessage)
  }
}
