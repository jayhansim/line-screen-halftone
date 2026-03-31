# Line Screen Halftone Effect — Technical Research

## 1. What Is a Line Screen Halftone?

A **line screen halftone** represents tonal values using parallel lines of varying thickness. Unlike dot halftone (which uses circles of varying size), line halftone uses continuous stripes where:

- **Bright areas** = thicker foreground lines (more foreground color visible)
- **Dark areas** = thinner foreground lines (more background color visible)

The human visual system spatially averages these patterns, perceiving continuous tones from binary line patterns.

### Reference: Poor Charlie's Almanack Book Cover

The reference image uses **vertical parallel lines** in gold/yellow on a dark navy background. Key characteristics:

- Lines are **vertical** (0° angle)
- Line **thickness varies** based on the luminance of the underlying portrait
- Only **two colors** are used: gold (foreground lines) and navy (background)
- The effect creates an engraving/lithographic aesthetic
- High contrast between the two colors enhances the graphic quality

---

## 2. Core Algorithm

### Step-by-step Process

```
For each pixel (x, y) in the output:

1. Sample the source image at (x, y)
2. Convert to luminance:
   L = 0.299 * R + 0.587 * G + 0.114 * B

3. Project pixel position onto the line direction:
   linePos = x * cos(angle) + y * sin(angle)

4. Get position within current line cell:
   cellPos = fract(linePos * frequency)

5. Map luminance to line thickness:
   thickness = L * maxThickness
   (optionally apply gamma: thickness = pow(L, gamma) * maxThickness)

6. Render decision:
   if cellPos < thickness → foreground color
   else → background color

7. Anti-aliasing (smooth edges):
   Use smoothstep() instead of hard threshold
```

### Key Parameters

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| **Frequency** | Lines per unit / line density | 10–150 LPI |
| **Angle** | Line rotation | 0°–360° |
| **Contrast** | Amplifies tonal differences | 0.5–3.0x |
| **Brightness** | Offsets overall luminance | -1.0 to 1.0 |
| **Foreground color** | Color of the lines | Any color (e.g., gold) |
| **Background color** | Color between lines | Any color (e.g., navy) |
| **Gamma** | Non-linear brightness mapping | 0.5–3.0 |

---

## 3. Implementation Approaches

### Option A: WebGL / GLSL Shader (Recommended)

**Why recommended:** GPU-accelerated, real-time preview as users adjust parameters, handles large images efficiently.

#### Fragment Shader (Conceptual)

```glsl
uniform sampler2D u_image;
uniform float u_frequency;
uniform float u_angle;
uniform float u_contrast;
uniform vec3 u_foreground;
uniform vec3 u_background;

varying vec2 v_uv;

void main() {
    // 1. Sample source image
    vec3 color = texture2D(u_image, v_uv).rgb;

    // 2. Convert to luminance
    float lum = dot(color, vec3(0.299, 0.587, 0.114));

    // 3. Apply contrast adjustment
    lum = clamp((lum - 0.5) * u_contrast + 0.5, 0.0, 1.0);

    // 4. Rotate coordinates for line angle
    float cosA = cos(u_angle);
    float sinA = sin(u_angle);
    vec2 rotated = vec2(
        v_uv.x * cosA + v_uv.y * sinA,
        -v_uv.x * sinA + v_uv.y * cosA
    );

    // 5. Create repeating line pattern
    float linePos = fract(rotated.x * u_frequency);

    // 6. Map luminance to line thickness with anti-aliasing
    float edge = fwidth(linePos) * 0.5;
    float line = smoothstep(lum - edge, lum + edge, linePos);

    // 7. Mix foreground and background colors
    vec3 result = mix(u_foreground, u_background, line);
    gl_FragColor = vec4(result, 1.0);
}
```

#### Pros
- Real-time parameter adjustment (instant feedback)
- Handles high-resolution images without lag
- Smooth anti-aliasing built into the shader
- Clean, scalable rendering

#### Cons
- Requires WebGL support (99%+ of modern browsers)
- Slightly more complex initial setup
- Download requires reading pixels back from GPU (`readPixels` or `toBlob`)

#### Libraries / Frameworks to Consider
- **Three.js** — Popular 3D/WebGL library, good for shader-based effects
- **@paper-design/shaders-react** — The library used by the reference site (React + WebGL shaders)
- **regl** — Lightweight functional WebGL wrapper
- **Raw WebGL** — No dependencies, full control
- **OGL** — Lightweight WebGL library

---

### Option B: Canvas 2D

```javascript
// Simplified algorithm
const imageData = ctx.getImageData(0, 0, width, height);
const output = ctx.createImageData(width, height);

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const lum = 0.299 * imageData.data[i]
                  + 0.587 * imageData.data[i + 1]
                  + 0.114 * imageData.data[i + 2];

        // Line position (vertical lines)
        const linePos = (x * frequency) % 1;
        const thickness = lum / 255;

        // Binary decision
        const isForeground = linePos < thickness;
        output.data[i]     = isForeground ? fgR : bgR;
        output.data[i + 1] = isForeground ? fgG : bgG;
        output.data[i + 2] = isForeground ? fgB : bgB;
        output.data[i + 3] = 255;
    }
}

ctx.putImageData(output, 0, 0);
```

#### Pros
- No WebGL dependency
- Simpler to understand and debug
- Works everywhere

#### Cons
- CPU-bound — slow for large images
- No real-time parameter adjustment (need to re-render on change)
- Manual anti-aliasing is complex

---

### Option C: SVG-based

Generate SVG `<rect>` or `<path>` elements with varying widths.

#### Pros
- Vector output (infinitely scalable)
- Small file size

#### Cons
- Very slow for detailed images (thousands of SVG elements)
- Not suitable for real-time preview
- Complex to implement well

---

## 4. Recommended Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Framework** | React (Next.js or Vite) | Component architecture, easy state management for sliders |
| **Rendering** | WebGL via raw API or lightweight library | Real-time shader preview |
| **Shader** | Custom GLSL fragment shader | Full control over halftone algorithm |
| **UI Controls** | Custom sliders + color pickers | Frequency, angle, contrast, colors |
| **Image Upload** | HTML File Input + FileReader API | Standard browser APIs |
| **Image Download** | Canvas `toBlob()` + download link | Standard browser APIs |
| **Styling** | Tailwind CSS or plain CSS | Fast UI development |

### Minimal Dependencies Approach (Simpler)
- **Vite** for build tooling
- **Vanilla JS or React** for UI
- **Raw WebGL** for the shader (avoids heavy 3D library overhead)
- **HTML `<input type="file">`** for upload
- **`canvas.toBlob()`** for download

---

## 5. Reference Site Analysis: shaders.paper.design/halftone-dots

The reference site uses:

- **React** component architecture
- **`@paper-design/shaders-react`** NPM package for WebGL shader components
- **Real-time WebGL rendering** with parameter binding

### Exposed Controls
- **Type**: Classic, gooey, holes, soft
- **Grid pattern**: Square, hex
- **Size**: 0–1 slider
- **Radius**: 0–2 slider
- **Colors**: Background color picker, foreground color picker, "original colors" toggle
- **Contrast**: Slider
- **Inverted**: Toggle
- **Grain**: Mixer, overlay, size controls
- **Transform**: Scale, rotation, offset X/Y

### Key Takeaway
The site demonstrates that a **WebGL shader approach** enables smooth, real-time parameter adjustment — exactly the UX we want. However, their implementation is for **dot halftone**, not line halftone. The shader math differs:

- **Dots**: `distance(cellCenter, fragCoord) < radius` (circular threshold)
- **Lines**: `fract(projectedCoord) < thickness` (linear threshold)

---

## 6. Image Upload & Download Implementation

### Upload Flow

```
User clicks upload → <input type="file" accept="image/*">
→ FileReader.readAsDataURL(file)
→ Create Image() object from data URL
→ Load image as WebGL texture (gl.texImage2D)
→ Render with halftone shader
```

### Download Flow

```
User clicks download
→ Render final frame to canvas at full resolution
→ canvas.toBlob(callback, 'image/png')
→ Create temporary URL with URL.createObjectURL(blob)
→ Trigger download via programmatic <a> click
→ Clean up with URL.revokeObjectURL()
```

### Considerations
- For **high-resolution download**, render to an offscreen canvas at full image resolution (not viewport size)
- Support **PNG** (lossless, best for graphic art) and optionally **JPEG/WebP**
- Consider adding **SVG export** by generating line elements programmatically (optional stretch goal)

---

## 7. Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Web App                     │
├──────────────┬──────────────────────────────┤
│   Controls   │      Preview Canvas          │
│              │                              │
│  [Upload]    │   ┌──────────────────────┐   │
│              │   │                      │   │
│  Color FG    │   │   WebGL Canvas       │   │
│  Color BG    │   │   (Halftone Shader)  │   │
│              │   │                      │   │
│  Size ───    │   └──────────────────────┘   │
│  Contrast ── │                              │
│  Angle ────  │                              │
│              │                              │
│  [Download]  │                              │
├──────────────┴──────────────────────────────┤
│              Footer                          │
└─────────────────────────────────────────────┘
```

### Data Flow

```
Image File → FileReader → Image Object → WebGL Texture
                                              │
                                              ▼
Slider Values → Uniform Updates → Fragment Shader → Canvas Output
                                                        │
                                                        ▼
                                              Download Button → PNG Blob
```

---

## 8. Key Technical Challenges

1. **Aspect ratio handling**: Maintain source image proportions in the preview canvas
2. **High-DPI displays**: Account for `devicePixelRatio` for crisp rendering
3. **Large image download**: Render at original image resolution, not preview size
4. **WebGL texture limits**: Large images may exceed `MAX_TEXTURE_SIZE` — need to check and potentially resize
5. **Color space**: Work in linear color space for correct brightness calculations (apply sRGB gamma correction)
6. **Anti-aliasing**: Use `smoothstep()` with `fwidth()` for clean line edges at all zoom levels
7. **Cross-browser**: Ensure WebGL context creation works across browsers; provide Canvas 2D fallback

---

## 9. Summary

The **WebGL shader approach** is the best fit for this project because:

1. It enables **real-time preview** as users adjust parameters
2. The halftone algorithm maps naturally to a **fragment shader**
3. Performance is excellent even for large images
4. The reference site validates this approach for a similar use case

The core shader is straightforward (~20 lines of GLSL). The main development effort will be in:
- Setting up the WebGL rendering pipeline
- Building the UI controls (sliders, color pickers, upload/download)
- Handling image loading as WebGL textures
- Implementing high-resolution export
