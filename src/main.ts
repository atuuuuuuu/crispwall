import './style.css'
import { cropFor, fileName, plan, type Rect } from './fit'
import { SCREENS, type Screen, thisScreen } from './screens'
import type { UpscaleMessage, UpscaleRequest } from './upscale.worker'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const drop = $<HTMLLabelElement>('drop')
const fileInput = $<HTMLInputElement>('file')
const frame = $<HTMLDivElement>('frame')
const preview = $<HTMLCanvasElement>('preview')
const controls = $<HTMLDivElement>('controls')
const select = $<HTMLSelectElement>('screen')
const showOverlay = $<HTMLInputElement>('show-overlay')
const make = $<HTMLButtonElement>('make')
const status = $<HTMLParagraphElement>('status')
const result = $<HTMLDivElement>('result')
const download = $<HTMLAnchorElement>('download')
const share = $<HTMLButtonElement>('share')
const again = $<HTMLButtonElement>('again')
const before = $<HTMLCanvasElement>('before')
const after = $<HTMLCanvasElement>('after')
const split = $<HTMLInputElement>('split')
const stage = $<HTMLDivElement>('stage')

const here = thisScreen(
  screen.width,
  screen.height,
  devicePixelRatio,
  matchMedia('(pointer: coarse)').matches,
)
const screens: Screen[] = [here, ...SCREENS]
for (const s of screens)
  select.add(new Option(s.id === 'this' ? s.name : `${s.name} (${s.width} × ${s.height})`, s.id))

let image: ImageBitmap | undefined
let target: Screen = here
let focus = { x: 0.5, y: 0.5 }
let wallpaper: Blob | undefined
let downloadUrl: string | undefined
/** The finished wallpaper, shown in the preview until the picture or screen changes. */
let made: OffscreenCanvas | undefined

const crop = (): Rect =>
  cropFor(image!.width, image!.height, target.width, target.height, focus.x, focus.y)

function say(text: string, warn = false) {
  status.textContent = text
  status.classList.toggle('warn', warn)
}

async function open(file: File) {
  try {
    image = await createImageBitmap(file)
  } catch {
    say(
      file.type.includes('heic') || /\.heic$/i.test(file.name)
        ? "This browser can't open HEIC photos. Open Crispwall in Safari, or save the photo as JPG first."
        : "That file isn't a picture this browser can open. Try a JPG or PNG.",
      true,
    )
    return
  }
  focus = { x: 0.5, y: 0.5 }
  drop.hidden = true
  frame.hidden = false
  controls.hidden = false
  reset()
  draw()
}

function reset() {
  result.hidden = true
  make.hidden = false
  make.disabled = false
  wallpaper = undefined
  if (made) {
    made = undefined
    draw()
  }
  const p = plan(crop(), target.width)
  make.textContent = p.useAI ? 'Make it sharp' : 'Make wallpaper'
  if (p.tooSmall)
    say(
      'This picture is very small for this screen. The AI will help, but it may still look a little soft.',
      true,
    )
  else if (!p.useAI)
    say('This picture is already big enough, so it only needs cropping. No AI needed.')
  else say('')
}

/** Sizes the preview to the stage with the screen's shape, then draws the cropped picture into it. */
function draw() {
  if (!image) return
  const maxW = stage.clientWidth - 24
  const maxH = Math.min(innerHeight * 0.72, 760)
  const aspect = target.width / target.height
  let w = maxW
  let h = w / aspect
  if (h > maxH) {
    h = maxH
    w = h * aspect
  }
  frame.style.width = `${Math.round(w)}px`
  frame.style.height = `${Math.round(h)}px`
  frame.classList.toggle('landscape', aspect > 1)
  frame.dataset.overlay = target.overlay
  frame.classList.toggle('no-overlay', !showOverlay.checked)
  preview.width = Math.round(w * devicePixelRatio)
  preview.height = Math.round(h * devicePixelRatio)
  const c = crop()
  const ctx = preview.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  if (made) ctx.drawImage(made, 0, 0, preview.width, preview.height)
  else ctx.drawImage(image, c.x, c.y, c.width, c.height, 0, 0, preview.width, preview.height)
  const date = frame.querySelector('.clock-date')
  if (date)
    date.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
}

// Drag the picture to choose what's in view.
let dragging: { x: number; y: number } | undefined
frame.addEventListener('pointerdown', (e) => {
  if (made) reset() // moving the picture makes a new wallpaper, so drop the finished one
  dragging = { x: e.clientX, y: e.clientY }
  frame.setPointerCapture(e.pointerId)
})
frame.addEventListener('pointermove', (e) => {
  if (!dragging || !image) return
  const c = crop()
  const k = c.width / frame.clientWidth // picture pixels per screen pixel
  const spareX = image.width - c.width
  const spareY = image.height - c.height
  if (spareX > 0)
    focus.x = Math.min(1, Math.max(0, focus.x - ((e.clientX - dragging.x) * k) / spareX))
  if (spareY > 0)
    focus.y = Math.min(1, Math.max(0, focus.y - ((e.clientY - dragging.y) * k) / spareY))
  dragging = { x: e.clientX, y: e.clientY }
  draw()
})
frame.addEventListener('pointerup', () => {
  dragging = undefined
})
frame.addEventListener('keydown', (e) => {
  const step = 0.05
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const m = moves[e.key]
  if (!m) return
  e.preventDefault()
  focus = {
    x: Math.min(1, Math.max(0, focus.x + m[0])),
    y: Math.min(1, Math.max(0, focus.y + m[1])),
  }
  draw()
  reset()
})
frame.tabIndex = 0

/** Draws `src` (or part of it) into a new canvas of w × h, halving in steps so big shrinks stay sharp. */
function resize(
  src: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  w: number,
  h: number,
) {
  let canvas = new OffscreenCanvas(sw, sh)
  canvas.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
  while (canvas.width / 2 > w && canvas.height / 2 > h) {
    const half = new OffscreenCanvas(Math.round(canvas.width / 2), Math.round(canvas.height / 2))
    const ctx = half.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, half.width, half.height)
    canvas = half
  }
  const out = new OffscreenCanvas(w, h)
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, w, h)
  return out
}

let worker: Worker | undefined
function upscale(pixels: ImageData): Promise<ImageData> {
  worker ??= new Worker(new URL('./upscale.worker.ts', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    worker!.onmessage = (e: MessageEvent<UpscaleMessage>) => {
      const m = e.data
      if (m.type === 'progress') {
        const where =
          m.device === 'gpu' ? 'on your graphics chip' : 'on your processor, which is slower'
        say(`Sharpening ${where}: ${Math.round((m.done / m.total) * 100)}%`)
      } else if (m.type === 'done')
        resolve(new ImageData(new Uint8ClampedArray(m.pixels), m.width, m.height))
      else reject(new Error(m.message))
    }
    const req: UpscaleRequest = {
      pixels: pixels.data,
      width: pixels.width,
      height: pixels.height,
      base: import.meta.env.BASE_URL,
    }
    worker!.postMessage(req, [pixels.data.buffer])
  })
}

make.addEventListener('click', async () => {
  if (!image) return
  make.disabled = true
  const c = crop()
  const p = plan(c, target.width)
  const started = performance.now()
  try {
    let out: OffscreenCanvas
    if (p.useAI) {
      say('Loading the AI model. This happens once and takes a few seconds.')
      const inW = p.aiInputWidth
      const inH = Math.round(c.height * (inW / c.width))
      const small = resize(image, c.x, c.y, c.width, c.height, inW, inH)
      const big = await upscale(small.getContext('2d')!.getImageData(0, 0, inW, inH))
      const bigCanvas = new OffscreenCanvas(big.width, big.height)
      bigCanvas.getContext('2d')!.putImageData(big, 0, 0)
      out = resize(bigCanvas, 0, 0, big.width, big.height, target.width, target.height)
    } else {
      out = resize(image, c.x, c.y, c.width, c.height, target.width, target.height)
    }
    wallpaper = await out.convertToBlob({ type: 'image/png' })
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    downloadUrl = URL.createObjectURL(wallpaper)
    download.href = downloadUrl
    download.download = fileName(target.width, target.height, 'png')
    const file = new File([wallpaper], download.download, { type: 'image/png' })
    share.hidden = !navigator.canShare?.({ files: [file] })
    const secs = ((performance.now() - started) / 1000).toFixed(1)
    say(
      `Done in ${secs} s: ${target.width} × ${target.height} pixels, exactly your screen.`,
      p.tooSmall,
    )
    make.hidden = true
    result.hidden = false // before compare(), which needs the box's real size
    compare(out, c)
    made = out
    draw()
  } catch (err) {
    say(
      `Something went wrong while sharpening: ${err instanceof Error ? err.message : err}. Try a smaller picture, or another browser.`,
      true,
    )
  } finally {
    make.disabled = false
  }
})

/** Shows the middle of the wallpaper at real pixel size: a normal resize on the left, Crispwall on the right. */
function compare(out: OffscreenCanvas, c: Rect) {
  const box = before.parentElement!
  const size = Math.min(Math.round(box.clientWidth * devicePixelRatio), target.width, target.height)
  const sx = Math.round((target.width - size) / 2)
  const sy = Math.round((target.height - size) / 2)
  // The "normal" version: the crop stretched to the screen the way any photo app would do it.
  const plain = new OffscreenCanvas(target.width, target.height)
  const pctx = plain.getContext('2d')!
  pctx.imageSmoothingQuality = 'high'
  pctx.drawImage(image!, c.x, c.y, c.width, c.height, 0, 0, target.width, target.height)
  for (const [canvas, src] of [
    [before, plain],
    [after, out],
  ] as const) {
    canvas.width = size
    canvas.height = size
    canvas.getContext('2d')!.drawImage(src, sx, sy, size, size, 0, 0, size, size)
  }
}

split.addEventListener('input', () =>
  before.parentElement!.style.setProperty('--split', `${split.value}%`),
)

share.addEventListener('click', async () => {
  if (!wallpaper) return
  const file = new File([wallpaper], download.download, { type: 'image/png' })
  try {
    await navigator.share({ files: [file] })
  } catch {
    // Closing the share sheet throws; nothing to do.
  }
})

again.addEventListener('click', () => {
  image = undefined
  frame.hidden = true
  controls.hidden = true
  drop.hidden = false
  fileInput.value = ''
  say('')
})

select.addEventListener('change', () => {
  target = screens.find((s) => s.id === select.value) ?? here
  draw()
  reset()
})
showOverlay.addEventListener('change', draw)
addEventListener('resize', draw)

fileInput.addEventListener('change', () => fileInput.files?.[0] && open(fileInput.files[0]))
for (const ev of ['dragenter', 'dragover'] as const) {
  drop.addEventListener(ev, (e) => {
    e.preventDefault()
    drop.classList.add('over')
  })
}
drop.addEventListener('dragleave', () => drop.classList.remove('over'))
drop.addEventListener('drop', (e) => {
  e.preventDefault()
  drop.classList.remove('over')
  const f = e.dataTransfer?.files[0]
  if (f) open(f)
})
// Pasting a picture works too.
addEventListener('paste', (e) => {
  const f = [...((e as ClipboardEvent).clipboardData?.files ?? [])].find((x) =>
    x.type.startsWith('image/'),
  )
  if (f) open(f)
})
