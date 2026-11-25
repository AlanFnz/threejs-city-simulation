import { OrthographicCamera } from 'three';

/**
 * Sample the horizontal ground on a fixed grid throughout the day. An ordinary
 * sun camera rotates that grid with the light, so stationary wires and roof
 * edges repeatedly fall between different depth samples.
 */
export class GroundShadowCamera extends OrthographicCamera {
  override updateMatrixWorld(force?: boolean): void {
    super.updateMatrixWorld(force);

    // The camera's local +Z points from the town centre toward the sun.
    const basis = this.matrixWorld.elements;
    const sunHeight = basis[9];
    if (sunHeight <= 0) return;
    const slopeX = basis[8] / sunHeight;
    const slopeZ = basis[10] / sunHeight;

    // Project along sunlight onto the ground: (x - y*slopeX, -z + y*slopeZ).
    // Express these two axes in camera space. Both are perpendicular to +Z,
    // so depth testing can use the regular orthographic near/far projection.
    const scaleX = 2 / (this.right - this.left);
    const scaleY = 2 / (this.top - this.bottom);
    const projection = this.projectionMatrix.elements;
    projection[0] = (basis[0] - slopeX * basis[1]) * scaleX;
    projection[4] = (basis[4] - slopeX * basis[5]) * scaleX;
    projection[1] = (slopeZ * basis[1] - basis[2]) * scaleY;
    projection[5] = (slopeZ * basis[5] - basis[6]) * scaleY;
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}
