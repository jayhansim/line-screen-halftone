import { HalftoneParams } from './webgl'

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function getParams(): HalftoneParams {
  const fgColor = (document.getElementById('foregroundColor') as HTMLInputElement).value
  const bgColor = (document.getElementById('backgroundColor') as HTMLInputElement).value
  return {
    frequency:  parseFloat((document.getElementById('frequency')  as HTMLInputElement).value),
    contrast:   parseFloat((document.getElementById('contrast')   as HTMLInputElement).value),
    brightness: parseFloat((document.getElementById('brightness') as HTMLInputElement).value),
    angle:      parseFloat((document.getElementById('angle')      as HTMLInputElement).value),
    foreground: hexToRgb(fgColor),
    background: hexToRgb(bgColor),
  }
}

export function setupControls(onChange: () => void): void {
  const sliders = [
    { id: 'frequency',  valId: 'frequencyVal',  format: (v: number) => String(v) },
    { id: 'contrast',   valId: 'contrastVal',   format: (v: number) => v.toFixed(2) },
    { id: 'brightness', valId: 'brightnessVal', format: (v: number) => v.toFixed(2) },
    { id: 'angle',      valId: 'angleVal',       format: (v: number) => `${v}°` },
  ]

  for (const { id, valId, format } of sliders) {
    const slider = document.getElementById(id) as HTMLInputElement
    const display = document.getElementById(valId) as HTMLSpanElement
    slider.addEventListener('input', () => {
      display.textContent = format(parseFloat(slider.value))
      onChange()
    })
  }

  // Color pickers ↔ hex inputs sync
  const colorPairs: [string, string][] = [
    ['foregroundColor', 'foregroundHex'],
    ['backgroundColor', 'backgroundHex'],
  ]
  for (const [pickerId, hexId] of colorPairs) {
    const picker = document.getElementById(pickerId) as HTMLInputElement
    const hex    = document.getElementById(hexId)    as HTMLInputElement

    picker.addEventListener('input', () => {
      hex.value = picker.value
      onChange()
    })
    hex.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) {
        picker.value = hex.value
        onChange()
      }
    })
  }
}
