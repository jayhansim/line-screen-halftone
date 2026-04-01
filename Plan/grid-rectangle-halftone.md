# Plan: Grid-Based Rectangle Halftone (Clean, No Noise)

## Context

The current shader renders parallel lines using a continuous `fract()`-based sawtooth on per-pixel luminance. Because each pixel samples its **own** UV position in the image, adjacent pixels within the same "period" see slightly different luminance values → threshold varies pixel-by-pixel → appears as noise/grain.

The book cover ("Poor Charlie's Almanack") uses a **grid of rectangles** (vertical bars):
- Each cell in a regular 2D grid contains one centered rectangle
- The rectangle's **height** varies proportionally with local luminance (dark → tall, light → short)
- All pixels within a cell share the **same** luminance sample (the cell center) → no noise, perfectly clean geometry

## Root Cause of Noise

Current approach: every fragment samples `texture2D(u_image, itsOwnUV)`.  
Fix: every fragment in a cell computes which cell it's in, then samples `texture2D(u_image, cellCenterUV)`.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/shader.frag.glsl` | Full replacement — grid rectangle algorithm |
| `src/webgl.ts` | Add `margin` to `HalftoneParams`; add `uMargin` uniform; wire in `render()` and `exportFromImage()` |
| `src/controls.ts` | Add `margin` to `getParams()`; add slider to `setupControls()` |
| `index.html` | Add margin slider control group; rename "Line Size" → "Cell Size" |

---

## New Shader Algorithm (`src/shader.frag.glsl`)

```glsl
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D u_image;
uniform float u_frequency;   // cell size in pixels
uniform float u_angle;       // rotation in radians
uniform float u_contrast;
uniform float u_brightness;
uniform float u_margin;      // horizontal gap between bars (fraction of cell, 0–1)
uniform vec3 u_foreground;
uniform vec3 u_background;
uniform vec2 u_resolution;
uniform vec2 u_imageSize;

varying vec2 v_uv;

vec2 imageUV(vec2 screenUV) {
  vec2 canvasAspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 imageAspect  = vec2(u_imageSize.x / u_imageSize.y, 1.0);
  vec2 scale = canvasAspect / imageAspect;
  float s = max(scale.x, scale.y);
  return (screenUV - 0.5) * scale / s + 0.5;
}

void main() {
  vec2 pixelCoord = v_uv * u_resolution;
  float cosA = cos(u_angle);
  float sinA = sin(u_angle);
  vec2 center = u_resolution * 0.5;

  // Rotate pixel coord into grid space
  vec2 p = pixelCoord - center;
  vec2 rotated = vec2(p.x * cosA - p.y * sinA,
                      p.x * sinA + p.y * cosA) + center;

  // 2D grid cell
  vec2 cellCoord = rotated / u_frequency;
  vec2 cellIndex = floor(cellCoord);
  vec2 localPos  = fract(cellCoord);  // [0,1] within cell

  // Cell center: unrotate back to screen UV → image UV
  vec2 cellCenterRot = (cellIndex + 0.5) * u_frequency;
  vec2 cp = cellCenterRot - center;
  vec2 cellCenterScreen = vec2(cp.x * cosA + cp.y * sinA,
                               -cp.x * sinA + cp.y * cosA) + center;
  vec2 imgUV = imageUV(cellCenterScreen / u_resolution);

  if (imgUV.x < 0.0 || imgUV.x > 1.0 ||
      imgUV.y < 0.0 || imgUV.y > 1.0) {
    gl_FragColor = vec4(u_background, 1.0);
    return;
  }

  // Sample luminance once per cell (all pixels in cell share this value)
  vec3 col = texture2D(u_image, imgUV).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  lum = clamp((lum + u_brightness - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // Dark = tall bar (ink-on-paper: more ink in shadows)
  float barHeight = 1.0 - lum;

  // Rectangle bounds in local cell space
  float halfMarginX = u_margin * 0.5;
  float halfBarY    = barHeight * 0.5;

  vec2 fw = fwidth(localPos);

  float inX = smoothstep(halfMarginX - fw.x, halfMarginX + fw.x, localPos.x) *
    (1.0 - smoothstep(1.0 - halfMarginX - fw.x, 1.0 - halfMarginX + fw.x, localPos.x));

  float inY = smoothstep(0.5 - halfBarY - fw.y, 0.5 - halfBarY + fw.y, localPos.y) *
    (1.0 - smoothstep(0.5 + halfBarY - fw.y, 0.5 + halfBarY + fw.y, localPos.y));

  gl_FragColor = vec4(mix(u_background, u_foreground, inX * inY), 1.0);
}
```

---

## `src/webgl.ts` Changes

1. Add `margin: number` to `HalftoneParams` interface
2. Add `private uMargin: WebGLUniformLocation` field
3. In `constructor`: `this.uMargin = this.getUniform('u_margin')`
4. In `render()`: `gl.uniform1f(this.uMargin, params.margin)`
5. In `exportFromImage()`: `offGL.uniform1f(getU('u_margin'), params.margin)`
   - `margin` does NOT need frequency scaling (it's a ratio, not pixels)

---

## `src/controls.ts` Changes

In `getParams()`, add:
```ts
margin: parseFloat((document.getElementById('margin') as HTMLInputElement).value),
```

In `setupControls()` sliders array, add:
```ts
{ id: 'margin', valId: 'marginVal', format: (v: number) => `${Math.round(v * 100)}%` },
```

---

## `index.html` Changes

1. Rename label `Line Size` → `Cell Size`
2. Add margin control group after the frequency control:
```html
<div class="control-group">
  <label>Bar Gap <span class="value" id="marginVal">15%</span></label>
  <input type="range" id="margin" min="0" max="0.6" value="0.15" step="0.01" />
</div>
```

---

## Default Parameters for Book Cover Look

| Param | Value | Rationale |
|-------|-------|-----------|
| `frequency` | 40 | ~40px cells at preview size |
| `margin` | 0.15 | ~15% gap → visible column separation |
| `angle` | 0° | Vertical bars |
| `contrast` | 1.5 | Existing default |
| `brightness` | 0.0 | Existing default |
| Foreground | `#1B2A4A` | Navy (the "ink") |
| Background | `#D4A843` | Gold |

---

## Verification

1. `npm run build` — must pass TypeScript without errors
2. Open dev server, use `window.__loadFromUrl('/References/8kZdF4nVhr_600x.webp')`
3. Verify: clean grid of vertical bars, zero grain, dark areas = tall bars
4. Adjust margin slider: 0% = bars touch edge-to-edge, higher = wider gaps
5. Test rotation with angle slider — grid should rotate cleanly
6. Download PNG and confirm export resolution matches original image