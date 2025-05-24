import * as THREE from 'three';

const frustrumSize = 20;


const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(-frustrumSize * aspect / 2, frustrumSize * aspect / 2, frustrumSize / 2, -frustrumSize / 2);

const scene = new THREE.Scene();
scene.background = new THREE.Color().setHex(0x202020)
camera.position.set(0, 0, 5);


const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Add geometry to the scene

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper)

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
  const newAspect = window.innerWidth / window.innerHeight;
  camera.left = -frustrumSize * newAspect / 2;
  camera.right = frustrumSize * newAspect / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render()
}


function animate() {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  render();
}

function render() {
  renderer.render(scene, camera);
}
