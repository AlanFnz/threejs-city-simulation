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
    protected destination: VehicleGraphNode,
    assetManager: IAssetManager,
    mesh = assetManager.createRandomVehicleMesh(),
    private readonly lifetime: number = CONFIG.VEHICLE.MAX_LIFETIME
  ) {
    super();
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

  protected get arrived(): boolean {
    return this.remaining <= 1e-8;
  }

  protected get stoppingAtDestination(): boolean {
    return false;
  }

  protected nextNode(): VehicleGraphNode | null {
    return this.destination.getRandomNextNode();
  }

  protected get laneClearance(): number {
    return 0.035;
  }

  // Extra front and rear clearance relative to the standard car.
  get overhang(): number { return 0; }

  private gapToCar(other: Vehicle): number {
    if (other === this || this.heading.dot(other.heading) < 0.9)
      return Infinity;
    const dx = other.position.x - this.position.x;
    const dz = other.position.z - this.position.z;
    const ahead = dx * this.heading.x + dz * this.heading.z;
    const lateral = Math.abs(dx * this.heading.z - dz * this.heading.x);
    if (
      ahead <= 0 ||
      lateral > Math.max(this.laneClearance, other.laneClearance)
    )
      return Infinity;
    return Math.max(0, ahead - CONFIG.VEHICLE.FOLLOWING_GAP - this.overhang - other.overhang);
  }

  update(
    dt: number,
    crossings: ReadonlySet<Crosswalk>,
    traffic: readonly Vehicle[]
  ): void {
    if (
      !this.origin.parent ||
      !this.destination.parent ||
      this.movingAge >= this.lifetime
    ) {
      this.dispose();
      return;
    }
    if (this.arrived) {
      const next = this.nextNode();
      if (!next) {
        this.dispose();
        return;
      }
      this.origin = this.destination;
      this.destination = next;
      this.startSegment();
    }

    let gap = this.stoppingAtDestination ? this.remaining : Infinity;
    for (const crossing of crossings) {
      gap = Math.min(
        gap,
        crossing.stoppingDistance(this.position, this.heading, this.overhang)
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
    if (!Number.isFinite(this.lifetime)) return;
    const fade = CONFIG.VEHICLE.FADE_TIME;
    const opacity = THREE.MathUtils.clamp(
      Math.min(this.movingAge, this.lifetime - this.movingAge) / fade,
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
