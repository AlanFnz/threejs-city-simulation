import * as THREE from 'three';
import { VehicleGraphNode } from './vehicleGraphNode';
import CONFIG from '../../config';
import type { IAssetManager } from '../../assetManager';
import type { Crosswalk } from './crosswalk';

const FORWARD = new THREE.Vector3(1, 0, 0);

export class Vehicle extends THREE.Group {
  readonly heading = new THREE.Vector3();
  private speed = CONFIG.VEHICLE.SPEED * 1000;
  private remaining = 0;
  private movingAge = 0;
  private materials = new Set<THREE.Material>();
  private end = new THREE.Vector3();

  constructor(
    private origin: VehicleGraphNode,
    private destination: VehicleGraphNode,
    assetManager: IAssetManager
  ) {
    super();
    const mesh = assetManager.createRandomVehicleMesh();
    if (mesh) {
      this.add(mesh);
      mesh.traverse((object) => {
        const part = object as THREE.Mesh;
        if (!part.isMesh) return;
        const materials = Array.isArray(part.material)
          ? part.material
          : [part.material];
        for (const material of materials) this.materials.add(material);
      });
    }
    this.startSegment();
    this.updateOpacity();
  }

  private startSegment(): void {
    this.origin.getWorldPosition(this.position);
    this.destination.getWorldPosition(this.end);
    this.heading.subVectors(this.end, this.position);
    this.remaining = this.heading.length();
    this.heading.normalize();
    this.quaternion.setFromUnitVectors(FORWARD, this.heading);
  }

  private gapToCar(other: Vehicle): number {
    if (other === this || this.heading.dot(other.heading) < 0.9)
      return Infinity;
    const dx = other.position.x - this.position.x;
    const dz = other.position.z - this.position.z;
    const ahead = dx * this.heading.x + dz * this.heading.z;
    const lateral = Math.abs(dx * this.heading.z - dz * this.heading.x);
    if (ahead <= 0 || lateral > 0.035) return Infinity;
    return Math.max(0, ahead - CONFIG.VEHICLE.FOLLOWING_GAP);
  }

  update(
    dt: number,
    crossings: ReadonlySet<Crosswalk>,
    traffic: readonly Vehicle[]
  ): void {
    if (
      !this.origin.parent ||
      !this.destination.parent ||
      this.movingAge >= CONFIG.VEHICLE.MAX_LIFETIME
    ) {
      this.dispose();
      return;
    }
    if (this.remaining <= 1e-8) {
      const next = this.destination.getRandomNextNode();
      if (!next) {
        this.dispose();
        return;
      }
      this.origin = this.destination;
      this.destination = next;
      this.startSegment();
    }

    let gap = Infinity;
    for (const crossing of crossings) {
      gap = Math.min(
        gap,
        crossing.stoppingDistance(this.position, this.heading)
      );
    }
    for (const car of traffic) {
      if (car.parent) gap = Math.min(gap, this.gapToCar(car));
    }
    const cruise = CONFIG.VEHICLE.SPEED * 1000;
    const target = Math.min(
      cruise,
      Math.sqrt(2 * CONFIG.VEHICLE.BRAKING * gap)
    );
    this.speed = THREE.MathUtils.clamp(
      target,
      this.speed - CONFIG.VEHICLE.BRAKING * dt,
      this.speed + CONFIG.VEHICLE.ACCELERATION * dt
    );
    const distance = Math.min(this.speed * dt, gap, this.remaining);
    this.position.addScaledVector(this.heading, distance);
    this.remaining -= distance;
    if (distance === gap) this.speed = 0;
    this.movingAge += distance / CONFIG.VEHICLE.SPEED;
    this.updateOpacity();
  }

  private updateOpacity(): void {
    const fade = CONFIG.VEHICLE.FADE_TIME;
    const opacity = THREE.MathUtils.clamp(
      Math.min(this.movingAge, CONFIG.VEHICLE.MAX_LIFETIME - this.movingAge) /
        fade,
      0,
      1
    );
    for (const material of this.materials) material.opacity = opacity;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.removeFromParent();
  }
}
