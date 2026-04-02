import './style.css'
import { HalftoneRenderer } from './webgl'
import { getParams, setupControls } from './controls'

const canvas      = document.getElementById('canvas')      as HTMLCanvasElement
const placeholder = document.getElementById('placeholder') as HTMLDivElement
const uploadArea  = document.getElementById('uploadArea')  as HTMLDivElement
const fileInput   = document.getElementById('fileInput')   as HTMLInputElement
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement

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
    }
    img.src = e.target!.result as string
  }
  reader.readAsDataURL(file)
}

// ── File input ───────────────────────────────────────────────────────────────

uploadArea.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) loadFile(fileInput.files[0])
})

// ── Drag and drop ────────────────────────────────────────────────────────────

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault()
  uploadArea.classList.add('drag-over')
})

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over')
})

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadArea.classList.remove('drag-over')
  const file = e.dataTransfer?.files[0]
  if (file) loadFile(file)
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
  }
  img.src = url
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__loadFromUrl = loadFromUrl
