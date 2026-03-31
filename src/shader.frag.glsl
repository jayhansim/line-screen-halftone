precision highp float;

uniform sampler2D u_image;
uniform float u_frequency;
uniform float u_angle;
uniform float u_contrast;
uniform float u_brightness;
uniform vec3 u_foreground;
uniform vec3 u_background;
uniform vec2 u_resolution;
uniform vec2 u_imageSize;

varying vec2 v_uv;

void main() {
  // Correct UV for image aspect ratio, centered in canvas
  vec2 canvasAspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 imageAspect  = vec2(u_imageSize.x / u_imageSize.y, 1.0);

  vec2 scale = canvasAspect / imageAspect;
  float s = max(scale.x, scale.y);
  vec2 uv = (v_uv - 0.5) * scale / s + 0.5;

  // Background outside image bounds
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(u_background, 1.0);
    return;
  }

  // Pixel-space coordinates
  vec2 pixelCoord = v_uv * u_resolution;

  // Line direction vectors
  float cosA = cos(u_angle);
  float sinA = sin(u_angle);
  vec2 perpDir = vec2(cosA, sinA);    // perpendicular to lines
  vec2 paraDir = vec2(-sinA, cosA);   // parallel to lines

  // Project pixel onto the perpendicular axis → determines which line cell
  float perpProj = dot(pixelCoord, perpDir);

  // Which cell are we in, and where within it?
  float cellIndex = floor(perpProj / u_frequency);
  float cellFrac  = fract(perpProj / u_frequency); // 0..1 within cell

  // Sample image at the CENTER of this line cell (perpendicular quantized)
  // This ensures every pixel across a line's width gets the same brightness
  float cellCenter = (cellIndex + 0.5) * u_frequency;
  float perpOffset = cellCenter - perpProj;
  vec2 baseSampleUV = uv + perpDir * (perpOffset / u_resolution);

  // ── Smooth luminance along the line direction ──
  // Average multiple samples along the parallel axis to eliminate
  // rapid brightness changes (JPEG noise, fine detail) and create
  // smooth, continuous line width transitions
  float lumSum = 0.0;
  float spread = u_frequency * 3.0; // blur radius in pixels (large for smooth transitions)
  vec3 lumWeights = vec3(0.299, 0.587, 0.114);

  // 9-tap Gaussian-weighted box blur along line direction
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * (-4.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.05;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * (-3.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.09;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * (-2.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.12;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * (-1.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.15;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV, 0.0, 1.0)).rgb, lumWeights) * 0.18;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * ( 1.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.15;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * ( 2.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.12;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * ( 3.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.09;
  lumSum += dot(texture2D(u_image, clamp(baseSampleUV + paraDir * ( 4.0 * spread / 4.0 / u_resolution), 0.0, 1.0)).rgb, lumWeights) * 0.05;
  float lum = lumSum;

  // Brightness + contrast
  lum = clamp((lum + u_brightness - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // Kill very low luminance values to eliminate noise dots
  lum = lum * step(0.08, lum);

  // ── Centered rectangle: sharp line in the middle of each cell ──
  float dist = abs(cellFrac - 0.5);  // 0 at center, 0.5 at edge
  float halfWidth = lum * 0.5;
  float line = step(dist, halfWidth);

  vec3 result = mix(u_background, u_foreground, line);
  gl_FragColor = vec4(result, 1.0);
}
