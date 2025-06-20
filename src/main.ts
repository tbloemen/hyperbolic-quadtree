import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { initPoints, drawCyl, geodesic } from "./points";
import { DynamicHQuadTree } from "./quadtree";
import { black, white } from "./colors";

const frustrumSize = 10;
const container = document.getElementById("app")!;
const aspect = container.clientWidth / container.clientHeight;
const camera = new THREE.OrthographicCamera(
  (-frustrumSize * aspect) / 2,
  (frustrumSize * aspect) / 2,
  frustrumSize,
  -0.1,
);
camera.position.set(0, 0, 500);

const scene = new THREE.Scene();
scene.background = new THREE.Color().setHex(black);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);
renderer.setAnimationLoop(animate);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = true;
controls.enablePan = true;

enum InteractMode {
  Add,
  Cone,
  ClosestPoint,
}

const showAxes = true;
let showSteiner = true;
let mode = InteractMode.Add;
let myClosestPoint: THREE.Vector3;
let highlightMesh: THREE.Mesh | null = null;
let points: THREE.Vector3[] = [];
let quadtree: DynamicHQuadTree;
let cone: THREE.Mesh;
let pointCloud: THREE.Points;
let geometry: THREE.BufferGeometry;

const material = new THREE.PointsMaterial({
  color: white,
  size: 8,
  map: new THREE.TextureLoader().load("/circle.png"),
});

function resetPoints() {
  scene.clear();
  scene.background = new THREE.Color().setHex(black);

  points = initPoints(
    2,
    -(frustrumSize / 2 - 0.5),
    frustrumSize / 2 - 0.5,
    0.1,
    frustrumSize - 0.5,
  );

  // add hyperbolic quadtree
  quadtree = new DynamicHQuadTree(points, scene);
  if (Number.isNaN(quadtree.root.cell.level)) resetPoints();
  quadtree.renderSteiner();
  quadtree.render(showSteiner);

  // Add point cloud to the scene
  var geometry = new THREE.BufferGeometry().setFromPoints(points);
  var pointCloud = new THREE.Points(geometry, material);
  scene.add(pointCloud);

  if (showAxes) {
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
  }

  render();
}

function onClick(event: MouseEvent) {
  switch (mode) {
    case InteractMode.Add:
      addPoint(event);
      break;
    case InteractMode.Cone:
      showCone(event);
      break;
    case InteractMode.ClosestPoint:
      closestPoint(event);
      break;
    default:
      throw new Error("Should be unreachable");
  }
}

function addPoint(event: MouseEvent) {
  const vector = clickCoordinates(event);
  if (vector.y <= 0) return;

  // Insert into quadtree
  quadtree.insert(vector);
  quadtree.renderSteiner();
  quadtree.render(showSteiner);
  points.push(vector);
  scene.remove(pointCloud);

  const newGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const newPointCloud = new THREE.Points(newGeometry, material);
  scene.add(newPointCloud);

  pointCloud = newPointCloud;
  geometry = newGeometry;
  render();
}

function showCone(event: MouseEvent) {
  const vector = clickCoordinates(event);
  let closestPoint = null;
  for (const point of points) {
    const distance = vector.distanceTo(point);
    console.log(distance);
    if (distance <= 0.4) {
      closestPoint = point;
      break;
    }
  }
  console.log(closestPoint);
  if (cone) scene.remove(cone);
  if (closestPoint) {
    cone = drawCyl(closestPoint);
    scene.add(cone);
  }
}

function closestPoint(event: MouseEvent) {
  const vector = clickCoordinates(event);
  const trees = quadtree.allTreesWithPoint(vector);
  let minDistance = Number.MAX_SAFE_INTEGER;
  let selectedPoint = null;
  for (const tree of trees) {
    const closest_steiner = tree.steinerPoint.closest_point;
    if (!closest_steiner) continue;
    const distance = geodesic(vector, closest_steiner);
    if (distance < minDistance) {
      minDistance = distance;
      selectedPoint = tree.point;
    }
  }
  console.log("Minimal Distance:", minDistance);
  console.log("selectedPoint:", selectedPoint);
  if (selectedPoint) {
    myClosestPoint = selectedPoint;
    highlightClosestPoint();
    const text = document.getElementById("closestText");
    if (text) text.textContent = `Closest point: ${minDistance}`;
  }
}

function highlightClosestPoint() {
  if (!myClosestPoint) return;

  // Remove existing highlight
  if (highlightMesh) {
    scene.remove(highlightMesh);
    highlightMesh.geometry.dispose();
    (highlightMesh.material as THREE.Material).dispose();
    highlightMesh = null;
  }

  // Create a small red sphere
  const geometry = new THREE.SphereGeometry(0.1, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  highlightMesh = new THREE.Mesh(geometry, material);
  highlightMesh.position.copy(myClosestPoint);
  scene.add(highlightMesh);
}

function clickCoordinates(event: MouseEvent): THREE.Vector3 {
  const rect = renderer.domElement.getBoundingClientRect();

  // Convert mouse click to normalized device coordinates (-1 to +1)
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );

  // Create a 3D point in clip space and unproject it to world space
  const vector = new THREE.Vector3(mouse.x, mouse.y, 0);
  vector.unproject(camera);
  vector.z = 0;
  return vector;
}

function toggleMode() {
  console.log("Toggled!");
  const modeValues = Object.values(InteractMode).filter(
    (v) => typeof v === "number",
  );
  const maxValue = Math.max(...modeValues);
  const nextMode = mode + 1 > maxValue ? 0 : mode + 1;
  mode = nextMode;
  const modeButton = document.getElementById("modeBtn");
  if (modeButton) modeButton.textContent = `Toggle Mode: ${InteractMode[mode]}`;
}

function toggleSteiner() {
  showSteiner = !showSteiner;
  if (!showSteiner) {
    quadtree.clear();
  } else {
    quadtree.renderSteiner();
  }
  quadtree.render(showSteiner);
  render();
}

function onWindowResize() {
  const newAspect = container.clientWidth / container.clientHeight;
  camera.left = (-frustrumSize * newAspect) / 2;
  camera.right = (frustrumSize * newAspect) / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  render();
}

function animate() {
  controls.update();
  render();
}

function render() {
  renderer.render(scene, camera);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener("click", onClick);

const resetButton = document.getElementById("resetBtn");
resetButton?.addEventListener("click", resetPoints);

const modeButton = document.getElementById("modeBtn");
modeButton?.addEventListener("click", toggleMode);

const showSteinerButton = document.getElementById("showSteinerBtn");
showSteinerButton?.addEventListener("click", toggleSteiner);

resetPoints();
