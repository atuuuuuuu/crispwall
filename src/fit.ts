export type Rect = { x: number; y: number; width: number; height: number }

/**
 * The biggest part of the picture with the screen's shape. `focusX`/`focusY` (0 to 1) slide it across the picture:
 * 0.5, 0.5 is the middle.
 */
export function cropFor(
  imgW: number,
  imgH: number,
  screenW: number,
  screenH: number,
  focusX = 0.5,
  focusY = 0.5,
): Rect {
  const target = screenW / screenH
  let width = imgW
  let height = Math.round(imgW / target)
  if (height > imgH) {
    height = imgH
    width = Math.round(imgH * target)
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return {
    x: Math.round((imgW - width) * clamp(focusX)),
    y: Math.round((imgH - height) * clamp(focusY)),
    width,
    height,
  }
}

/** How the wallpaper gets made: plain resize when the picture is big enough, AI upscaling when it isn't. */
export function plan(crop: Rect, screenW: number) {
  const scale = screenW / crop.width
  return {
    scale,
    // Below 1.25× a normal resize is already sharp enough to look the same.
    useAI: scale > 1.25,
    /**
     * Width to feed the AI. It always upscales 4×, so a crop that is nearly big enough is shrunk first to keep the
     * output at most 2× the screen (an untouched 3000 px crop would come out 12000 px wide and run out of memory).
     */
    aiInputWidth: Math.min(crop.width, Math.ceil(screenW / 2)),
    /** Past 4× the AI can't add any more detail; the rest is an ordinary resize, so the result may look soft. */
    tooSmall: scale > 4,
  }
}

export type Tile = {
  x: number
  y: number
  width: number
  height: number
  padLeft: number
  padTop: number
  padRight: number
  padBottom: number
}

/**
 * Splits a width × height image into tiles of at most `size` px, each read with `pad` px of its neighbours so the
 * seams don't show. The pad is cut off again after upscaling.
 */
export function tiles(width: number, height: number, size = 192, pad = 12): Tile[] {
  const out: Tile[] = []
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const w = Math.min(size, width - x)
      const h = Math.min(size, height - y)
      const padLeft = Math.min(pad, x)
      const padTop = Math.min(pad, y)
      const padRight = Math.min(pad, width - x - w)
      const padBottom = Math.min(pad, height - y - h)
      out.push({ x, y, width: w, height: h, padLeft, padTop, padRight, padBottom })
    }
  }
  return out
}

/** "crispwall-1206x2622.png" */
export const fileName = (w: number, h: number, ext: 'png' | 'jpg') => `crispwall-${w}x${h}.${ext}`
