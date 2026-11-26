import * as THREE from 'three';
import CONFIG from '../config';
import type { ICity } from '../city';
import type { Citizen } from '../city/citizen';
import { SIDES } from '../assetManager/frontage';
import { ResidentFigure } from './residentFigure';
import type { StreetDoor } from './pedestrians';

export interface GardenHome extends StreetDoor {
  facing: number;
  matrix: THREE.Matrix4;
}

class Neighbor extends ResidentFigure {
  pose(
    route: GardenPath,
    progress: number,
    returning: boolean,
    partner: THREE.Vector3,
    beat: number,
    speaking: boolean
  ): void {
    const distance = progress * route.length;
    const first = distance < route.turnDistance;
    const a = first ? route.door : route.turn,
      b = first ? route.turn : route.end;
    this.position.lerpVectors(
      a,
      b,
      first
        ? distance / route.turnDistance
        : (distance - route.turnDistance) /
            (route.length - route.turnDistance || 1)
    );
    const chatting = progress >= 1;
    this.rotation.y = chatting
      ? Math.atan2(partner.x - b.x, partner.z - b.z)
      : Math.atan2(b.x - a.x, b.z - a.z) + (returning ? Math.PI : 0);
    this.gait(distance * 105, !chatting);
    if (chatting) {
      this.forearms[0].rotation.x = speaking
        ? -0.8 - 0.34 * Math.sin(beat * 2)
        : -0.2;
      this.arms[0].rotation.x = speaking ? -0.32 : 0;
      this.torso.rotation.x = speaking ? 0 : 0.035 * Math.sin(beat * 2);
    }
  }
}

interface GardenPath {
  door: THREE.Vector3;
  turn: THREE.Vector3;
  end: THREE.Vector3;
  turnDistance: number;
  length: number;
}
function path(home: GardenHome, side: number): GardenPath {
  const inverse = home.matrix.clone().invert();
  const a = home.door.clone().applyMatrix4(inverse),
    b = home.curb.clone().applyMatrix4(inverse);
  // Walk up the entrance, then across the lawn behind the flower bed.
  const z = a.z < 0.25 ? 0.285 : 0.475;
  const turn = a.clone().lerp(b, (z - a.z) / (b.z - a.z));
  const end = turn.clone();
  end.x = side * 0.476;
  turn.applyMatrix4(home.matrix);
  end.applyMatrix4(home.matrix);
  const turnDistance = turn.distanceTo(home.door);
  return {
    door: home.door,
    turn,
    end,
    turnDistance,
    length: turnDistance + turn.distanceTo(end),
  };
}

interface Visit {
  homes: GardenHome[];
  routes: GardenPath[];
  guests: Neighbor[];
  start: number;
}

export class GardenConversations extends THREE.Group {
  private visits: Visit[] = [];

  rebuild(homes: GardenHome[]): void {
    const free = new Map(homes.map((home) => [home.x + ',' + home.z, home]));
    const previous = this.visits;
    this.visits = [];
    for (const a of homes) {
      const key = a.x + ',' + a.z;
      if (!free.has(key)) continue;
      const front = SIDES[a.facing];
      const otherKey = a.x + front.y + ',' + (a.z - front.x);
      const b = free.get(otherKey);
      if (!b || a.facing !== b.facing) continue;
      const guests = previous[this.visits.length]?.guests ?? [
        new Neighbor(),
        new Neighbor(),
      ];
      this.add(...guests);
      this.visits.push({
        homes: [a, b],
        routes: [path(a, 1), path(b, -1)],
        guests,
        start: Infinity,
      });
      free.delete(key);
      free.delete(otherKey);
      if (this.visits.length === 4) break;
    }
    for (const old of previous.slice(this.visits.length))
      this.remove(...old.guests);
  }

  schedule(city: ICity, homeSince: (person: Citizen) => number): void {
    for (const visit of this.visits) {
      const { x, z } = visit.homes[0];
      let start = 17 * 60 + ((x * 11 + z * 7) % 55);
      for (const [i, home] of visit.homes.entries()) {
        const building = city.getTile(home.x, home.z)?.building;
        const residents =
          building && 'residents' in building ? building.residents.all : [];
        // Prefer the adult who gets home first so a delayed commuter can't
        // appear at the garden gate while still waiting at a crossing.
        let earliest = Infinity;
        let guest: Citizen | undefined;
        for (const resident of residents) {
          if (resident.age < CONFIG.CITIZEN.MIN_WORKING_AGE) continue;
          const arrival = homeSince(resident);
          if (arrival < earliest) {
            earliest = arrival;
            guest = resident;
          }
        }
        if (guest) visit.guests[i].dress(guest.id);
        start = Math.max(start, earliest);
      }
      visit.start = start;
    }
  }

  update(minute: number): void {
    for (const visit of this.visits) {
      const t = minute - visit.start;
      for (const [i, guest] of visit.guests.entries()) {
        const elapsed = t - i * 6;
        guest.visible = elapsed >= 0 && elapsed <= 105 && visit.start < 21 * 60;
        if (!guest.visible) continue;
        const progress = THREE.MathUtils.clamp(
          Math.min(elapsed, 105 - elapsed) / 19,
          0,
          1
        );
        guest.pose(
          visit.routes[i],
          progress,
          elapsed > 86,
          visit.routes[1 - i].end,
          elapsed * 0.22,
          Math.floor(t / 12) % 2 === i
        );
      }
    }
  }
}
