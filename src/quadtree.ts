import * as THREE from "three";
import { colors } from "./colors";
import { drawGeodesic, geodesic } from "./points";

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

class SteinerPoint {
  point: THREE.Vector3;
  connected_points: THREE.Vector3[];
  closest_point: THREE.Vector3 | null = null;
  geodesics: THREE.Line[] = [];

  constructor(cell: THREE.Box3, points: THREE.Vector3[]) {
    this.connected_points = points;
    this.point = new THREE.Vector3(
      (cell.min.x + cell.max.x) / 2,
      Math.sqrt(cell.min.y * cell.max.y),
      0,
    );

    var minDistance = Number.MAX_SAFE_INTEGER;
    for (const point of points) {
      const line = drawGeodesic(this.point, point);
      this.geodesics.push(line);
      const distance = geodesic(this.point, point);
      if (distance < minDistance) {
        this.closest_point = point;
        minDistance = distance;
      }
    }
  }

  insert(p: THREE.Vector3): boolean {
    if (!this.intersectsCyl(p.x)) return false;
    this.connected_points.push(p);
    const line = drawGeodesic(this.point, p);
    this.geodesics.push(line);
    if (!this.closest_point) {
      this.closest_point = p;
    } else {
      if (geodesic(this.point, p) < geodesic(this.point, this.closest_point)) {
        this.closest_point = p;
      }
    }
    return true;
  }

  clear(scene: THREE.Scene) {
    this.connected_points = [];
    this.closest_point = null;
    for (const geodesic of this.geodesics) {
      scene.remove(geodesic);
    }

    this.geodesics = [];
  }

  intersectsCyl(x0: number): boolean {
    // triangle rendered from x0, with angel pi/2 rad.
    if (this.point.y <= 0) return false;
    return (
      this.point.x >= x0 - this.point.y && this.point.x <= x0 + this.point.y
    );
  }

  render(scene: THREE.Scene) {
    // if (this.connected_points.length == 1) return;
    for (const geodesic of this.geodesics) {
      scene.add(geodesic);
    }
  }
}

class HQuadTree {
  cell: HCell;
  point: THREE.Vector3 | null = null;
  children: HQuadTree[] = [];
  parent: HQuadTree | null;
  steinerPoint: SteinerPoint;
  private boxMesh?: THREE.Mesh;
  private boxHelper?: THREE.Box3Helper;

  constructor(cell: HCell, parent: HQuadTree | null) {
    this.cell = cell;
    this.parent = parent;
    this.steinerPoint = new SteinerPoint(cell.box, []);
  }

  insert(p: THREE.Vector3): boolean {
    if (!this.cell.contains(p)) return false;
    // point can be inserted in this quadtree.
    // this.steinerPoint.insert(p);
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

  contains(p: THREE.Vector3): boolean {
    return this.allPoints().includes(p);
  }

  allPoints(): THREE.Vector3[] {
    var result: THREE.Vector3[] = [];
    for (const child of this.children) {
      result = result.concat(child.allPoints());
    }
    if (this.point) result.push(this.point);

    return result;
  }

  allQuadtreesWithPoints(): HQuadTree[] {
    var result: HQuadTree[] = [];
    for (const tree of this.children) {
      result = result.concat(tree.allQuadtreesWithPoints());
    }
    if (this.point) result.push(this);
    return result;
  }

  query(p: THREE.Vector3): HQuadTree | null {
    if (
      !this.cell.box.containsPoint(p) ||
      (this.children.length == 0 && !this.point)
    )
      return null;
    for (const child of this.children) {
      const tree = child.query(p);
      if (tree) return tree;
    }
    return this;
  }

  query_list(p: THREE.Vector3): HQuadTree[] {
    if (
      !this.cell.box.containsPoint(p) ||
      (this.children.length == 0 && !this.point)
    )
      return [];
    let result: HQuadTree[] = [];
    for (const child of this.children) {
      const subtrees = child.query_list(p);
      result = result.concat(subtrees);
    }
    result.push(this);
    return result;
  }

  subdivide(): void {
    const subCells = this.cell.split();
    this.children = subCells.map((c) => new HQuadTree(c, this));
    if (this.point) {
      const old = this.point;
      this.point = null;
      this.insert(old);
    }
  }

  render(
    scene: THREE.Scene,
    rootLevel: number,
    showSteiner: boolean,
    opacity: number,
  ) {
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

    if (showSteiner) this.steinerPoint.render(scene);

    for (const child of this.children) {
      child.render(scene, rootLevel, showSteiner, opacity);
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
    this.steinerPoint.clear(scene);

    if (recursively) {
      for (const child of this.children) {
        child.removeFromScene(scene, recursively);
      }
    }
  }
}

export class DynamicHQuadTree {
  root: HQuadTree;
  private scene: THREE.Scene;
  constructor(points: THREE.Vector3[], scene: THREE.Scene) {
    this.scene = scene;
    const cell = this.defineRootHCell(points);
    this.root = new HQuadTree(cell, null);
    for (const point of points) {
      this.root.insert(point);
    }
  }

  insert(p: THREE.Vector3): void {
    if (!this.root.insert(p)) {
      var allPoints = this.root.allPoints();
      allPoints.push(p);
      this.root.removeFromScene(this.scene, true);
      this.root = new HQuadTree(this.defineRootHCell(allPoints), null);
      for (const point of allPoints) {
        this.root.insert(point);
      }
    }
  }

  delete(p: THREE.Vector3): boolean {
    return this.root.delete(p);
  }

  clear() {
    this.root.removeFromScene(this.scene, true);
  }

  distance(p1: THREE.Vector3, p2: THREE.Vector3): number {
    const tree1 = this.root.query(p1);
    const tree2 = this.root.query(p2);
    if (!tree1 || !tree2 || !tree1.point || !tree2.point) return -1;
    let minDistance = Number.MAX_SAFE_INTEGER;
    minDistance = this.dfs(
      tree1,
      tree2,
      [],
      geodesic(p1, tree1.point) + geodesic(p2, tree2.point),
    );
    if (minDistance == Number.MAX_SAFE_INTEGER) return -1;
    return minDistance;
  }

  dfs(
    source: HQuadTree,
    target: HQuadTree,
    visited: THREE.Vector3[],
    distance: number,
  ): number {
    if (!source.point) return -1;
    const candidates = source.steinerPoint.connected_points;
    let minDistance = Number.MAX_SAFE_INTEGER;
    for (const candidate of candidates) {
      if (visited.includes(candidate) || candidate === source.point) {
        continue;
      }
      distance += geodesic(source.point, source.steinerPoint.point);
      if (candidate === target.point) {
        console.log("Target was reached");
        return distance + geodesic(source.steinerPoint.point, target.point);
      }
      // Recursion
      const newSource = this.root.query(candidate);
      let newDistance = -1;
      let visitedCopy = visited.slice();
      visited.push(candidate);
      if (newSource && newSource.point)
        newDistance = this.dfs(
          newSource,
          target,
          visitedCopy,
          distance + geodesic(source.steinerPoint.point, newSource.point),
        );
      if (newDistance === -1) {
        continue;
      }
      if (newDistance < minDistance) {
        minDistance = newDistance;
      }
    }
    if (minDistance != Number.MAX_SAFE_INTEGER) return minDistance;
    return -1;
  }

  allTreesWithPoint(p: THREE.Vector3) {
    return this.root.query_list(p);
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

  render(showSteiner: boolean, opacity: number = 0.5) {
    this.root.render(this.scene, this.root.cell.level, showSteiner, opacity);
  }

  renderSteiner() {
    // for consecutive points p1, p2
    // find the most constrained cell that contains both p1 and p2
    const allTrees = this.root.allQuadtreesWithPoints();
    for (const tree of allTrees) {
      tree.steinerPoint.clear(this.scene);
    }
    for (var i = 0; i < allTrees.length - 1; i++) {
      const tree1 = allTrees[i];
      const tree2 = allTrees[i + 1];
      const p1 = tree1.point;
      const p2 = tree2.point;
      if (!p1 || !p2) return;
      const c = lowestCommonTree(tree1, p1, p2);
      // Fix diameter ratio to be 1, so 1 split is enough
      const child_e = c.children;
      for (const child of child_e) {
        child.steinerPoint.insert(p1);
        child.steinerPoint.insert(p2);
      }
      if (c.parent) {
        const cPrime = c.parent;
        for (const child of cPrime.children) {
          child.steinerPoint.insert(p1);
          child.steinerPoint.insert(p2);
        }
      }
    }
  }
}

function lowestCommonTree(
  tree1: HQuadTree,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
): HQuadTree {
  var parentCell = tree1;
  var containsPoints = false;
  while (!containsPoints) {
    if (!parentCell.parent)
      throw new Error("Two points don't have a common parent");
    parentCell = parentCell.parent;
    containsPoints = parentCell.contains(p1) && parentCell.contains(p2);
  }
  return parentCell;
}

function isApprox(p1: THREE.Vector3, p2: THREE.Vector3): boolean {
  const tol = 1e-2;
  return p1.distanceTo(p2) <= tol;
}
