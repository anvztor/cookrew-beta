export interface DeviceInsets {
  top: number
  bottom: number
  left: number
  right: number
}

const DEVICE_INSETS: Record<string, DeviceInsets> = {
  iphone: { top: 44, bottom: 34, left: 0, right: 0 },
  pixel: { top: 28, bottom: 24, left: 0, right: 0 },
}

const ZERO: DeviceInsets = { top: 0, bottom: 0, left: 0, right: 0 }

export function detectDeviceInsets(): DeviceInsets {
  if (typeof window === 'undefined') return ZERO
  try {
    const m = (window.location.hash || '').match(/device=([a-z0-9]+)/i)
    const id = m ? m[1].toLowerCase() : null
    return (id && DEVICE_INSETS[id]) || ZERO
  } catch {
    return ZERO
  }
}
