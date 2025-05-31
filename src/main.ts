import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { initPoints, drawCyl } from "./points";
import { HQuadTree } from "./quadtree";
import { black, white } from "./colors";

const frustrumSize = 10;
const showAxes = true;
const showCone = true;

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  (-frustrumSize * aspect) / 2,
  (frustrumSize * aspect) / 2,
  frustrumSize,
  -0.1,
);

const scene = new THREE.Scene();
scene.background = new THREE.Color().setHex(black);
camera.position.set(0, 0, 500);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = true;
controls.enablePan = true;

const points = initPoints(3, -10, 10, 0.1, 8);

// add hyperbolic quadtree
const quadtree = new HQuadTree(points);
quadtree.render(scene, 0.3);

// Add point cloud to the scene
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const material = new THREE.PointsMaterial({
  color: white,
  size: 4,
  map: new THREE.TextureLoader().load("/circle.png"),
});
const pointCloud = new THREE.Points(geometry, material);
scene.add(pointCloud);

if (showAxes) {
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}

if (showCone) {
  const cone = drawCyl(points[0]);
  scene.add(cone);
}

window.addEventListener("resize", onWindowResize, false);
function onWindowResize() {
  const newAspect = window.innerWidth / window.innerHeight;
  camera.left = (-frustrumSize * newAspect) / 2;
  camera.right = (frustrumSize * newAspect) / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {
  controls.update();
  render();
}

function render() {
  renderer.render(scene, camera);
}
