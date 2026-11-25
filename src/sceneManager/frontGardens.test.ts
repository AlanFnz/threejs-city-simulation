import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { FrontGardens } from './frontGardens';

it('leaves the angled entrance clear on every street orientation and rebuilds the same garden', () => {
  const gardens = new FrontGardens(16);
  const batches = gardens.children as InstancedMesh[];
  const halfWidth = 0.0525;
  for (let turn = 0; turn < 4; turn++) {
    const lot = new Matrix4()
      .makeRotationY((turn * Math.PI) / 2)
      .setPosition(5 + turn, 0, 6);
    const door = new Vector3(-0.17, 0.014, 0.22).applyMatrix4(lot);
    const curb = new Vector3(0.08, 0.014, 0.84).applyMatrix4(lot);
    const lane = curb.clone().sub(door).normalize();
    const build = () => {
      gardens.clearInstances();
      gardens.addHome(lot, door, curb, halfWidth);
      gardens.finishUpdate();
      const transforms = [];
      for (const batch of batches) {
        for (let i = 0; i < batch.count; i++) {
          const transform = new Matrix4();
          batch.getMatrixAt(i, transform);
          transforms.push(transform.elements);
          const vertices = batch.geometry.getAttribute('position');
          for (let j = 0; j < vertices.count; j++) {
            const offset = new Vector3()
              .fromBufferAttribute(vertices, j)
              .applyMatrix4(transform)
              .sub(door);
            if (Math.abs(offset.x * lane.z - offset.z * lane.x) <= halfWidth) {
              throw new Error('Garden overlaps the entrance path');
            }
          }
        }
      }
      return transforms;
    };
    const original = build();
    expect(original).toHaveLength(3);
    expect(build()).toEqual(original);
  }
  gardens.clearInstances();
  gardens.finishUpdate();
  expect(batches.every((batch) => batch.count === 0)).toBe(true);
});
