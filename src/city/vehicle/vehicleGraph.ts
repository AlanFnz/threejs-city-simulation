import * as THREE from 'three';
import CONFIG from '../../config';
import { VehicleGraphTile } from './vehicleGraphTile';
import { IAssetManager } from '../../assetManager';
import { VehicleGraphHelper } from './vehicleGraphHelper';
import { IRoad } from '../building/road';
import { Vehicle } from '.';
import { ICity } from '..';
import { VehicleGraphNode } from './vehicleGraphNode';
import { random } from '../../utils/rng';

export class VehicleGraph extends THREE.Group {
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

    setInterval(this.spawnVehicle.bind(this), CONFIG.VEHICLE.SPAWN_INTERVAL);
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

  updateVehicles() {
    for (const vehicle of this.vehicles.children) {
      if (vehicle instanceof Vehicle) {
        vehicle.update();
      }
    }
  }

  updateTile(x: number, y: number, road: IRoad | null) {
    const existingTile = this.getTile(x, y);
    const leftTile = this.getTile(x - 1, y);
    const rightTile = this.getTile(x + 1, y);
    const topTile = this.getTile(x, y - 1);
    const bottomTile = this.getTile(x, y + 1);

    // disconnect the existing tile and all adjacent tiles from each other
    if (!road && existingTile) {
      existingTile.disconnectAll();
      leftTile?.getWorldRightSide()?.out?.disconnectAll();
      rightTile?.getWorldLeftSide()?.out?.disconnectAll();
      topTile?.getWorldBottomSide()?.out?.disconnectAll();
      bottomTile?.getWorldTopSide()?.out?.disconnectAll();
      this.tiles[x][y] = null;
      if (CONFIG.DEBUG.SHOW_VEHICLE_GRAPH) this.helper.update(this);
      return;
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

  spawnVehicle() {
    const population = this.city.population;
    if (population < 1) return;

    const maxVehicles = this.calculateMaxVehicles(population);
    const currentVehicleCount = this.vehicles.children.length;

    if (currentVehicleCount >= maxVehicles) return;

    const spawnChance = random();
    if (spawnChance >= maxVehicles / population) return;

    const startingTile = this.getStartingTile();
    if (!startingTile) return;

    const origin = startingTile.getRandomNode();
    const destination = origin?.getRandomNextNode();
    if (!origin || !destination) return;

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
