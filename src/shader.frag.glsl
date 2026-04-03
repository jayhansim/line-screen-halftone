#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D u_image;
uniform float u_frequency;   // cell size in pixels
uniform float u_contrast;
uniform float u_exposure;    // EV stops, –2 to +2
uniform float u_highlights;  // –1 to +1
uniform float u_shadows;     // –1 to +1
uniform float u_blur;        // blur radius in source-image pixels
uniform float u_invert;     // 0.0 = dark→wide bar, 1.0 = light→wide bar
uniform vec3 u_foreground;
uniform vec3 u_background;
uniform vec2 u_resolution;
uniform vec2 u_imageSize;
uniform float u_fw_scale;   // 1.0 for preview, freqScale for export (matches visual AA width)

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

  // 2D grid cell
  vec2 cellCoord = pixelCoord / u_frequency;
  vec2 cellIndex = floor(cellCoord);
  vec2 localPos  = fract(cellCoord);  // [0,1] within cell

  // Cell center UV for image sampling
  vec2 cellCenterScreen = (cellIndex + 0.5) * u_frequency;
  vec2 imgUV = imageUV(cellCenterScreen / u_resolution);

  imgUV = clamp(imgUV, 0.0, 1.0);

  // Box-blur sample — when u_blur == 0 all offsets collapse to same texel
  vec2 blurStep = vec2(u_blur) / u_imageSize;
  vec4 blurred = vec4(0.0);
  blurred += texture2D(u_image, imgUV) * 4.0;
  blurred += texture2D(u_image, imgUV + vec2( blurStep.x,  0.0)) * 2.0;
  blurred += texture2D(u_image, imgUV + vec2(-blurStep.x,  0.0)) * 2.0;
  blurred += texture2D(u_image, imgUV + vec2( 0.0,  blurStep.y)) * 2.0;
  blurred += texture2D(u_image, imgUV + vec2( 0.0, -blurStep.y)) * 2.0;
  blurred += texture2D(u_image, imgUV + vec2( blurStep.x,  blurStep.y));
  blurred += texture2D(u_image, imgUV + vec2(-blurStep.x,  blurStep.y));
  blurred += texture2D(u_image, imgUV + vec2( blurStep.x, -blurStep.y));
  blurred += texture2D(u_image, imgUV + vec2(-blurStep.x, -blurStep.y));
  blurred /= 16.0;

  float lum = dot(blurred.rgb, vec3(0.299, 0.587, 0.114));

  // Exposure (EV multiplicative)
  lum = clamp(lum * pow(2.0, u_exposure), 0.0, 1.0);
  // Highlights: affect upper half of tonal range
  lum -= u_highlights * smoothstep(0.5, 1.0, lum) * (lum - 0.5);
  lum = clamp(lum, 0.0, 1.0);
  // Shadows: affect lower half of tonal range
  lum += u_shadows * smoothstep(0.5, 0.0, lum) * (0.5 - lum);
  lum = clamp(lum, 0.0, 1.0);
  // Contrast
  lum = clamp((lum - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // barWidth: dark→wide (default) or light→wide (inverted)
  float barWidth = mix(1.0 - lum, lum, u_invert);

  // Rectangle bounds in local cell space [0,1]
  // X: centered, extends barWidth/2 left and right of center
  float halfBarX = barWidth * 0.5;

  vec2 fw = fwidth(localPos) * u_fw_scale;

  float inX = barWidth < 0.001 ? 0.0 :
    barWidth > 0.999 ? 1.0 :
    smoothstep(0.5 - halfBarX - fw.x, 0.5 - halfBarX + fw.x, localPos.x) *
    (1.0 - smoothstep(0.5 + halfBarX - fw.x, 0.5 + halfBarX + fw.x, localPos.x));

  float inY = 1.0;

  gl_FragColor = vec4(mix(u_background, u_foreground, inX * inY), 1.0);
}
