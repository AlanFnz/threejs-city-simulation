import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function coloredShape(
  geometry: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  yaw = 0
): THREE.BufferGeometry {
  const transform = new THREE.Object3D();
  transform.position.set(x, y, z);
  transform.scale.set(sx, sy, sz);
  transform.rotation.y = yaw;
  transform.updateMatrix();
  const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  part.applyMatrix4(transform.matrix);
  part.deleteAttribute('uv');
  const count = part.getAttribute('position').count;
  const tint = new THREE.Color(color);
  const rgb = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) tint.toArray(rgb, i * 3);
  part.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return part;
}

/** A single static coastal mesh outside the playable square. The shore rings
 * share samples so the meadow, beach and shallows meet at every vertex. */
export function createCoast(size: number): THREE.Mesh {
  const pieces: THREE.BufferGeometry[] = [];
  const polygons: number[] = [];
  const colors: number[] = [];
  const center = (size - 1) / 2;
  const count = 4 * size;
  let seed = 781;
  const sample = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const solid = (...args: Parameters<typeof coloredShape>) =>
    pieces.push(coloredShape(...args));

  const rings: THREE.Vector3[][] = [];
  const foliage = new THREE.ConeGeometry(1, 1, 7);
  const trunk = new THREE.CylinderGeometry(0.7, 1, 1, 6);
  const stone = new THREE.DodecahedronGeometry(1);
  const greens = [0x356e52, 0x417f58, 0x548854];
  for (let i = 0; i < count; i++) {
    const along = (i % size) - size / 2;
    const side = Math.floor(i / size);
    const x = [-size / 2, along, size / 2, -along][side];
    const z = [along, size / 2, -along, -size / 2][side];
    const angle = (2 * Math.PI * i) / count;
    const width =
      1.35 +
      0.42 * Math.cos(5 * angle) +
      0.3 * Math.sin(9 * angle) +
      sample() * 0.25;
    const outward = new THREE.Vector2(x, z).normalize();
    const point = (distance: number, height: number) =>
      new THREE.Vector3(
        center + x + outward.x * distance,
        height,
        center + z + outward.y * distance
      );
    const beach = 0.3 + 0.55 * (1 + Math.sin(angle * 7)) + sample() * 0.3;
    rings.push([
      point(0, -0.035),
      point(width, -0.06),
      point(width + 0.28, -0.27),
      point(width + 0.28 + beach * 0.5, -0.39),
      point(width + 0.28 + beach, -0.44),
      point(width + 0.44 + beach, -0.46),
    ]);

    if (i === 0) continue; // Keep the headland below the lighthouse clear.
    if (sample() < 0.3) {
      const rock = point(width + 0.4 + sample() * 1.2, -0.39);
      const radius = 0.13 + sample() * 0.25;
      solid(
        stone,
        0x97998b,
        rock.x,
        rock.y,
        rock.z,
        radius,
        radius * 0.8,
        radius * 1.35,
        angle
      );
    }
    if (Math.cos(angle * 6) + sample() < 0.3) continue;
    for (let tree = 0; tree < 2; tree++) {
      const p = point(width * (0.36 + tree * 0.31), -0.04);
      p.x += outward.y * (sample() - 0.5) * 0.6;
      p.z -= outward.x * (sample() - 0.5) * 0.6;
      const h = 0.48 + sample() * 0.82;
      const tint = greens[Math.floor(sample() * greens.length)];
      solid(
        trunk,
        0x705b42,
        p.x,
        p.y + h * 0.16,
        p.z,
        h * 0.047,
        h * 0.32,
        h * 0.047
      );
      solid(
        foliage,
        tint,
        p.x,
        p.y + h * 0.48,
        p.z,
        h * 0.25,
        h * 0.62,
        h * 0.25,
        angle
      );
      solid(
        foliage,
        tint,
        p.x,
        p.y + h * 0.73,
        p.z,
        h * 0.18,
        h * 0.54,
        h * 0.18,
        angle
      );
    }
  }

  const bands = [0x98b974, 0xb29a71, 0xe5c890, 0xeedabb, 0x91d5c6];
  for (let i = 0; i < count; i++) {
    const a = rings[i];
    const b = rings[(i + 1) % count];
    for (const [j, color] of bands.entries()) {
      const tint = new THREE.Color(color);
      for (const vertex of [a[j], b[j + 1], b[j], a[j], a[j + 1], b[j + 1]]) {
        polygons.push(vertex.x, vertex.y, vertex.z);
        colors.push(tint.r, tint.g, tint.b);
      }
    }
  }
  const shore = new THREE.BufferGeometry();
  shore.setAttribute('position', new THREE.Float32BufferAttribute(polygons, 3));
  shore.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  shore.computeVertexNormals();
  pieces.push(shore);

  const headland = rings[0][0].clone().lerp(rings[0][1], 0.58);
  const tower = (
    bottom: number,
    top: number,
    base: number,
    height: number,
    color: number
  ) =>
    solid(
      new THREE.CylinderGeometry(top, bottom, height, 12),
      color,
      headland.x,
      base + height / 2,
      headland.z
    );
  tower(0.32, 0.29, -0.06, 0.15, 0x858b80);
  tower(0.24, 0.205, 0.09, 0.55, 0xfff0d4);
  tower(0.205, 0.18, 0.64, 0.36, 0xcf624c);
  tower(0.18, 0.16, 1, 0.3, 0xfff0d4);
  tower(0.27, 0.27, 1.3, 0.07, 0x384e4c);
  tower(0.14, 0.14, 1.37, 0.22, 0xffcf78);
  tower(0.23, 0, 1.59, 0.19, 0xb65342);

  const geometry = mergeGeometries(pieces);
  const coast = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true })
  );
  coast.castShadow = true;
  coast.receiveShadow = true;
  coast.userData.nonInteractive = true;
  coast.raycast = () => {};
  return coast;
}

/** World-space wavelets stay anchored when the camera pans or zooms. */
export function createSea(
  size: number
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      center: { value: (size - 1) / 2 },
      halfSize: { value: size / 2 },
      shallows: { value: new THREE.Color(0x82c9bc) },
      deep: { value: new THREE.Color(0x568fa4) },
    },
    vertexShader: `
      varying vec2 water;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        water = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float time, center, halfSize;
      uniform vec3 shallows, deep;
      varying vec2 water;
      void main() {
        vec2 shore = abs(water - center);
        float depth = smoothstep(0.0, 15.0, max(shore.x, shore.y) - halfSize);
        vec2 uv = vec2(water.x + water.y, water.x - water.y);
        float swell = sin(uv.x * 0.37 + uv.y * 0.55 + time * 0.12);
        vec3 color = mix(shallows, deep, depth * 0.88 + swell * 0.04);
        float line = sin(uv.y * 8.0 + sin(uv.x * 1.5 + time * 0.28) * 0.68 + time * 0.4);
        float fleck = sin(uv.x * 2.4 + uv.y * 4.3) * sin(uv.x * 0.8 - uv.y * 2.1 + time * 0.16);
        color += smoothstep(0.9, 1.0, line) * smoothstep(0.52, 0.9, fleck) * 0.14;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((size - 1) / 2, -0.47, (size - 1) / 2);
  sea.userData.nonInteractive = true;
  sea.raycast = () => {};
  return sea;
}
