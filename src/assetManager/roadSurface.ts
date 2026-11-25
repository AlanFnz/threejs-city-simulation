import * as THREE from 'three';

// All five road models use the same 8 × 8 flat-color palette.
function swatch(
  uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number
): number {
  return Math.floor(uv.getX(index) * 8) + 8 * Math.floor(uv.getY(index) * 8);
}

export function matchRoadVerge(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute('uv');
  const colors = new Float32Array(uv.count * 3).fill(1);
  const meadow = new THREE.Color(0xa6c07d);
  const grass = new THREE.Color(0x508e34);
  const tint = new THREE.Color(
    meadow.r / grass.r,
    meadow.g / grass.g,
    meadow.b / grass.b
  );
  for (let i = 0; i < uv.count; i++) {
    if (swatch(uv, i) === 3 + 4 * 8) tint.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
