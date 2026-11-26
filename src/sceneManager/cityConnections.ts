import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ICity } from '../city';
import { ShopShutters } from './shopShutters';
import { GardenConversations, type GardenHome } from './gardenConversations';
import { FrontGardens } from './frontGardens';
import { StreetFurniture } from './streetFurniture';
import { isConstructionSite, ModelKey } from '../assetManager/constants';
import { ENTRANCES, SIDES } from '../assetManager/frontage';
import { getSidewalkSurface } from '../assetManager/roadSurface';
import { BUILDING_TYPE, type BuildingType } from '../city/building/constants';

import { Footpaths, Pedestrians, type StreetDoor } from './pedestrians';
import { Promenade, type ShopFront } from './promenade';
import type { FreightStops } from './deliveryRoute';
import type { PowerView } from './powerView';

interface ConnectionLot {
  abandoned: boolean;
  modelKey: ModelKey;
  matrix: THREE.Matrix4;
  buildingType: BuildingType;
  facing: number | null;
}

type Lots = (ConnectionLot | null)[][];

function decorativeMesh(material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.visible = false;
  mesh.userData.nonInteractive = true;
  mesh.raycast = () => {};
  return mesh;
}

function replaceGeometry(
  mesh: THREE.Mesh,
  geometry: THREE.BufferGeometry | null
): void {
  mesh.geometry.dispose();
  mesh.geometry = geometry ?? new THREE.BufferGeometry();
  mesh.visible = geometry !== null;
}

// The pole GLB has two upper ceramic insulators at ±0.13. The plant's
// terminal pair sits over the flat rear roof, in its own rotated frame.
function terminals(lot: ConnectionLot): THREE.Vector3[] {
  return [-1, 1].map((sign) => {
    const point =
      lot.modelKey === ModelKey.POWER_PLANT
        ? new THREE.Vector3(sign * 0.12, 0.62, -0.21 + sign * 0.055)
        : new THREE.Vector3(sign * 0.13, 0.366, 0);
    return point.applyMatrix4(lot.matrix);
  });
}

function addSpan(
  parts: THREE.BufferGeometry[],
  a: ConnectionLot,
  b: ConnectionLot
): void {
  const from = terminals(a);
  const to = terminals(b);
  // Match the nearest pair even when the crossarms turn in opposite directions.
  if (
    from[0].distanceToSquared(to[0]) + from[1].distanceToSquared(to[1]) >
    from[0].distanceToSquared(to[1]) + from[1].distanceToSquared(to[0])
  ) {
    to.reverse();
  }
  for (let i = 0; i < from.length; i++) {
    const midpoint = from[i].clone().lerp(to[i], 0.5);
    midpoint.y -= 0.12 * from[i].distanceTo(to[i]);
    const curve = new THREE.QuadraticBezierCurve3(from[i], midpoint, to[i]);
    parts.push(new THREE.TubeGeometry(curve, 8, 0.0055, 5, false));
  }
}

function isPoleOrPlant(
  lot: ConnectionLot | null | undefined
): lot is ConnectionLot {
  return (
    lot?.modelKey === ModelKey.POWER_LINE ||
    lot?.modelKey === ModelKey.POWER_PLANT
  );
}

// Include homes opposite a shop and the house next door along the same street.
function countFacingShops(
  lots: Lots,
  x: number,
  y: number,
  side: { x: number; y: number }
): number {
  let count = 0;
  for (const offset of [0, -1, 1]) {
    const dx = x + side.y * offset,
      dy = y - side.x * offset;
    if (
      lots[dx + side.x]?.[dy + side.y]?.buildingType === BUILDING_TYPE.ROAD &&
      lots[dx + 2 * side.x]?.[dy + 2 * side.y]?.buildingType ===
        BUILDING_TYPE.COMMERCIAL
    )
      count++;
  }
  return count;
}

function pathWidth(type: BuildingType): number {
  if (type === BUILDING_TYPE.RESIDENTIAL) return 0.105;
  if (type === BUILDING_TYPE.INDUSTRIAL) return 0.22;
  return 0.16;
}

export class CityConnections extends THREE.Group {
  private paths = decorativeMesh(
    new THREE.MeshLambertMaterial({ color: 0xcac1ad })
  );
  private wires = decorativeMesh(
    new THREE.MeshLambertMaterial({ color: 0x414840 })
  );
  private sidewalks = new Map<ModelKey, THREE.Triangle[]>();

  readonly pedestrians = new Pedestrians();
  private furniture: StreetFurniture;
  private gardens: FrontGardens;
  private promenade = new Promenade();
  private shutters: ShopShutters;
  private conversations = new GardenConversations();

  constructor(size: number, darkness: { value: number }) {
    super();
    this.paths.receiveShadow = true;
    this.wires.castShadow = true;
    this.gardens = new FrontGardens(size);
    this.shutters = new ShopShutters(size);
    this.furniture = new StreetFurniture(size, darkness);
    this.add(
      this.paths,
      this.wires,
      this.furniture,
      this.gardens,
      this.shutters,
      this.conversations,
      this.promenade,
      this.pedestrians
    );
  }

  setElectricView(active: boolean): void {
    const material = this.wires.material as THREE.MeshLambertMaterial;
    material.color.setHex(active ? 0xffe086 : 0x414840);
    material.emissive.setHex(active ? 0xc39338 : 0);
  }

  updateLights(power: PowerView, dusk: boolean): void {
    this.furniture.updateLights(power, dusk);
  }

  updateNeighborhood(city: ICity, minute: number): void {
    this.conversations.schedule(city, this.pedestrians.homeSince);
    this.conversations.update(minute);
  }

  animateNeighborhood(
    minute: number,
    receiving?: { x: number; z: number; opening: number }
  ): void {
    this.shutters.update(minute, receiving);
    this.conversations.update(minute);
  }

  updatePaths(
    lots: Lots,
    getGeometry: (key: ModelKey) => THREE.BufferGeometry
  ): FreightStops {
    const factories: StreetDoor[] = [];
    const gardenHomes: GardenHome[] = [];
    const vertices: number[] = [];
    const paths = new Footpaths();
    const homesByShopCount: StreetDoor[][] = [[], [], [], []],
      workplaces: StreetDoor[] = [],
      shops: ShopFront[] = [];
    this.furniture.clearInstances();
    this.gardens.clearInstances();
    for (const column of lots)
      for (const road of column) {
        if (road?.buildingType !== BUILDING_TYPE.ROAD) continue;
        let surface = this.sidewalks.get(road.modelKey);
        if (!surface) {
          surface = getSidewalkSurface(getGeometry(road.modelKey));
          this.sidewalks.set(road.modelKey, surface);
        }
        paths.addRoad(road.matrix, road.modelKey, surface);
        this.furniture.addCorner(road.modelKey, road.matrix);
      }
    for (const [x, column] of lots.entries()) {
      for (const [y, lot] of column.entries()) {
        if (!lot) continue;
        if (lot.facing === null) continue;
        const entrance = ENTRANCES[lot.modelKey];
        if (!entrance) continue;
        const side = SIDES[lot.facing];
        const road = lots[x + side.x]?.[y + side.y];
        if (road?.buildingType !== BUILDING_TYPE.ROAD) continue;

        const surface = this.sidewalks.get(road.modelKey)!;
        // Start just inside the threshold. Find the actual curb in road-local
        // coordinates, including end caps and both radii of corner models.
        const start = new THREE.Vector3(
          entrance[0],
          0,
          entrance[1] - 0.018
        ).applyMatrix4(lot.matrix);
        const local = start.clone().applyMatrix4(road.matrix.clone().invert());
        const nearest = new THREE.Vector3();
        const candidate = new THREE.Vector3();
        let distance = Infinity;
        for (const triangle of surface) {
          triangle.closestPointToPoint(local, candidate);
          const d = local.distanceToSquared(candidate);
          if (d < distance) {
            nearest.copy(candidate);
            distance = d;
          }
        }
        if (!Number.isFinite(distance)) continue;
        const end = nearest.applyMatrix4(road.matrix);
        start.y = end.y = 0.014;
        const forward = end.clone().sub(start).normalize();
        end.addScaledVector(forward, 0.018);
        const halfWidth = pathWidth(lot.buildingType) / 2;
        const stop = this.furniture.addFrontage(
          lot.buildingType,
          lot.modelKey,
          lot.matrix,
          start,
          end,
          halfWidth,
          vertices
        );
        const frontage = {
          x,
          z: y,
          door: start,
          curb: end,
          road: road.matrix,
          stop,
        };
        if (!lot.abandoned && !isConstructionSite(lot.modelKey)) {
          if (lot.buildingType === BUILDING_TYPE.RESIDENTIAL) {
            const shopCount = countFacingShops(lots, x, y, side);
            homesByShopCount[shopCount].push(frontage);
            if (shopCount) {
              this.gardens.addHome(lot.matrix, start, end, halfWidth);
              gardenHomes.push({
                ...frontage,
                matrix: lot.matrix,
                facing: lot.facing,
              });
            }
          }
          if (lot.buildingType === BUILDING_TYPE.INDUSTRIAL || stop)
            workplaces.push(frontage);
          if (lot.buildingType === BUILDING_TYPE.INDUSTRIAL)
            factories.push(frontage);
          if (stop)
            shops.push({
              ...frontage,
              facing: lot.facing,
              matrix: lot.matrix,
              modelKey: lot.modelKey,
            });
        }
        const across = new THREE.Vector3(
          forward.z * halfWidth,
          0,
          -forward.x * halfWidth
        );
        const left = start.clone().sub(across),
          right = start.clone().add(across);
        const farLeft = end.clone().sub(across),
          farRight = end.clone().add(across);
        for (const vertex of [left, farLeft, right, right, farLeft, farRight]) {
          vertices.push(vertex.x, vertex.y, vertex.z);
        }
      }
    }
    this.shutters.rebuild(shops);
    this.conversations.rebuild(gardenHomes);
    this.furniture.finishUpdate();
    this.gardens.finishUpdate();
    this.promenade.rebuild(
      shops,
      (x, z) => lots[x]?.[z]?.buildingType === BUILDING_TYPE.ROAD,
      (a, b, points) => paths.connectShops(a, b, points)
    );
    const homes = ([] as StreetDoor[]).concat(...homesByShopCount.reverse());
    this.pedestrians.setNetwork(paths, homes, workplaces, shops);
    if (!vertices.length) {
      replaceGeometry(this.paths, null);
      return { factories, shops };
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.computeVertexNormals();
    replaceGeometry(this.paths, geometry);
    return { factories, shops };
  }

  updateWires(lots: Lots): void {
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, column] of lots.entries()) {
      for (const [y, lot] of column.entries()) {
        if (!isPoleOrPlant(lot)) continue;
        if (
          lot.modelKey === ModelKey.POWER_PLANT &&
          SIDES.some(
            (side) =>
              lots[x + side.x]?.[y + side.y]?.modelKey === ModelKey.POWER_LINE
          )
        ) {
          for (const pin of terminals(lot)) {
            parts.push(
              new THREE.CylinderGeometry(0.017, 0.023, 0.26, 6).translate(
                pin.x,
                pin.y - 0.13,
                pin.z
              )
            );
            parts.push(
              new THREE.CylinderGeometry(0.032, 0.032, 0.025, 8).translate(
                pin.x,
                pin.y - 0.035,
                pin.z
              )
            );
          }
        }
        // Visit each shared edge once, regardless of placement order.
        for (const neighbor of [lots[x + 1]?.[y], column[y + 1]]) {
          if (
            isPoleOrPlant(neighbor) &&
            (lot.modelKey === ModelKey.POWER_LINE ||
              neighbor.modelKey === ModelKey.POWER_LINE)
          ) {
            addSpan(parts, lot, neighbor);
          }
        }
      }
    }
    replaceGeometry(this.wires, parts.length ? mergeGeometries(parts) : null);
  }
}
