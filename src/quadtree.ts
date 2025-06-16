import * as THREE from "three";
import { colors } from "./colors";

class HCell {
  level: number;
  box: THREE.Box3;

  constructor(box: THREE.Box3, level: number) {
    this.box = box;
    this.level = level;
  }

  contains(p: THREE.Vector3): boolean {
    return this.box.containsPoint(p);
  }

  split(): HCell[] {
    var children: HCell[] = [];
    const horizontalSplit = Math.sqrt(this.box.min.y * this.box.max.y);
    if (this.level <= 0) {
      // maintain z order
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
      children.push(topLeft, topRight, bottomLeft, bottomRight);
    } else {
      // maintain l-order
      const topCell = new HCell(
        new THREE.Box3(
          new THREE.Vector3(this.box.min.x, horizontalSplit, 0),
          new THREE.Vector3(this.box.max.x, this.box.max.y, 0),
        ),
        this.level - 1,
      );
      children.push(topCell);
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
        children.push(bottomCell);
      }
    }
    return children;
  }
}

class HQuadTree {
  cell: HCell;
  point: THREE.Vector3 | null = null;
  children: HQuadTree[] = [];
  private boxMesh?: THREE.Mesh;
  private boxHelper?: THREE.Box3Helper;

  constructor(cell: HCell) {
    this.cell = cell;
  }

  insert(p: THREE.Vector3): boolean {
    if (!this.cell.contains(p)) return false;
    // point can be inserted in this quadtree.
    if (this.children.length == 0) {
      if (this.point === null) {
        this.point = p;
        return true;
      } else {
        this.subdivide();
      }
    }
    for (const child of this.children) {
      if (child.insert(p)) return true;
    }

    return false;
  }

  delete(p: THREE.Vector3): boolean {
    if (!this.cell.contains(p)) return false;

    if (this.point && isApprox(this.point, p)) {
      this.point == null;
      return true;
    }

    for (const child of this.children) {
      if (child.delete(p)) return true;
    }

    return false;
  }

  allPoints(): THREE.Vector3[] {
    var result: THREE.Vector3[] = [];
    for (const child of this.children) {
      result = result.concat(child.allPoints());
    }
    if (this.point) {
      result.push(this.point);
    }
    return result;
  }

  subdivide(): void {
    const subCells = this.cell.split();
    this.children = subCells.map((c) => new HQuadTree(c));
    if (this.point) {
      const old = this.point;
      this.point = null;
      this.insert(old);
    }
  }

  render(scene: THREE.Scene, rootLevel: number, opacity: number) {
    const colorIndex = (rootLevel - this.cell.level) % colors.length;
    const color = colors[colorIndex];
    if (this.children.length === 0) {
      const box = this.cell.box;
      const center = box.getCenter(new THREE.Vector3());
      if (this.point) {
        if (!this.boxMesh) {
          const geometry = new THREE.BoxGeometry(
            box.max.x - box.min.x,
            box.max.y - box.min.y,
            0,
          );
          const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
          });
          const boxMesh = new THREE.Mesh(geometry, material);
          boxMesh.position.set(center.x, center.y, 0);
          this.boxMesh = boxMesh;
          scene.add(this.boxMesh);
        }
      }
      if (!this.boxHelper) {
        this.boxHelper = new THREE.Box3Helper(box, color);
        scene.add(this.boxHelper);
      }
    } else {
      // has children, so nothing should be rendered.
      this.removeFromScene(scene);
    }

    for (const child of this.children) {
      child.render(scene, rootLevel, opacity);
    }
  }

  removeFromScene(scene: THREE.Scene, recursively: boolean = false) {
    if (this.boxMesh) {
      scene.remove(this.boxMesh);
      this.boxMesh = undefined;
    }
    if (this.boxHelper) {
      scene.remove(this.boxHelper);
      this.boxHelper = undefined;
    }

    if (recursively) {
      for (const child of this.children) {
        child.removeFromScene(scene, recursively);
      }
    }
  }
}

export class DynamicHQuadTree {
  private root: HQuadTree;
  private scene: THREE.Scene;
  constructor(points: THREE.Vector3[], scene: THREE.Scene) {
    this.scene = scene;
    const cell = this.defineRootHCell(points);
    this.root = new HQuadTree(cell);
    for (const point of points) {
      this.root.insert(point);
    }
  }

  insert(p: THREE.Vector3): void {
    if (!this.root.insert(p)) {
      var allPoints = this.root.allPoints();
      console.log(allPoints);
      allPoints.push(p);
      this.root.removeFromScene(this.scene, true);
      this.root = new HQuadTree(this.defineRootHCell(allPoints));
      for (const point of allPoints) {
        this.root.insert(point);
      }
    }
  }

  delete(p: THREE.Vector3): boolean {
    return this.root.delete(p);
  }

  private defineRootHCell(points: THREE.Vector3[]): HCell {
    const boundingBox = new THREE.Box3().setFromPoints(points);
    const width = (boundingBox.max.x - boundingBox.min.x) / boundingBox.min.y;
    const height = Math.log2(boundingBox.max.y / boundingBox.min.y);

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
    }
    const box = new THREE.Box3(
      new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, 0),
      new THREE.Vector3(
        boundingBox.min.x + rootWidth * boundingBox.min.y,
        boundingBox.min.y * 2 ** rootHeight,
        0,
      ),
    );
    return new HCell(box, level);
  }

  render(scene: THREE.Scene, opacity: number = 0.5) {
    this.root.render(scene, this.root.cell.level, opacity);
  }
}

function isApprox(p1: THREE.Vector3, p2: THREE.Vector3): boolean {
  const tol = 1e-6;
  return Math.abs(p1.distanceTo(p2)) <= tol;
}
