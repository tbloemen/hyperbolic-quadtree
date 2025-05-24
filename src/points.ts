import * as THREE from "three";
export function initPoints(
  n: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
) {
  const points = [];
  const domain_x = xMax - xMin;
  const domain_y = yMax - yMin;

  for (let i = 0; i < n; i++) {
    const x = xMin + Math.random() * domain_x;
    const y = yMin + Math.random() * domain_y;
    points.push(new THREE.Vector3(x, y, 0));
  }
  return points;
}
