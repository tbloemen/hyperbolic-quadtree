import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { initPoints, drawCyl } from "./points";
import { DynamicHQuadTree } from "./quadtree";
import { black, white } from "./colors";

const frustrumSize = 10;
const showAxes = true;
const showCone = false;

const container = document.getElementById("app")!;
const aspect = container.clientWidth / container.clientHeight;
const camera = new THREE.OrthographicCamera(
  (-frustrumSize * aspect) / 2,
  (frustrumSize * aspect) / 2,
  frustrumSize,
  -0.1,
);

const scene = new THREE.Scene();
scene.background = new THREE.Color().setHex(black);
camera.position.set(0, 0, 500);

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

const points = initPoints(
  3,
  -(frustrumSize / 2 - 0.5),
  frustrumSize / 2 - 0.5,
  0.1,
  frustrumSize - 0.5,
);

// add hyperbolic quadtree
const quadtree = new DynamicHQuadTree(points, scene);
quadtree.render(scene);

// Add point cloud to the scene
var geometry = new THREE.BufferGeometry().setFromPoints(points);
const material = new THREE.PointsMaterial({
  color: white,
  size: 4,
  map: new THREE.TextureLoader().load("/circle.png"),
});
var pointCloud = new THREE.Points(geometry, material);
scene.add(pointCloud);

if (showAxes) {
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}

if (showCone) {
  const cone = drawCyl(points[0]);
  scene.add(cone);
}

window.addEventListener("resize", onWindowResize);
function onWindowResize() {
  const newAspect = container.clientWidth / container.clientHeight;
  camera.left = (-frustrumSize * newAspect) / 2;
  camera.right = (frustrumSize * newAspect) / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  render();
}

window.addEventListener("click", onClick);

function onClick(event: MouseEvent) {
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

  if (vector.y <= 0) return;

  // Insert into quadtree
  quadtree.insert(vector);
  quadtree.render(scene);
  points.push(vector);
  scene.remove(pointCloud);

  const newGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const newPointCloud = new THREE.Points(newGeometry, material);
  scene.add(newPointCloud);

  pointCloud = newPointCloud;
  geometry = newGeometry;
  render();
}

function animate() {
  controls.update();
  render();
}

function render() {
  renderer.render(scene, camera);
}
