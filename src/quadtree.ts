import * as THREE from "three";
import { colors } from "./colors";

class HCell {
  level: number;
  box: THREE.Box3;
  children: HCell[] = [];
  containsPoint: boolean = false;

  constructor(box: THREE.Box3, level: number) {
    this.box = box;
    this.level = level;
  }

  split(points: THREE.Vector3[]) {
    let pointsInCell = 0;
    for (const point of points) {
      if (pointsInCell > 1) break;
      if (this.box.containsPoint(point)) pointsInCell++;
    }
    if (pointsInCell <= 1) {
      this.containsPoint = pointsInCell > 0;
      return;
    }
    // we need to split the cell
    const horizontalSplit = Math.sqrt(this.box.min.y * this.box.max.y);
    if (this.level <= 0) {
      const verticalSplit = (this.box.min.x + this.box.max.x) / 2;

      // add four children
      const topLeft = new HCell(
        new THREE.Box3(
          new THREE.Vector3(this.box.min.x, horizontalSplit, 0),
          new THREE.Vector3(verticalSplit, this.box.max.y, 0),
        ),
        this.level - 1,
      );
      const topRight = new HCell(
        new THREE.Box3(
          new THREE.Vector3(verticalSplit, horizontalSplit, 0),
          new THREE.Vector3(this.box.max.x, this.box.max.y, 0),
        ),
        this.level - 1,
      );
      const bottomLeft = new HCell(
        new THREE.Box3(
          new THREE.Vector3(this.box.min.x, this.box.min.y, 0),
          new THREE.Vector3(verticalSplit, horizontalSplit, 0),
        ),
        this.level - 1,
      );
      const bottomRight = new HCell(
        new THREE.Box3(
          new THREE.Vector3(verticalSplit, this.box.min.y, 0),
          new THREE.Vector3(this.box.max.x, horizontalSplit, 0),
        ),
        this.level - 1,
      );
      this.children.push(topLeft, topRight, bottomLeft, bottomRight);
    } else {
      const topCell = new HCell(
        new THREE.Box3(
          new THREE.Vector3(this.box.min.x, horizontalSplit, 0),
          new THREE.Vector3(this.box.max.x, this.box.max.y, 0),
        ),
        this.level - 1,
      );
      this.children.push(topCell);
      const numBottomCells = 2 ** this.level;
      const euclidianWidth = this.box.max.x - this.box.min.x;
      const deltaX = euclidianWidth / numBottomCells;
      for (let i = 0; i < numBottomCells; i++) {
        const bottomCell = new HCell(
          new THREE.Box3(
            new THREE.Vector3(this.box.min.x + i * deltaX, this.box.min.y, 0),
            new THREE.Vector3(
              this.box.min.x + (i + 1) * deltaX,
              horizontalSplit,
              0,
            ),
          ),
          this.level - 1,
        );
        this.children.push(bottomCell);
      }
    }
    for (const child of this.children) {
      child.split(points);
    }
  }
}

export class HQuadTree {
  root: HCell;

  constructor(points: THREE.Vector3[]) {
    const boundingBox = new THREE.Box3().setFromPoints(points);
    const width = (boundingBox.max.x - boundingBox.min.x) / boundingBox.min.y;
    const height = Math.log2(boundingBox.max.y / boundingBox.min.y);

    console.log(width, height);

    let level;
    let rootWidth;
    let rootHeight;
    if (width <= 1 && height <= 1) {
      level = Math.max(
        Math.ceil(Math.log2(width)),
        Math.ceil(Math.log2(height)),
      );
      rootWidth = 2 ** level;
      rootHeight = 2 ** level;
    } else {
      level = Math.max(
        Math.ceil(Math.log2(Math.log2(width) + 1)),
        Math.ceil(Math.log2(height)),
      );
      rootWidth = 2 ** (2 ** level - 1);
      rootHeight = 2 ** level;
      console.log(rootWidth, rootHeight);
    }
    const box = new THREE.Box3(
      new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, 0),
      new THREE.Vector3(
        boundingBox.min.x + rootWidth * boundingBox.min.y,
        boundingBox.min.y * 2 ** rootHeight,
        0,
      ),
    );
    console.log(level);
    this.root = new HCell(box, level);
    this.root.split(points);
  }

  render(scene: THREE.Scene, opacity: number = 0.5) {
    const queue: HCell[] = [this.root];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const colorIndex = (this.root.level - current.level) % colors.length;
      if (current.children.length === 0) {
        if (current.containsPoint) {
          const geometry = new THREE.BoxGeometry(
            current.box.max.x - current.box.min.x,
            current.box.max.y - current.box.min.y,
            0,
          );
          const material = new THREE.MeshBasicMaterial({
            color: colors[colorIndex],
            transparent: true,
            opacity: opacity,
          });
          const boxMesh = new THREE.Mesh(geometry, material);
          boxMesh.position.set(
            current.box.getCenter(new THREE.Vector3()).x,
            current.box.getCenter(new THREE.Vector3()).y,
            0,
          );
          scene.add(boxMesh);
        }
        const helper = new THREE.Box3Helper(current.box, colors[colorIndex]);
        scene.add(helper);
      }

      for (const child of current.children) {
        queue.push(child);
      }
    }
  }
}
