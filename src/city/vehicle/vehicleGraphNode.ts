import * as THREE from 'three';
import { random } from '../../utils/rng';

export class VehicleGraphNode extends THREE.Object3D {
  public next: VehicleGraphNode[];

  constructor(x: number, y: number) {
    super();

    this.position.set(x, 0, y);
    this.next = [];
  }

  connect(node: VehicleGraphNode | null): void {
    if (!node) return;

    if (!this.next.includes(node)) {
      this.next.push(node);
    }
  }

  disconnectAll(): void {
    this.next = [];
  }

  getRandomNextNode(): VehicleGraphNode | null {
    if (this.next.length === 0) {
      return null;
    } else {
      const i = Math.floor(this.next.length * random());
      return this.next[i];
    }
  }
}

