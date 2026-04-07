import './style.css'
import { HalftoneRenderer } from './webgl'
import { getParams, setupControls, resetAll } from './controls'

const canvas      = document.getElementById('canvas')      as HTMLCanvasElement
const placeholder = document.getElementById('placeholder') as HTMLDivElement
const uploadArea  = document.getElementById('uploadArea')  as HTMLDivElement
const fileInput   = document.getElementById('fileInput')   as HTMLInputElement
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement
const invertBtn   = document.getElementById('invertBtn')   as HTMLButtonElement
const resetAllBtn = document.getElementById('resetAllBtn') as HTMLButtonElement
const peekBtn     = document.getElementById('peekBtn')     as HTMLButtonElement

const landing         = document.getElementById('landing')         as HTMLDivElement
const landingDropzone = document.getElementById('landingDropzone') as HTMLDivElement
const landingFileInput = document.getElementById('landingFileInput') as HTMLInputElement
const landingSelectBtn = document.getElementById('landingSelectBtn') as HTMLButtonElement
const landingInfoBtn  = document.getElementById('landingInfoBtn')  as HTMLButtonElement
const infoOverlay     = document.getElementById('infoOverlay')     as HTMLDivElement
const infoCloseBtn    = document.getElementById('infoCloseBtn')    as HTMLButtonElement

let renderer: HalftoneRenderer
let currentImage: HTMLImageElement | null = null
let rafId: number | null = null

// ── Init renderer ────────────────────────────────────────────────────────────

try {
  renderer = new HalftoneRenderer(canvas)
} catch (e) {
  alert('WebGL is not supported in your browser.')
  throw e
}

// ── Render scheduling ────────────────────────────────────────────────────────

function scheduleRender(): void {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (renderer.hasImage()) {
      renderer.render(getParams())
    }
  })
}

// ── Canvas sizing ────────────────────────────────────────────────────────────

function fitCanvas(img: HTMLImageElement): void {
  const container = canvas.parentElement as HTMLElement
  const ar = img.naturalWidth / img.naturalHeight
  const containerAr = container.clientWidth / container.clientHeight
  canvas.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`
  if (ar >= containerAr) {
    canvas.style.width  = '100%'
    canvas.style.height = 'auto'
  } else {
    canvas.style.height = '100%'
    canvas.style.width  = 'auto'
  }
}

// ── Image loading ────────────────────────────────────────────────────────────

function loadFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file.')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      currentImage = img
      renderer.loadImage(img)
      placeholder.style.display = 'none'
      canvas.style.display = 'block'
      fitCanvas(img)
      downloadBtn.disabled = false
      scheduleRender()
      landing.classList.add('hidden')
      landing.addEventListener('transitionend', () => landing.remove(), { once: true })
    }
    img.src = e.target!.result as string
  }
  reader.readAsDataURL(file)
}

// ── File input ───────────────────────────────────────────────────────────────

uploadArea.addEventListener('click', () => fileInput.click())
placeholder.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) loadFile(fileInput.files[0])
})

// ── Drag and drop ────────────────────────────────────────────────────────────

function setupDragDrop(el: HTMLElement): void {
  el.addEventListener('dragover', (e) => {
    e.preventDefault()
    el.classList.add('drag-over')
  })
  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over')
  })
  el.addEventListener('drop', (e) => {
    e.preventDefault()
    el.classList.remove('drag-over')
    const file = (e as DragEvent).dataTransfer?.files[0]
    if (file) loadFile(file)
  })
}

setupDragDrop(uploadArea)
setupDragDrop(placeholder)
setupDragDrop(landingDropzone)

// ── Landing page ──────────────────────────────────────────────────────────────

landingDropzone.addEventListener('click', () => landingFileInput.click())

landingSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  landingFileInput.click()
})

landingFileInput.addEventListener('change', () => {
  const file = landingFileInput.files?.[0]
  if (file) loadFile(file)
})

// ── Info overlay ──────────────────────────────────────────────────────────────

landingInfoBtn.addEventListener('click', () => {
  infoOverlay.classList.remove('hidden')
})

infoCloseBtn.addEventListener('click', () => {
  infoOverlay.classList.add('hidden')
})

infoOverlay.addEventListener('click', (e) => {
  if (e.target === infoOverlay) infoOverlay.classList.add('hidden')
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') infoOverlay.classList.add('hidden')
})

// ── Controls ─────────────────────────────────────────────────────────────────

setupControls(scheduleRender)

// ── Resize ───────────────────────────────────────────────────────────────────

const resizeObserver = new ResizeObserver(() => {
  if (currentImage) fitCanvas(currentImage)
  scheduleRender()
})
resizeObserver.observe(canvas.parentElement!)

// ── Download ─────────────────────────────────────────────────────────────────

downloadBtn.addEventListener('click', () => {
  if (!currentImage) return
  renderer.exportFromImage(currentImage, getParams())
})

// ── Invert button ─────────────────────────────────────────────────────────────

invertBtn.addEventListener('click', () => {
  const fgPicker = document.getElementById('foregroundColor') as HTMLInputElement
  const fgHex    = document.getElementById('foregroundHex')   as HTMLInputElement
  const bgPicker = document.getElementById('backgroundColor') as HTMLInputElement
  const bgHex    = document.getElementById('backgroundHex')   as HTMLInputElement
  const tmp = fgPicker.value
  fgPicker.value = bgPicker.value
  fgHex.value    = bgPicker.value
  bgPicker.value = tmp
  bgHex.value    = tmp
  scheduleRender()
})

// ── Reset all ─────────────────────────────────────────────────────────────────

resetAllBtn.addEventListener('click', () => {
  resetAll()
  scheduleRender()
})

// ── Peek (hold to view original) ──────────────────────────────────────────────

let peekImg: HTMLImageElement | null = null

function showPeek(): void {
  if (!currentImage || peekImg) return
  peekImg = document.createElement('img')
  peekImg.src = currentImage.src
  peekImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 0.15s;'
  canvas.parentElement!.appendChild(peekImg)
  requestAnimationFrame(() => { if (peekImg) peekImg.style.opacity = '1' })
}

function hidePeek(): void {
  const img = peekImg
  if (!img) return
  peekImg = null
  img.style.opacity = '0'
  setTimeout(() => img.remove(), 150)
}

peekBtn.addEventListener('mousedown', showPeek)
peekBtn.addEventListener('touchstart', showPeek, { passive: true })
peekBtn.addEventListener('mouseup', hidePeek)
peekBtn.addEventListener('mouseleave', hidePeek)
peekBtn.addEventListener('touchend', hidePeek)

// ── Dev helper: load image from URL (used for testing) ───────────────────────

function loadFromUrl(url: string): void {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    currentImage = img
    renderer.loadImage(img)
    placeholder.style.display = 'none'
    canvas.style.display = 'block'
    fitCanvas(img)
    downloadBtn.disabled = false
    scheduleRender()
    landing.classList.add('hidden')
    landing.addEventListener('transitionend', () => landing.remove(), { once: true })
  }
  img.src = url
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__loadFromUrl = loadFromUrl
