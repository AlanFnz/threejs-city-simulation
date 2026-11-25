import { describe, expect, it } from 'vitest';
import { Group, Mesh } from 'three';
import { Vehicle } from '.';
import { Crosswalk } from './crosswalk';
import { VehicleGraphNode } from './vehicleGraphNode';
import type { IAssetManager } from '../../assetManager';
import CONFIG from '../../config';

const stripes = new Crosswalk({ x: -0.14, z: 0.18 }, { x: 0.14, z: 0.18 });
const requested = new Set([stripes]);
const clear = new Set<Crosswalk>();
const dt = 1 / 60;

function car(from: number, to: number): Vehicle {
  const road = new Group();
  const origin = new VehicleGraphNode(0.05, from);
  const destination = new VehicleGraphNode(0.05, to);
  road.add(origin, destination);
  const vehicle = new Vehicle(origin, destination, {
    createRandomVehicleMesh: () => new Mesh(),
  } as IAssetManager);
  road.add(vehicle);
  return vehicle;
}

describe('pedestrian priority at a marked crossing', () => {
  it('slows, waits behind the stripes, and accelerates once both lanes are clear', () => {
    for (const sign of [-1, 1]) {
      const vehicle = car(0.18 + sign, 0.18 - sign * 3);
      let slowestMovingStep = Infinity;
      for (let i = 0; i < 900; i++) {
        const before = vehicle.position.z;
        vehicle.update(dt, requested, []);
        const distance = Math.abs(vehicle.position.z - before);
        if (distance > 0)
          slowestMovingStep = Math.min(slowestMovingStep, distance);
      }
      const stopped = vehicle.position.z;
      expect(stopped).toBeCloseTo(0.18 + sign * CONFIG.VEHICLE.STOP_LINE_GAP);
      expect(stripes.occupiedBy(vehicle.position)).toBe(false);
      expect(vehicle.parent).toBeTruthy();
      const cruiseStep = CONFIG.VEHICLE.SPEED * 1000 * dt;
      expect(slowestMovingStep).toBeLessThan(cruiseStep);
      vehicle.update(dt, clear, []);
      const firstStep = Math.abs(vehicle.position.z - stopped);
      expect(firstStep).toBeGreaterThan(0);
      expect(firstStep).toBeLessThan(cruiseStep);
      for (let i = 0; i < 90; i++) vehicle.update(dt, clear, []);
      expect((vehicle.position.z - 0.18) * sign).toBeLessThan(0);
    }
  });

  it('lets a committed car clear the crossing, and ignores traffic on other roads', () => {
    const vehicle = car(0.2, -1);
    expect(stripes.occupiedBy(vehicle.position)).toBe(true);
    for (let i = 0; i < 45; i++) vehicle.update(dt, requested, []);
    expect(vehicle.position.z).toBeLessThan(0);
    expect(stripes.occupiedBy(vehicle.position)).toBe(false);
    expect(stripes.stoppingDistance({ x: 1, z: -1 }, { x: 0, z: 1 })).toBe(
      Infinity
    );
    expect(stripes.stoppingDistance({ x: -1, z: 0 }, { x: 1, z: 0 })).toBe(
      Infinity
    );
  });

  it('keeps a following car behind the first and releases both after the crossing', () => {
    const leader = car(-0.6, 2);
    const follower = car(-0.9, 2);
    const traffic = [leader, follower];
    for (let i = 0; i < 240; i++) {
      for (const vehicle of traffic) vehicle.update(dt, requested, traffic);
    }
    expect(leader.position.z - follower.position.z).toBeCloseTo(
      CONFIG.VEHICLE.FOLLOWING_GAP
    );
    for (let i = 0; i < 120; i++) {
      for (const vehicle of traffic) vehicle.update(dt, clear, traffic);
    }
    expect(follower.position.z).toBeGreaterThan(0.18);
  });
});
