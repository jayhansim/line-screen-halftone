import vertSrc from './shader.vert.glsl'
import fragSrc from './shader.frag.glsl'

export interface HalftoneParams {
  frequency:  number
  contrast:   number
  exposure:   number
  highlights: number
  shadows:    number
  blur:       number
  invert:     boolean
  foreground: [number, number, number]  // 0–1 RGB
  background: [number, number, number]
}

export class HalftoneRenderer {
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private texture: WebGLTexture | null = null
  private imageSize: [number, number] = [1, 1]

  // Uniform locations
  private uImage: WebGLUniformLocation
  private uFrequency:  WebGLUniformLocation
  private uContrast:   WebGLUniformLocation
  private uExposure:   WebGLUniformLocation
  private uHighlights: WebGLUniformLocation
  private uShadows:    WebGLUniformLocation
  private uBlur:       WebGLUniformLocation
  private uInvert:     WebGLUniformLocation
  private uForeground: WebGLUniformLocation
  private uBackground: WebGLUniformLocation
  private uResolution: WebGLUniformLocation
  private uImageSize: WebGLUniformLocation
  private uFwScale: WebGLUniformLocation

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL not supported')
    this.gl = gl

    // Enable OES_standard_derivatives for fwidth()
    gl.getExtension('OES_standard_derivatives')

    this.program = this.compileProgram(vertSrc, fragSrc)
    this.setupGeometry()

    this.uImage      = this.getUniform('u_image')
    this.uFrequency  = this.getUniform('u_frequency')
    this.uContrast   = this.getUniform('u_contrast')
    this.uExposure   = this.getUniform('u_exposure')
    this.uHighlights = this.getUniform('u_highlights')
    this.uShadows    = this.getUniform('u_shadows')
    this.uBlur       = this.getUniform('u_blur')
    this.uInvert     = this.getUniform('u_invert')
    this.uForeground = this.getUniform('u_foreground')
    this.uBackground = this.getUniform('u_background')
    this.uResolution = this.getUniform('u_resolution')
    this.uImageSize  = this.getUniform('u_imageSize')
    this.uFwScale    = this.getUniform('u_fw_scale')
  }

  // ── Shader compilation ──────────────────────────────────────────────────────

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error:\n${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }

  private compileProgram(vert: string, frag: string): WebGLProgram {
    const gl = this.gl
    const program = gl.createProgram()!
    gl.attachShader(program, this.compileShader(gl.VERTEX_SHADER, vert))
    gl.attachShader(program, this.compileShader(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error:\n${gl.getProgramInfoLog(program)}`)
    }
    return program
  }

  private getUniform(name: string): WebGLUniformLocation {
    const loc = this.gl.getUniformLocation(this.program, name)
    if (!loc) throw new Error(`Uniform '${name}' not found`)
    return loc
  }

  // ── Geometry: full-screen quad ──────────────────────────────────────────────

  private setupGeometry(): void {
    const gl = this.gl
    // Two triangles covering clip space [-1,1]
    // position (xy) + uv (st)
    const vertices = new Float32Array([
      -1, -1,  0, 1,   // bottom-left
       1, -1,  1, 1,   // bottom-right
      -1,  1,  0, 0,   // top-left
       1,  1,  1, 0,   // top-right
    ])
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    gl.useProgram(this.program)

    const stride = 4 * 4 // 4 floats × 4 bytes
    const aPos = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0)

    const aUV = gl.getAttribLocation(this.program, 'a_uv')
    gl.enableVertexAttribArray(aUV)
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, stride, 2 * 4)
  }

  // ── Texture loading ─────────────────────────────────────────────────────────

  loadImage(img: HTMLImageElement): void {
    const gl = this.gl

    // Check max texture size
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    if (img.naturalWidth > maxSize || img.naturalHeight > maxSize) {
      console.warn(`Image exceeds MAX_TEXTURE_SIZE (${maxSize}px). It may be clipped.`)
    }

    if (this.texture) gl.deleteTexture(this.texture)

    this.texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

    // Non-power-of-two safe settings
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    this.imageSize = [img.naturalWidth, img.naturalHeight]
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  render(params: HalftoneParams): void {
    if (!this.texture) return

    const gl = this.gl
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.round(rect.width  * dpr)
    const h = Math.round(rect.height * dpr)

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width  = w
      this.canvas.height = h
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(this.uImage, 0)

    gl.uniform1f(this.uFrequency,  gl.drawingBufferWidth / params.frequency)
    gl.uniform1f(this.uContrast,   params.contrast)
    gl.uniform1f(this.uExposure,   params.exposure)
    gl.uniform1f(this.uHighlights, params.highlights)
    gl.uniform1f(this.uShadows,    params.shadows)
    gl.uniform1f(this.uBlur,       params.blur)
    gl.uniform1f(this.uInvert,     params.invert ? 1.0 : 0.0)
    gl.uniform3fv(this.uForeground, params.foreground)
    gl.uniform3fv(this.uBackground, params.background)
    gl.uniform2f(this.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.uniform2f(this.uImageSize,  this.imageSize[0], this.imageSize[1])
    gl.uniform1f(this.uFwScale,    1.0)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  // ── Export at full image resolution ────────────────────────────────────────

  exportPNG(params: HalftoneParams): void {
    if (!this.texture || !this.imageSize) return

    const [imgW, imgH] = this.imageSize

    // Offscreen canvas at original image size
    const offscreen = document.createElement('canvas')
    offscreen.width  = imgW
    offscreen.height = imgH

    // Temporarily swap context to offscreen canvas
    const offGL = offscreen.getContext('webgl', { preserveDrawingBuffer: true })!
    offGL.getExtension('OES_standard_derivatives')

    // Re-compile program for offscreen context
    const compileShader = (type: number, src: string) => {
      const s = offGL.createShader(type)!
      offGL.shaderSource(s, src)
      offGL.compileShader(s)
      return s
    }
    const prog = offGL.createProgram()!
    offGL.attachShader(prog, compileShader(offGL.VERTEX_SHADER, vertSrc))
    offGL.attachShader(prog, compileShader(offGL.FRAGMENT_SHADER, fragSrc))
    offGL.linkProgram(prog)

    // Re-upload texture
    const tex = offGL.createTexture()!
    const img = new Image()
    // Find the original image from current texture (re-use canvas source)
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width  = imgW
    srcCanvas.height = imgH
    const srcCtx = srcCanvas.getContext('2d')!
    // Draw from the WebGL texture back to a 2D canvas
    const gl = this.gl
    const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4)
    gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    // Instead, keep a reference to the original HTMLImageElement for export
    // (This approach reads from the preview canvas — see note in exportFromImage)
    void img; void tex; void srcCtx; void srcCanvas

    offscreen.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'halftone.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  exportFromImage(sourceImg: HTMLImageElement, params: HalftoneParams): void {
    const [imgW, imgH] = this.imageSize
    const exportW = this.canvas.width
    const exportH = this.canvas.height

    const offscreen = document.createElement('canvas')
    offscreen.width  = exportW
    offscreen.height = exportH

    const offGL = offscreen.getContext('webgl', { preserveDrawingBuffer: true })
    if (!offGL) return
    offGL.getExtension('OES_standard_derivatives')

    const mkShader = (type: number, src: string) => {
      const s = offGL.createShader(type)!
      offGL.shaderSource(s, src)
      offGL.compileShader(s)
      return s
    }
    const prog = offGL.createProgram()!
    offGL.attachShader(prog, mkShader(offGL.VERTEX_SHADER, vertSrc))
    offGL.attachShader(prog, mkShader(offGL.FRAGMENT_SHADER, fragSrc))
    offGL.linkProgram(prog)
    offGL.useProgram(prog)

    // Geometry
    const verts = new Float32Array([-1,-1, 0,1, 1,-1, 1,1, -1,1, 0,0, 1,1, 1,0])
    const buf = offGL.createBuffer()!
    offGL.bindBuffer(offGL.ARRAY_BUFFER, buf)
    offGL.bufferData(offGL.ARRAY_BUFFER, verts, offGL.STATIC_DRAW)
    const stride = 4 * 4
    const aPos = offGL.getAttribLocation(prog, 'a_position')
    offGL.enableVertexAttribArray(aPos)
    offGL.vertexAttribPointer(aPos, 2, offGL.FLOAT, false, stride, 0)
    const aUV = offGL.getAttribLocation(prog, 'a_uv')
    offGL.enableVertexAttribArray(aUV)
    offGL.vertexAttribPointer(aUV, 2, offGL.FLOAT, false, stride, 2 * 4)

    // Texture
    const tex = offGL.createTexture()!
    offGL.bindTexture(offGL.TEXTURE_2D, tex)
    offGL.texImage2D(offGL.TEXTURE_2D, 0, offGL.RGBA, offGL.RGBA, offGL.UNSIGNED_BYTE, sourceImg)
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_WRAP_S, offGL.CLAMP_TO_EDGE)
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_WRAP_T, offGL.CLAMP_TO_EDGE)
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_MIN_FILTER, offGL.LINEAR)
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_MAG_FILTER, offGL.LINEAR)

    const getU = (name: string) => offGL.getUniformLocation(prog, name)!
    offGL.viewport(0, 0, exportW, exportH)
    offGL.uniform1i(getU('u_image'), 0)

    offGL.uniform1f(getU('u_frequency'),  exportW / params.frequency)
    offGL.uniform1f(getU('u_contrast'),   params.contrast)
    offGL.uniform1f(getU('u_exposure'),   params.exposure)
    offGL.uniform1f(getU('u_highlights'), params.highlights)
    offGL.uniform1f(getU('u_shadows'),    params.shadows)
    offGL.uniform1f(getU('u_blur'),       params.blur)
    offGL.uniform1f(getU('u_invert'),     params.invert ? 1.0 : 0.0)
    offGL.uniform3fv(getU('u_foreground'), params.foreground)
    offGL.uniform3fv(getU('u_background'), params.background)
    offGL.uniform2f(getU('u_resolution'), exportW, exportH)
    offGL.uniform2f(getU('u_imageSize'),  imgW, imgH)
    offGL.uniform1f(getU('u_fw_scale'),   1.0)

    offGL.clearColor(0, 0, 0, 1)
    offGL.clear(offGL.COLOR_BUFFER_BIT)
    offGL.drawArrays(offGL.TRIANGLE_STRIP, 0, 4)

    offscreen.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'halftone.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  hasImage(): boolean {
    return this.texture !== null
  }
}
