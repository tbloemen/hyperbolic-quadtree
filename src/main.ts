import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { initPoints } from "./points";

const frustrumSize = 10;

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  (-frustrumSize * aspect) / 2,
  (frustrumSize * aspect) / 2,
  frustrumSize / 2,
  -frustrumSize / 2,
);

const scene = new THREE.Scene();
scene.background = new THREE.Color().setHex(0x202020);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = true;
controls.enablePan = true;

// Add geometry to the scene
const points = initPoints(100, -4, 4, 0.1, 4);
console.log(points);
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const material = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 5.1,
});
const pointCloud = new THREE.Points(geometry, material);
scene.add(pointCloud);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

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
