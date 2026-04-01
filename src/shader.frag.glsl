#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform sampler2D u_image;
uniform float u_frequency;   // cell size in pixels
uniform float u_angle;       // rotation in radians
uniform float u_contrast;
uniform float u_brightness;
uniform float u_margin;      // horizontal gap between bars (fraction of cell, 0–1)
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

  // Cell center: unrotate back to screen UV then to image UV
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

  // Sample luminance once per cell — all pixels in the cell share this value,
  // which eliminates per-pixel noise from image texture detail
  vec3 col = texture2D(u_image, imgUV).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  lum = clamp((lum + u_brightness - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // barWidth: dark→wide (default) or light→wide (inverted)
  float barWidth = mix(1.0 - lum, lum, u_invert);

  // Rectangle bounds in local cell space [0,1]
  // X: centered, extends barWidth/2 left and right of center
  // Y: leave u_margin/2 gap on each side
  float halfBarX    = barWidth * 0.5;
  float halfMarginY = u_margin * 0.5;

  vec2 fw = fwidth(localPos) * u_fw_scale;

  float inX = barWidth < 0.001 ? 0.0 :
    barWidth > 0.999 ? 1.0 :
    smoothstep(0.5 - halfBarX - fw.x, 0.5 - halfBarX + fw.x, localPos.x) *
    (1.0 - smoothstep(0.5 + halfBarX - fw.x, 0.5 + halfBarX + fw.x, localPos.x));

  float inY = u_margin < 0.001 ? 1.0 :
    smoothstep(halfMarginY - fw.y, halfMarginY + fw.y, localPos.y) *
    (1.0 - smoothstep(1.0 - halfMarginY - fw.y, 1.0 - halfMarginY + fw.y, localPos.y));

  gl_FragColor = vec4(mix(u_background, u_foreground, inX * inY), 1.0);
}
