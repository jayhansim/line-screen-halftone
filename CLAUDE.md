# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Type-check + production build → dist/
npm run preview  # Serve the production build locally
```

There are no tests. Build (`npm run build`) is the primary way to catch TypeScript errors before committing.

## Architecture

A zero-backend, single-page app. Everything runs client-side — no server, no framework, no state management library.

### Data flow

```
File/Drop → FileReader → HTMLImageElement → WebGL texture
                                                 │
Slider/Color inputs → HalftoneParams ──────→ Fragment shader → Canvas
                                                                    │
                                              Download button → offscreen WebGL → PNG blob
```

### Key files

| File | Role |
|------|------|
| `src/webgl.ts` | `HalftoneRenderer` class — owns the WebGL context, compiles shaders, uploads textures, drives rendering and export |
| `src/shader.frag.glsl` | The halftone algorithm: luminance → line thickness via `fract()` + `smoothstep()` + `fwidth()` |
| `src/shader.vert.glsl` | Passthrough vertex shader for a full-screen quad |
| `src/controls.ts` | Reads DOM input values into `HalftoneParams`, syncs color picker ↔ hex text inputs |
| `src/main.ts` | Entry point — wires upload, drag-drop, controls, resize observer, and download together |

### Landing page & info overlay

The app opens on a full-screen landing page (`#landing` in `index.html`) before any image is loaded. Once a file is dropped or selected, the landing fades out and is removed from the DOM.

- **Drop zone** (`#landingDropzone`) — drag-and-drop only; clicking it does nothing
- **Select file button** (`#landingSelectBtn`) — the sole click-to-upload trigger for the hidden `#landingFileInput`
- **Info button** (`#landingInfoBtn`) — opens the about modal (`#infoOverlay`)
- **Info overlay** — closes on close button click, backdrop click, or Escape key

Assets live in `asset/`: `logo-landing.svg` (landing + modal header), `logo-icon.png` (badge), `welcome-background.jpg` (full-screen background).

### GLSL shader essentials

The fragment shader (`shader.frag.glsl`) requires `#extension GL_OES_standard_derivatives : enable` at the top — this enables `fwidth()` for anti-aliased line edges. The JS side must also call `gl.getExtension('OES_standard_derivatives')` before compiling.

All shader uniforms are listed in `webgl.ts` as private fields (`uFrequency`, `uAngle`, etc.) and must match the `uniform` declarations in the GLSL exactly.

### Export (full-resolution download)

`exportFromImage()` in `webgl.ts` creates a separate offscreen WebGL context at the original image's pixel dimensions, re-compiles the same shaders, re-uploads the source `HTMLImageElement` as a texture, and scales `u_frequency` proportionally (`imgH / previewH`) so the visual line density matches the preview exactly.

### Dev testing helper

`window.__loadFromUrl(url)` is exposed in `main.ts` to programmatically load an image by URL without using the file input — useful for in-browser testing (e.g. loading `/References/8kZdF4nVhr_600x.webp`).

### GLSL imported via Vite

`.glsl` files are imported as raw strings via `vite-plugin-glsl`. The type declaration is in `src/glsl.d.ts`. When adding new uniforms, update both the GLSL file and the corresponding uniform location fields + `getUniform()` calls in `HalftoneRenderer`.
