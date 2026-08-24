import { WIDTH, HEIGHT } from "../constants";

// Builds an SVG transform-attribute string (unitless user-space units,
// not CSS) that keeps world point (focalX, focalY) centered on screen at
// the given zoom level. Apply via the `transform` attribute on a <g>, not
// the CSS `transform` style property.
export const cameraTransform = (
  focalX: number,
  focalY: number,
  zoom: number,
): string => {
  const tx = WIDTH / 2 - focalX * zoom;
  const ty = HEIGHT / 2 - focalY * zoom;
  return `translate(${tx} ${ty}) scale(${zoom})`;
};
