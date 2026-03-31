# Build Plan: Line Screen Halftone Generator

## Overview

A single-page web app where users upload an image, preview it with a line screen halftone effect in real-time, adjust parameters (colors, size, contrast), and download the result as a PNG.

**Tech Stack**: Vite + Vanilla TypeScript + Raw WebGL + CSS

---

## Step 1: Project Setup

- Initialize project with Vite (vanilla TypeScript template)
  ```
  npm create vite@latest . -- --template vanilla-ts
  ```
- Install dependencies (minimal — likely just Vite dev dependency)
- Set up folder structure:
  ```
  src/
  ├── main.ts          # Entry point, wires everything together
  ├── style.css         # All styles
  ├── webgl.ts          # WebGL context setup, shader compilation, rendering
  ├── shader.frag.glsl  # Fragment shader (halftone effect)
  ├── shader.vert.glsl  # Vertex shader (passthrough)
  ├── controls.ts       # UI controls logic (sliders, color pickers, upload)
  └── download.ts       # Export/download logic
  ```
- Configure Vite to import `.glsl` files as raw strings (`?raw` suffix or vite plugin)

---

## Step 2: HTML Layout & CSS

Build the page structure with two main areas: controls panel and preview canvas.

### HTML Structure
```
<div id="app">
  <aside class="controls">
    <!-- Upload button -->
    <!-- Color pickers: foreground, background -->
    <!-- Sliders: size (frequency), contrast, angle, brightness -->
    <!-- Download button -->
  </aside>
  <main class="preview">
    <canvas id="canvas"></canvas>
  </main>
</div>
```

### CSS Requirements
- Responsive layout: controls sidebar + canvas area (stack on mobile)
- Canvas fills available space while maintaining image aspect ratio
- Clean, minimal UI (dark theme to match the aesthetic)
- Styled range sliders and color picker inputs
- Upload area with drag-and-drop visual hint
- Download button styling

---

## Step 3: WebGL Setup (`webgl.ts`)

### 3a. Initialize WebGL Context
- Get canvas element, create WebGL2 context (fall back to WebGL1)
- Set viewport to canvas dimensions
- Handle `devicePixelRatio` for sharp rendering on retina displays

### 3b. Compile Shaders
- Load vertex shader (simple passthrough — maps a full-screen quad to clip space)
- Load fragment shader (halftone effect — the core logic)
- Compile both, link into a program
- Cache uniform locations for all parameters

### 3c. Create Geometry
- Create a full-screen quad (two triangles covering the entire canvas)
- Set up vertex buffer with position and UV coordinates
- Bind attribute pointers

### 3d. Texture Loading
- Function to load an `HTMLImageElement` as a WebGL texture
- Set texture parameters: `CLAMP_TO_EDGE`, `LINEAR` filtering
- Handle non-power-of-two textures
- Check against `MAX_TEXTURE_SIZE` and resize if needed

---

## Step 4: Halftone Fragment Shader (`shader.frag.glsl`)

The core of the effect. This is the most critical piece.

### Uniforms
```glsl
uniform sampler2D u_image;       // Source image texture
uniform float u_frequency;       // Line density (higher = more lines)
uniform float u_angle;           // Line rotation in radians
uniform float u_contrast;        // Contrast multiplier
uniform float u_brightness;      // Brightness offset
uniform vec3 u_foreground;       // Line color (e.g., gold)
uniform vec3 u_background;       // Background color (e.g., navy)
uniform vec2 u_resolution;       // Canvas resolution
uniform vec2 u_imageSize;        // Original image dimensions (for aspect ratio)
```

### Shader Logic
1. Calculate UV coordinates with correct aspect ratio
2. Sample source image texture
3. Convert RGB to luminance: `dot(color, vec3(0.299, 0.587, 0.114))`
4. Apply contrast and brightness adjustments
5. Rotate coordinates by `u_angle`
6. Create repeating line pattern using `fract(rotatedCoord * u_frequency)`
7. Compare pattern position against luminance threshold
8. Use `smoothstep()` with `fwidth()` for anti-aliased edges
9. Output `mix(u_background, u_foreground, lineValue)`

### Vertex Shader (`shader.vert.glsl`)
- Simple passthrough: accept position attribute, output UV varying
- Map quad vertices to clip space (-1 to 1)

---

## Step 5: Image Upload (`controls.ts`)

### File Input
- Create `<input type="file" accept="image/*">` element
- Listen for `change` event
- Read file with `FileReader.readAsDataURL()`
- Create `Image()` object from data URL
- On image load: upload to WebGL as texture, trigger re-render

### Drag and Drop
- Add `dragover`, `dragleave`, `drop` event listeners to the upload area
- Prevent default browser behavior
- Visual feedback on drag hover
- Process dropped file same as file input

### Default State
- Show a placeholder message ("Upload an image to get started") when no image is loaded
- Optionally include a sample/demo image so users can try controls immediately

---

## Step 6: UI Controls (`controls.ts`)

### Controls to Implement

| Control | Type | Default | Range | Maps to Uniform |
|---------|------|---------|-------|-----------------|
| Foreground Color | Color picker | `#D4A843` (gold) | — | `u_foreground` |
| Background Color | Color picker | `#1B2A4A` (navy) | — | `u_background` |
| Line Size | Range slider | 50 | 5–200 | `u_frequency` |
| Contrast | Range slider | 1.0 | 0.1–3.0 | `u_contrast` |
| Angle | Range slider | 0° | 0°–180° | `u_angle` |
| Brightness | Range slider | 0 | -0.5–0.5 | `u_brightness` |

### Behavior
- Each control change immediately updates the corresponding WebGL uniform
- Trigger a re-render on every change (using `requestAnimationFrame` to debounce)
- Display current value next to each slider
- Hex color input fields alongside color pickers for precise entry

---

## Step 7: Render Loop (`webgl.ts`)

### Rendering Function
1. Bind the shader program
2. Set all uniform values from current control state
3. Bind the image texture
4. Draw the full-screen quad
5. Call via `requestAnimationFrame` only when parameters change (not continuous loop)

### Aspect Ratio Handling
- Calculate image aspect ratio from original dimensions
- Resize canvas to fit the container while preserving aspect ratio
- Pass resolution and image size as uniforms for correct UV mapping
- Handle window resize events

---

## Step 8: Image Download (`download.ts`)

### Standard Resolution Download
1. Render current frame to the on-screen canvas
2. Call `canvas.toBlob(callback, 'image/png')`
3. Create download link: `URL.createObjectURL(blob)`
4. Programmatically click a hidden `<a download="halftone.png">` element
5. Clean up: `URL.revokeObjectURL(url)`

### Full Resolution Download
1. Create an offscreen canvas at the **original image resolution**
2. Create a separate WebGL context on the offscreen canvas
3. Render the halftone effect with the same parameters but at full resolution
4. Scale `u_frequency` proportionally to maintain the same visual line density
5. Export as PNG via `toBlob()`
6. Destroy the offscreen context after download

---

## Step 9: Polish & Edge Cases

### Responsive Design
- Mobile: stack controls above canvas
- Desktop: side-by-side layout
- Touch-friendly slider sizing

### Error Handling
- WebGL not supported: show fallback message
- Invalid image file: show error toast
- Image too large: auto-resize before uploading as texture

### Performance
- Only re-render when uniforms change (dirty flag)
- Debounce slider input to avoid excessive renders during drag
- Use `requestAnimationFrame` for smooth updates

### Accessibility
- Label all inputs with `<label>` elements
- Keyboard-navigable controls
- Sufficient color contrast on UI elements

---

## Step 10: Testing & Verification

### Manual Testing Checklist
- [ ] Upload various image formats (JPEG, PNG, WebP)
- [ ] Verify halftone effect matches reference image aesthetic
- [ ] Adjust each slider and confirm real-time preview updates
- [ ] Change both colors and verify they apply correctly
- [ ] Download PNG and verify it matches the preview
- [ ] Test full-resolution download (should be original image size, not preview size)
- [ ] Test on mobile viewport (responsive layout)
- [ ] Test drag-and-drop upload
- [ ] Test with very large images (4000px+)
- [ ] Test with very small images
- [ ] Verify no WebGL errors in console

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome on Android

---

## Build Order Summary

| Step | What | Depends On |
|------|------|-----------|
| 1 | Project setup (Vite + TS) | Nothing |
| 2 | HTML layout + CSS | Step 1 |
| 3 | WebGL boilerplate | Step 1 |
| 4 | Halftone shader | Step 3 |
| 5 | Image upload | Steps 2, 3 |
| 6 | UI controls | Steps 2, 3, 4 |
| 7 | Render loop | Steps 3, 4, 5, 6 |
| 8 | Image download | Step 7 |
| 9 | Polish & edge cases | Steps 1–8 |
| 10 | Testing | Steps 1–9 |

**Estimated file count**: ~8 source files + config files
**External dependencies**: Vite only (dev dependency)
