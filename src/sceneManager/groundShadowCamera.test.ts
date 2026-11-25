import { DirectionalLight, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GroundShadowCamera } from './groundShadowCamera';

describe('sun shadows', () => {
  it.each([32, 64])(
    'keeps ground samples fixed as the sun moves on a %i-tile island',
    (size) => {
      const sun = new DirectionalLight();
      const center = (size - 1) / 2;
      const extent = size / 2 + 4;
      sun.target.position.set(center, 0, center);
      sun.target.updateMatrixWorld();
      sun.shadow.camera = new GroundShadowCamera(
        -extent,
        extent,
        extent,
        -extent,
        1,
        size * 3 + 8
      );

      for (const [x, height] of [
        [1, 0.46],
        [-0.33, 1.45],
        [-1, 0.43],
      ]) {
        const direction = new Vector3(x, height, -0.66);
        sun.position.copy(sun.target.position).addScaledVector(direction, size);
        sun.updateMatrixWorld();
        sun.shadow.updateMatrices(sun);
        for (const dx of [-extent + 0.5, 0, extent - 0.5]) {
          for (const dz of [-extent + 0.5, 0, extent - 0.5]) {
            const ground = new Vector3(center + dx, 0, center + dz);
            const uv = ground.clone().applyMatrix4(sun.shadow.matrix);
            expect(uv.x).toBeCloseTo(0.5 + dx / (2 * extent), 10);
            expect(uv.y).toBeCloseTo(0.5 - dz / (2 * extent), 10);
            expect(uv.z).toBeGreaterThan(0);
            expect(uv.z).toBeLessThan(1);
            const caster = ground
              .addScaledVector(direction, 1.5)
              .applyMatrix4(sun.shadow.matrix);
            expect(caster.x).toBeCloseTo(uv.x, 10);
            expect(caster.y).toBeCloseTo(uv.y, 10);
            expect(caster.z).toBeLessThan(uv.z);
          }
        }
      }
    }
  );
});
