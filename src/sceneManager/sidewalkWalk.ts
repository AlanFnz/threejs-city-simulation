import * as THREE from 'three';
import type { Crosswalk } from '../city/vehicle/crosswalk';

export class SidewalkWalk {
  points: THREE.Vector3[] = [];
  distances: number[] = [];
  crossings: { crossing: Crosswalk; from: number; to: number }[] = [];
  length = 0;
  duration: number;
  constructor(
    points: THREE.Vector3[],
    crosswalks: Map<THREE.Vector3, Crosswalk>,
    minutesPerTile: number
  ) {
    for (const point of points) {
      const prev = this.points[this.points.length - 1];
      if (prev && point.distanceToSquared(prev) < 1e-9) continue;
      const from = this.length;
      if (prev) this.length += point.distanceTo(prev);
      const crossing = crosswalks.get(point);
      if (crossing && crossing === crosswalks.get(prev))
        this.crossings.push({ crossing, from, to: this.length });
      this.points.push(point);
      this.distances.push(this.length);
    }
    this.duration = Math.max(1, this.length * minutesPerTile);
  }
  place(person: THREE.Object3D, d: number, reverse: boolean, offset: number) {
    const end = this.distances.findIndex((v, i) => i > 0 && v >= d);
    const i = end < 1 ? this.points.length - 1 : end;
    const a = this.points[i - 1],
      b = this.points[i];
    person.position.lerpVectors(
      a,
      b,
      THREE.MathUtils.clamp(
        (d - this.distances[i - 1]) /
          (this.distances[i] - this.distances[i - 1]),
        0,
        1
      )
    );
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    person.position.x += offset * Math.cos(yaw);
    person.position.z -= offset * Math.sin(yaw);
    person.rotation.y = yaw + (reverse ? Math.PI : 0);
  }
}
