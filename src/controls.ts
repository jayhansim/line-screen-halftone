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
    exposure:   parseFloat((document.getElementById('exposure')   as HTMLInputElement).value),
    highlights: parseFloat((document.getElementById('highlights') as HTMLInputElement).value),
    shadows:    parseFloat((document.getElementById('shadows')    as HTMLInputElement).value),
    blur:       parseFloat((document.getElementById('blur')       as HTMLInputElement).value),
    invert:     (document.getElementById('invert') as HTMLInputElement).checked,
    foreground: hexToRgb(fgColor),
    background: hexToRgb(bgColor),
  }
}

export function updateSliderFill(input: HTMLInputElement): void {
  const min = parseFloat(input.min)
  const max = parseFloat(input.max)
  const val = parseFloat(input.value)
  const pct = ((val - min) / (max - min)) * 100
  input.style.background = `linear-gradient(to right, var(--neutral-black-900) ${pct}%, var(--neutral-yellow-300-50) ${pct}%)`
}

let _onChange: () => void

export function setupControls(onChange: () => void): void {
  _onChange = onChange

  const sliders = [
    { id: 'frequency',  valId: 'frequencyVal',  format: (v: number) => String(v) },
    { id: 'contrast',   valId: 'contrastVal',   format: (v: number) => v.toFixed(2) },
    { id: 'exposure',   valId: 'exposureVal',   format: (v: number) => v.toFixed(2) },
    { id: 'highlights', valId: 'highlightsVal', format: (v: number) => v.toFixed(2) },
    { id: 'shadows',    valId: 'shadowsVal',    format: (v: number) => v.toFixed(2) },
    { id: 'blur',       valId: 'blurVal',       format: (v: number) => v.toFixed(1) },
  ]

  for (const { id, valId, format } of sliders) {
    const slider = document.getElementById(id) as HTMLInputElement
    const display = document.getElementById(valId) as HTMLSpanElement

    // Set initial fill
    updateSliderFill(slider)

    slider.addEventListener('input', () => {
      display.textContent = format(parseFloat(slider.value))
      updateSliderFill(slider)
      onChange()
    })
  }

  // Invert toggle
  document.getElementById('invert')!.addEventListener('change', onChange)

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

export function resetAll(): void {
  const sliderDefs = [
    { id: 'frequency',  valId: 'frequencyVal',  format: (v: number) => String(v) },
    { id: 'contrast',   valId: 'contrastVal',   format: (v: number) => v.toFixed(2) },
    { id: 'exposure',   valId: 'exposureVal',   format: (v: number) => v.toFixed(2) },
    { id: 'highlights', valId: 'highlightsVal', format: (v: number) => v.toFixed(2) },
    { id: 'shadows',    valId: 'shadowsVal',    format: (v: number) => v.toFixed(2) },
    { id: 'blur',       valId: 'blurVal',       format: (v: number) => v.toFixed(1) },
  ]

  for (const { id, valId, format } of sliderDefs) {
    const slider = document.getElementById(id) as HTMLInputElement
    const display = document.getElementById(valId) as HTMLSpanElement
    slider.value = slider.defaultValue
    display.textContent = format(parseFloat(slider.defaultValue))
    updateSliderFill(slider)
  }

  _onChange()
}
