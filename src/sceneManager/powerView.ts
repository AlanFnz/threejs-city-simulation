import * as THREE from 'three';
import type { ICity } from '../city';
import { BUILDING_TYPE } from '../city/building/constants';
import { SIDES } from '../assetManager/frontage';

enum Supply {
  Empty,
  Unpowered,
  Powered,
}
enum Source {
  Empty,
  UnservedZone,
  ServedZone,
  Pole,
  Plant,
}

const poweredColor = new THREE.Color(0x75edc5);
const outageColor = new THREE.Color(0xff975e);

// Zone service comes from the model, including capacity limits. For poles,
// trace the conductive neighbours of each plant without assigning a new load.
export class PowerView extends THREE.InstancedMesh {
  private services: Uint8Array;
  private source: Uint8Array;
  private size: number;

  constructor(size: number) {
    super(
      new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      }),
      size * size
    );
    this.size = size;
    this.source = new Uint8Array(size * size);
    this.services = new Uint8Array(size * size);
    this.count = 0;
    this.visible = false;
    this.userData.nonInteractive = true;
    this.raycast = () => {};
  }

  isPowered(x: number, z: number): boolean {
    return (
      x >= 0 &&
      x < this.size &&
      z >= 0 &&
      z < this.size &&
      this.services[x * this.size + z] === Supply.Powered
    );
  }

  updateSupply(city: ICity): boolean {
    let changed = false;
    const size = this.size;
    for (let x = 0; x < size; x++)
      for (let z = 0; z < size; z++) {
        const tile = city.getTile(x, z)!;
        const type = tile.building?.type;
        let value = Source.Empty;
        if (type === BUILDING_TYPE.POWER_PLANT) value = Source.Plant;
        else if (type === BUILDING_TYPE.POWER_LINE) value = Source.Pole;
        else if (
          type === BUILDING_TYPE.RESIDENTIAL ||
          type === BUILDING_TYPE.COMMERCIAL ||
          type === BUILDING_TYPE.INDUSTRIAL
        )
          value = tile.powerAccess?.value
            ? Source.ServedZone
            : Source.UnservedZone;
        const index = x * size + z;
        if (this.source[index] !== value) {
          this.source[index] = value;
          changed = true;
        }
      }
    if (!changed) return false;
    const queue: number[] = [];
    for (const [i, value] of this.source.entries()) {
      this.services[i] =
        value === Source.Empty ? Supply.Empty : Supply.Unpowered;
      if (value === Source.Plant) {
        this.services[i] = Supply.Powered;
        queue.push(i);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const x = Math.floor(queue[i] / size),
        z = queue[i] % size;
      for (const side of SIDES) {
        const nx = x + side.x,
          nz = z + side.y;
        if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
        const next = nx * size + nz;
        const source = this.source[next];
        if (
          (source === Source.Pole || source === Source.ServedZone) &&
          this.services[next] === Supply.Unpowered
        ) {
          this.services[next] = Supply.Powered;
          queue.push(next);
        }
      }
    }
    this.count = 0;
    const matrix = new THREE.Matrix4();
    for (const [i, source] of this.source.entries()) {
      if (source === Source.Empty) continue;
      if (source === Source.ServedZone) this.services[i] = Supply.Powered;
      this.setMatrixAt(
        this.count,
        matrix.makeTranslation(Math.floor(i / size), 0.022, i % size)
      );
      this.setColorAt(
        this.count++,
        this.services[i] === Supply.Powered ? poweredColor : outageColor
      );
    }
    this.instanceMatrix.needsUpdate = true;
    if (this.instanceColor) this.instanceColor.needsUpdate = true;
    this.computeBoundingSphere();
    return true;
  }
}

// Give both triangles of a pane the same switch. Some GLBs split vertices
// along UV seams, so join the glass triangles by their corner positions.
function paneGroups(geometry: THREE.BufferGeometry): THREE.BufferAttribute {
  const uv = geometry.getAttribute('uv'),
    pos = geometry.getAttribute('position');
  const groups = new Float32Array(pos.count).fill(-1);
  const corners = new Map<string, number>();
  const parent: number[] = [];
  function root(n: number): number {
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]];
      n = parent[n];
    }
    return n;
  }
  const corner = (i: number) => {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)]
      .map((n) => Math.round(n * 10000))
      .join(',');
    const existing = corners.get(key);
    if (existing !== undefined) return existing;
    const id = parent.length;
    parent.push(id);
    corners.set(key, id);
    return id;
  };
  const index = geometry.index;
  for (let t = 0; t < (index?.count ?? pos.count); t += 3) {
    const vertices = [t, t + 1, t + 2].map((i) => (index ? index.getX(i) : i));
    if (!vertices.every((i) => uv.getX(i) >= 0.875 && uv.getY(i) >= 0.875))
      continue;
    const ids = vertices.map(corner);
    for (let i = 0; i < 3; i++) {
      parent[root(ids[i])] = root(ids[0]);
      groups[vertices[i]] = ids[i];
    }
  }
  for (let i = 0; i < groups.length; i++)
    if (groups[i] >= 0) groups[i] = root(groups[i]);
  return new THREE.BufferAttribute(groups, 1);
}

// The final swatch in the shared model atlas is architectural glass.
export function addWindowLighting(
  mesh: THREE.InstancedMesh,
  dusk: { value: number }
): void {
  mesh.geometry.setAttribute(
    'windowPower',
    new THREE.InstancedBufferAttribute(new Float32Array(mesh.count), 1)
  );
  mesh.geometry.setAttribute('windowGroup', paneGroups(mesh.geometry));
  const material = mesh.material as THREE.MeshLambertMaterial;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.dusk = dusk;
    shader.vertexShader =
      'attribute float windowPower; attribute float windowGroup; varying float paneLight;\n' +
      shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
      float room = fract(sin(dot(instanceMatrix[3].xz, vec2(27.1, 61.7)) + windowGroup * 0.73) * 1743.37);
      float threshold = room * 0.85;
      paneLight = step(0.0, windowGroup) * smoothstep(threshold, threshold + 0.12, windowPower) * mix(0.55, 1.0, room);`
      );
    shader.fragmentShader =
      'uniform float dusk; varying float paneLight;\n' +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.45, 0.72, 0.24) * paneLight * dusk;'
      );
  };
}
