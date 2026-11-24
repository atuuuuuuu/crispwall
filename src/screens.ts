/** A screen to make a wallpaper for. Sizes are in real pixels, the way the wallpaper file must be. */
export type Screen = {
  id: string
  name: string
  width: number
  height: number
  /** What sits on top of the wallpaper, drawn in the preview so you can keep your subject clear of it. */
  overlay: 'phone' | 'macbook' | 'none'
}

export const SCREENS: Screen[] = [
  {
    id: 'iphone-17-pro',
    name: 'iPhone 17 Pro, 16 Pro, 17',
    width: 1206,
    height: 2622,
    overlay: 'phone',
  },
  {
    id: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max, 16 Pro Max',
    width: 1320,
    height: 2868,
    overlay: 'phone',
  },
  { id: 'iphone-air', name: 'iPhone Air', width: 1260, height: 2736, overlay: 'phone' },
  { id: 'iphone-16', name: 'iPhone 16, 15, 15 Pro', width: 1179, height: 2556, overlay: 'phone' },
  {
    id: 'iphone-16-plus',
    name: 'iPhone 16 Plus, 15 Plus, 15 Pro Max',
    width: 1290,
    height: 2796,
    overlay: 'phone',
  },
  { id: 'iphone-se', name: 'iPhone SE', width: 750, height: 1334, overlay: 'none' },
  { id: 'android', name: 'Android phone (most)', width: 1080, height: 2400, overlay: 'phone' },
  { id: 'android-qhd', name: 'Android phone (QHD+)', width: 1440, height: 3120, overlay: 'phone' },
  { id: 'ipad-pro-13', name: 'iPad Pro 13"', width: 2064, height: 2752, overlay: 'none' },
  { id: 'ipad-air-11', name: 'iPad Air 11"', width: 1640, height: 2360, overlay: 'none' },
  { id: 'macbook-air-13', name: 'MacBook Air 13"', width: 2560, height: 1664, overlay: 'macbook' },
  { id: 'macbook-air-15', name: 'MacBook Air 15"', width: 2880, height: 1864, overlay: 'macbook' },
  { id: 'macbook-pro-14', name: 'MacBook Pro 14"', width: 3024, height: 1964, overlay: 'macbook' },
  { id: 'macbook-pro-16', name: 'MacBook Pro 16"', width: 3456, height: 2234, overlay: 'macbook' },
  { id: 'imac-24', name: 'iMac 24"', width: 4480, height: 2520, overlay: 'none' },
  { id: 'studio-display', name: 'Studio Display, 5K', width: 5120, height: 2880, overlay: 'none' },
  {
    id: 'pro-display-xdr',
    name: 'Pro Display XDR, 6K',
    width: 6016,
    height: 3384,
    overlay: 'none',
  },
  { id: 'fhd', name: '1080p monitor', width: 1920, height: 1080, overlay: 'none' },
  { id: 'qhd', name: '1440p monitor', width: 2560, height: 1440, overlay: 'none' },
  { id: '4k', name: '4K monitor', width: 3840, height: 2160, overlay: 'none' },
  { id: 'ultrawide', name: 'Ultrawide monitor', width: 3440, height: 1440, overlay: 'none' },
]

/**
 * The screen this page is open on, in real pixels. Phones report their size in points, so we multiply by the
 * pixel ratio; a phone held sideways still gets a portrait wallpaper.
 */
export function thisScreen(w: number, h: number, dpr: number, touch: boolean): Screen {
  let width = Math.round(w * dpr)
  let height = Math.round(h * dpr)
  if (touch && width > height) [width, height] = [height, width]
  const known = SCREENS.find((s) => s.width === width && s.height === height)
  return {
    id: 'this',
    name: `This screen (${known ? known.name : `${width} × ${height}`})`,
    width,
    height,
    overlay: known?.overlay ?? 'none',
  }
}
