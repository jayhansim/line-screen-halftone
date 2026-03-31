#extension GL_OES_standard_derivatives : enable
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

  // Scale UVs so the image fills the canvas (cover)
  vec2 scale = canvasAspect / imageAspect;
  float s = max(scale.x, scale.y);
  vec2 uv = (v_uv - 0.5) * scale / s + 0.5;

  // Clamp to image bounds — background outside image
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(u_background, 1.0);
    return;
  }

  // Sample image
  vec3 color = texture2D(u_image, uv).rgb;

  // Luminance (perceptual weights)
  float lum = dot(color, vec3(0.299, 0.587, 0.114));

  // Brightness + contrast adjustment
  lum = clamp((lum + u_brightness - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // Rotate pixel position by angle
  float cosA = cos(u_angle);
  float sinA = sin(u_angle);

  // Use pixel-space coordinates for stable line density
  vec2 pixelCoord = v_uv * u_resolution;
  float proj = pixelCoord.x * cosA + pixelCoord.y * sinA;

  // Repeating line pattern [0..1) within each line cell
  float linePos = fract(proj / u_frequency);

  // Anti-aliased edge using derivatives
  float edgeWidth = fwidth(linePos) * 1.0;
  float line = smoothstep(lum - edgeWidth, lum + edgeWidth, linePos);

  // Mix foreground (line) and background
  vec3 result = mix(u_foreground, u_background, line);
  gl_FragColor = vec4(result, 1.0);
}
