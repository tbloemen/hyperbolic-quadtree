import * as THREE from "three";
import { white } from "./colors";

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

export function geodesic(p1: THREE.Vector3, p2: THREE.Vector3) {
  const dist = 2 * Math.asinh(p1.distanceTo(p2) / (2 * Math.sqrt(p1.y * p2.y)));
  return dist;
}

export function drawGeodesic(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  segments: number = 64,
  color: number = 0xffffff,
) {
  const material = new THREE.LineBasicMaterial({ color });
  // vertical line case
  if (Math.abs(p1.x - p2.x) < 1e-6) {
    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    return new THREE.Line(geometry, material);
  }

  // circle parameters
  const cx =
    (p1.x ** 2 + p1.y ** 2 - p2.x ** 2 - p2.y ** 2) / (2 * (p1.x - p2.x));
  const r = Math.sqrt((p1.x - cx) ** 2 + p1.y ** 2);

  // angles
  const angle1 = Math.atan2(p1.y, p1.x - cx);
  const angle2 = Math.atan2(p2.y, p2.x - cx);
  const points = [];

  const dir = angle2 > angle1 ? 1 : -1;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = angle1 + dir * t * Math.abs(angle2 - angle1);
    points.push(
      new THREE.Vector3(cx + r * Math.cos(angle), r * Math.sin(angle), 0),
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, material);
}

export function drawCyl(p: THREE.Vector3, color: number = white): THREE.Mesh {
  const scalar = 500;
  const geometry = new THREE.ConeGeometry(scalar, scalar);
  geometry.translate(0, -scalar / 2, 0);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.5,
  });
  const cone = new THREE.Mesh(geometry, material);
  cone.rotation.x = Math.PI;
  cone.position.set(p.x, 0, 0);
  return cone;
}
