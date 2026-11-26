import * as THREE from 'three';
import CONFIG from '../../config';
import { VehicleGraphTile } from './vehicleGraphTile';
import { IAssetManager } from '../../assetManager';
import { VehicleGraphHelper } from './vehicleGraphHelper';
import { IRoad } from '../building/road';
import { Vehicle } from '.';
import type { Crosswalk } from './crosswalk';
import { ICity } from '..';
import { VehicleGraphNode } from './vehicleGraphNode';
import { random } from '../../utils/rng';

export class VehicleGraph extends THREE.Group {
  private spawnElapsed = 0;
  size: number;
  assetManager: IAssetManager;
  city: ICity;
  tiles: (VehicleGraphTile | null)[][];
  vehicles: THREE.Group;
  helper: VehicleGraphHelper;

  constructor(city: ICity, assetManager: IAssetManager) {
    super();

    this.size = city.size;
    this.assetManager = assetManager;
    this.city = city;
    this.tiles = [];

    this.vehicles = new THREE.Group();
    this.add(this.vehicles);

    this.helper = new VehicleGraphHelper();
    this.helper.visible = CONFIG.DEBUG.SHOW_VEHICLE_GRAPH;
    this.add(this.helper);

    // initialize the vehicle graph tiles array
    for (let x = 0; x < this.size; x++) {
      const column: (VehicleGraphTile | null)[] = [];
      for (let y = 0; y < this.size; y++) {
        column.push(null);
      }
      this.tiles.push(column);
    }

    if (CONFIG.DEBUG.SHOW_VEHICLE_GRAPH) this.helper.update(this);
  }

  private calculateMaxVehicles(population: number): number {
    return Math.min(
      Math.floor((population / 4) * 2),
      CONFIG.VEHICLE.MAX_VEHICLE_COUNT
    );
  }

  private spawnVehicleInstance(
    origin: VehicleGraphNode,
    destination: VehicleGraphNode
  ): void {
    const vehicle = new Vehicle(origin, destination, this.assetManager);
    this.vehicles.add(vehicle);
  }

  readonly isCrossingOccupied = (crossing: Crosswalk): boolean =>
    this.vehicles.children.some((car) => crossing.occupiedBy(car.position, (car as Vehicle).overhang));

  updateVehicles(
    dt: number,
    crossings: ReadonlySet<Crosswalk>,
    approaching: ReadonlySet<Crosswalk>
  ): void {
    const traffic = this.vehicles.children.slice() as Vehicle[];
    for (const car of traffic) car.update(dt, crossings, traffic);
    this.spawnElapsed += dt * 1000;
    if (this.spawnElapsed >= CONFIG.VEHICLE.SPAWN_INTERVAL) {
      this.spawnElapsed %= CONFIG.VEHICLE.SPAWN_INTERVAL;
      this.spawnVehicle(crossings, approaching);
    }
  }

  updateTile(x: number, y: number, road: IRoad | null) {
    const existingTile = this.getTile(x, y);
    if (!road && !existingTile) return;
    if (
      existingTile &&
      road?.style === existingTile.roadStyle &&
      road.rotation?.y === existingTile.roadRotation
    )
      return;
    const leftTile = this.getTile(x - 1, y);
    const rightTile = this.getTile(x + 1, y);
    const topTile = this.getTile(x, y - 1);
    const bottomTile = this.getTile(x, y + 1);

    // disconnect the existing tile and all adjacent tiles from each other
    if (existingTile) {
      existingTile.disconnectAll();
      leftTile?.getWorldRightSide()?.out?.disconnectAll();
      rightTile?.getWorldLeftSide()?.out?.disconnectAll();
      topTile?.getWorldBottomSide()?.out?.disconnectAll();
      bottomTile?.getWorldTopSide()?.out?.disconnectAll();
      this.tiles[x][y] = null;
      existingTile.removeFromParent();
    }

    if (road && road.rotation && road.style) {
      const tile = VehicleGraphTile.create(x, y, road.rotation.y, road.style);

      // connect tile to adjacent tiles
      if (leftTile) {
        tile
          ?.getWorldLeftSide()
          .out?.connect(leftTile.getWorldRightSide().in ?? null);
        leftTile
          .getWorldRightSide()
          .out?.connect(tile?.getWorldLeftSide().in ?? null);
      }
      if (rightTile) {
        tile
          ?.getWorldRightSide()
          .out?.connect(rightTile.getWorldLeftSide().in ?? null);
        rightTile
          .getWorldLeftSide()
          .out?.connect(tile?.getWorldRightSide().in ?? null);
      }
      if (topTile) {
        tile
          ?.getWorldTopSide()
          .out?.connect(topTile.getWorldBottomSide().in ?? null);
        topTile
          .getWorldBottomSide()
          .out?.connect(tile?.getWorldTopSide().in ?? null);
      }
      if (bottomTile) {
        tile
          ?.getWorldBottomSide()
          .out?.connect(bottomTile.getWorldTopSide().in ?? null);
        bottomTile
          .getWorldTopSide()
          .out?.connect(tile?.getWorldBottomSide().in ?? null);
      }
      this.tiles[x][y] = tile;
      if (tile) {
        tile.roadStyle = road.style;
        this.add(tile);
      }
    } else {
      this.tiles[x][y] = null;
    }

    // update the vehicle graph visualization
    if (CONFIG.DEBUG.SHOW_VEHICLE_GRAPH) this.helper.update(this);
  }

  getTile(x: number, y: number): VehicleGraphTile | null {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      return this.tiles[x][y];
    } else {
      return null;
    }
  }

  // A busy corner attracts some of the town's cosmetic traffic. Start one
  // tile upstream on a connected lane so the approach and stop are visible.
  private approachingLane(
    crossings: ReadonlySet<Crosswalk>
  ): VehicleGraphNode | null {
    const start = new THREE.Vector3();
    const heading = new THREE.Vector3();
    for (const crossing of crossings) {
      const { x, z } = crossing.approachTile;
      const tile = this.getTile(x, z);
      if (!tile) continue;
      for (const { out } of [tile.left, tile.right, tile.top, tile.bottom]) {
        const next = out?.next[0];
        if (!out || !next) continue;
        out.getWorldPosition(start);
        next.getWorldPosition(heading).sub(start).normalize();
        const gap = crossing.stoppingDistance(start, heading);
        if (
          gap > 0 &&
          gap < 1 &&
          !this.vehicles.children.some(
            (car) => car.position.distanceTo(start) < 0.7
          )
        )
          return out;
      }
    }
    return null;
  }

  private spawnVehicle(
    crossings: ReadonlySet<Crosswalk>,
    approaching: ReadonlySet<Crosswalk>
  ) {
    const population = this.city.population;
    if (population < 1) return;

    const maxVehicles = this.calculateMaxVehicles(population);
    const currentVehicleCount = this.vehicles.children.length;

    if (currentVehicleCount >= maxVehicles) return;

    let origin = this.approachingLane(approaching);
    if (!origin) {
      const spawnChance = Math.max(
        maxVehicles / population,
        maxVehicles / CONFIG.VEHICLE.MAX_VEHICLE_COUNT
      );
      if (random() >= spawnChance) return;
      origin = this.getStartingTile()?.getRandomNode() ?? null;
    }
    const destination = origin?.getRandomNextNode();
    if (!origin || !destination) return;

    const start = origin.getWorldPosition(new THREE.Vector3());
    if (
      this.vehicles.children.some(
        (car) => car.position.distanceTo(start) < CONFIG.VEHICLE.FOLLOWING_GAP
      )
    )
      return;
    const heading = destination
      .getWorldPosition(new THREE.Vector3())
      .sub(start)
      .normalize();
    for (const crossing of crossings) {
      if (
        crossing.occupiedBy(start) ||
        crossing.stoppingDistance(start, heading) === 0
      )
        return;
    }
    this.spawnVehicleInstance(origin, destination);
  }

  getStartingTile(): VehicleGraphTile | null {
    const tiles: VehicleGraphTile[] = [];
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        if (tile) tiles.push(tile);
      }
    }

    if (tiles.length === 0) {
      return null;
    } else {
      const i = Math.floor(tiles.length * random());
      return tiles[i];
    }
  }
}
