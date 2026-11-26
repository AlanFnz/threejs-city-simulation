import { SidewalkWalk } from './sidewalkWalk';
import * as THREE from 'three';
import CONFIG from '../config';
import type { ICity } from '../city';
import type { Citizen } from '../city/citizen';
import type { Crosswalk } from '../city/vehicle/crosswalk';
import type { StreetDoor } from './pedestrians';
import { ResidentFigure } from './residentFigure';
import { residentSpread } from './householdLights';
import { coloredShape } from './coast';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type SchoolRoute = {
  home: StreetDoor;
  school: StreetDoor;
  points: THREE.Vector3[];
};
type WorkWalk = (
  school: StreetDoor,
  x: number,
  y: number
) => THREE.Vector3[] | undefined;
const { SCHOOL_DAY } = CONFIG;
const box = new THREE.BoxGeometry();
const cloth = new THREE.MeshLambertMaterial({ vertexColors: true });
const bags = [0xe7a037, 0xdb6657, 0x438eac, 0x9783bd].map((color) =>
  mergeGeometries([
    coloredShape(box, color, 0, 1.17, -0.14, 0.29, 0.35, 0.13),
    coloredShape(box, 0xeacb8d, 0, 1.09, -0.212, 0.22, 0.1, 0.03),
    ...[-1, 1].map((s) =>
      coloredShape(box, color, s * 0.108, 1.26, 0.085, 0.032, 0.28, 0.055)
    ),
  ])
);

class FamilyMember extends ResidentFigure {
  constructor(person: Citizen, pupil: boolean) {
    super();
    this.dress(person.id);
    if (pupil) {
      this.scale.multiplyScalar(
        0.65 + 0.023 * (person.age - SCHOOL_DAY.MIN_AGE)
      );
      const pack = new THREE.Mesh(
        bags[Math.floor(residentSpread(person.id) * bags.length)],
        cloth
      );
      pack.castShadow = pack.userData.nonInteractive = true;
      pack.raycast = () => {};
      this.skeleton.add(pack);
    }
  }
  pose(moving: boolean, phase: number, greet = false) {
    this.gait(phase, moving);
    this.arms[1].rotation.z = 0.065;
    if (greet) {
      this.arms[1].rotation.x = -1.08;
      this.forearms[1].rotation.x = -1.12;
      this.arms[1].rotation.z = 0.15 + 0.12 * Math.sin(phase);
    }
  }
}

class SchoolFamily extends THREE.Group {
  private guardian: FamilyMember;
  private pupils: FamilyMember[];
  private inward!: SidewalkWalk;
  private away!: SidewalkWalk;
  private doorway!: SidewalkWalk;
  private arrive: number;
  private release: number;
  private time = 0;
  private clock = 0;
  private waited = false;
  private legs: {
    start: number;
    walk: SidewalkWalk;
    reverse: boolean;
    together: boolean;
  }[] = [];
  workplace: Citizen['workplace'] = null;
  constructor(
    readonly adult: Citizen,
    childrenAtSchool: Citizen[],
    readonly slot: number,
    public school: StreetDoor
  ) {
    super();
    this.guardian = new FamilyMember(adult, false);
    this.pupils = childrenAtSchool.map((c) => new FamilyMember(c, true));
    this.add(this.guardian, ...this.pupils);
    this.arrive = SCHOOL_DAY.START - 10 + slot * 4;
    this.release = SCHOOL_DAY.DISMISSAL + slot * 1.5;
  }

  setPaths(
    route: SchoolRoute,
    job: THREE.Vector3[] | undefined,
    crosswalks: Map<THREE.Vector3, Crosswalk>
  ) {
    const { door, curb } = route.school;
    const toward = curb.clone().sub(door).normalize();
    const rank = (this.slot % 3) - 1;
    const gate = door
      .clone()
      .addScaledVector(toward, 0.115 + 0.047 * Math.floor(this.slot / 3));
    gate.x += toward.z * rank * 0.036;
    gate.z -= toward.x * rank * 0.036;
    this.inward = new SidewalkWalk(
      [...route.points, gate],
      crosswalks,
      SCHOOL_DAY.MINUTES_PER_TILE
    );
    this.away = job
      ? new SidewalkWalk(
          [...job].reverse().concat(gate),
          crosswalks,
          SCHOOL_DAY.MINUTES_PER_TILE
        )
      : this.inward;
    // Heights and depths of the school GLB's last riser and door sill, in tiles.
    const outward = new THREE.Vector3(
      door.x - route.school.x,
      0,
      door.z - route.school.z
    ).normalize();
    const step = (depth: number, height: number) =>
      new THREE.Vector3(
        route.school.x + outward.x * depth,
        height,
        route.school.z + outward.z * depth
      );
    this.doorway = new SidewalkWalk(
      [gate, door, step(0.1935, 0.0267), step(0.114, 0.0267)],
      crosswalks,
      SCHOOL_DAY.MINUTES_PER_TILE
    );
    this.school = route.school;
    this.workplace = this.adult.workplace;
    this.legs = [
      { start: this.starts, walk: this.inward, reverse: false, together: true },
      {
        start: this.arrive + SCHOOL_DAY.HANDOFF_MINUTES,
        walk: this.away,
        reverse: true,
        together: false,
      },
      {
        start:
          this.release - SCHOOL_DAY.PICKUP_LEAD_MINUTES - this.away.duration,
        walk: this.away,
        reverse: false,
        together: false,
      },
      {
        start: this.release + SCHOOL_DAY.HANDOFF_MINUTES,
        walk: this.inward,
        reverse: true,
        together: true,
      },
    ];
  }
  get returnTime() {
    return this.release + SCHOOL_DAY.HANDOFF_MINUTES + this.inward.duration;
  }
  get starts() {
    return this.arrive - this.inward.duration;
  }
  homeSince(id: string) {
    if (this.time < this.starts) return 0;
    if (this.time >= this.returnTime)
      return this.clock - (this.time - this.returnTime);
    if (
      id === this.adult.id &&
      this.away === this.inward &&
      this.time >=
        this.arrive + SCHOOL_DAY.HANDOFF_MINUTES + this.away.duration &&
      this.time <
        this.release - SCHOOL_DAY.PICKUP_LEAD_MINUTES - this.away.duration
    )
      return this.arrive + SCHOOL_DAY.HANDOFF_MINUTES + this.away.duration;
    return Infinity;
  }
  reset(minute: number) {
    this.time = this.clock = minute;
    this.waited = false;
    this.draw();
  }

  advance(
    minute: number,
    requested: Set<Crosswalk>,
    occupied: (c: Crosswalk) => boolean,
    approaching: Set<Crosswalk>
  ) {
    if (minute < this.clock - 60 || minute - this.clock > 90) {
      this.reset(minute);
      return;
    }
    let next = this.time + Math.max(0, minute - this.clock);
    this.clock = Math.max(this.clock, minute);
    this.waited = false;
    for (const { start, walk, reverse } of this.legs) {
      if (next < start || this.time > start + walk.duration) continue;
      for (const { crossing, from, to } of walk.crossings) {
        const enter =
          start +
          (reverse ? walk.length - to : from) * SCHOOL_DAY.MINUTES_PER_TILE;
        const leave =
          start +
          (reverse ? walk.length - from : to) * SCHOOL_DAY.MINUTES_PER_TILE;
        if (
          this.time < enter &&
          next >=
            enter -
              CONFIG.VEHICLE.CROSSWALK_TRAFFIC_LEAD *
                CONFIG.CITY.MINUTES_PER_TICK
        )
          approaching.add(crossing);
        if (
          next <
            enter -
              CONFIG.VEHICLE.CROSSWALK_APPROACH * SCHOOL_DAY.MINUTES_PER_TILE ||
          this.time > leave + 0.5
        )
          continue;
        requested.add(crossing);
        if (this.time <= enter && next >= enter && occupied(crossing)) {
          next = enter;
          this.waited = true;
        }
      }
    }
    // Recover the bell schedule while everyone is indoors between the two trips.
    if (
      this.time >
        this.arrive + SCHOOL_DAY.HANDOFF_MINUTES + this.away.duration &&
      minute <
        this.release - SCHOOL_DAY.PICKUP_LEAD_MINUTES - this.away.duration
    )
      next = this.clock;
    this.time = next;
    this.draw();
  }
  private draw() {
    const t = this.time;
    this.guardian.visible = false;
    for (const p of this.pupils) p.visible = false;
    this.visible = t >= this.starts && t <= this.returnTime;
    if (!this.visible) return;
    for (const { start, walk, reverse, together } of this.legs) {
      if (t < start || t >= start + walk.duration) continue;
      const distance =
        (reverse
          ? 1 - (t - start) / walk.duration
          : (t - start) / walk.duration) * walk.length;
      this.guardian.visible = true;
      walk.place(this.guardian, distance, reverse, together ? -0.009 : 0);
      this.guardian.pose(!this.waited, t * 0.72);
      if (together)
        this.pupils.forEach((p, i) => {
          p.visible = true;
          walk.place(p, distance, reverse, 0.014 + i * 0.018);
          p.pose(!this.waited, t * 0.92 + i);
        });
      return;
    }
    const morning =
      t >= this.arrive && t < this.arrive + SCHOOL_DAY.HANDOFF_MINUTES;
    const pickup =
      t >= this.release - SCHOOL_DAY.PICKUP_LEAD_MINUTES &&
      t < this.release + SCHOOL_DAY.HANDOFF_MINUTES;
    if (!morning && !pickup) return;
    this.guardian.visible = true;
    this.doorway.place(this.guardian, 0, false, -0.012);
    this.guardian.pose(false, t * 0.25, morning || t >= this.release);
    this.pupils.forEach((p, i) => {
      const elapsed = t - (morning ? this.arrive : this.release) - i * 1.5;
      if (morning ? elapsed >= 13 : elapsed < 0) return;
      p.visible = true;
      const progress = THREE.MathUtils.clamp(elapsed / 13, 0, 1);
      this.doorway.place(
        p,
        this.doorway.length * (morning ? progress : 1 - progress),
        !morning,
        0.009 + i * 0.012
      );
      p.pose(elapsed > 0 && elapsed < 13, t * 1.15 + i);
    });
  }
}

export class SchoolDay extends THREE.Group {
  private routes: SchoolRoute[] = [];
  private crosswalks = new Map<THREE.Vector3, Crosswalk>();
  private workWalk?: WorkWalk;
  private workRoutes = new Map<string, THREE.Vector3[] | undefined>();
  private changed = false;
  private families = new Map<string, SchoolFamily>();
  private members = new Map<string, SchoolFamily>();
  setRoutes(
    routes: SchoolRoute[],
    crosswalks: Map<THREE.Vector3, Crosswalk>,
    work: WorkWalk
  ) {
    this.routes = routes.sort((a, b) => a.points.length - b.points.length);
    this.crosswalks = crosswalks;
    this.workWalk = work;
    this.workRoutes.clear();
    this.changed = true;
  }
  private toWork(school: StreetDoor, adult: Citizen) {
    const job = adult.workplace;
    if (!job) return;
    const key = [school.x, school.z, job.x, job.y].join(',');
    if (!this.workRoutes.has(key)) {
      const walk = this.workWalk?.(school, job.x, job.y);
      const length = walk?.reduce(
        (total, p, i) => (i ? total + p.distanceTo(walk[i - 1]) : total),
        0
      );
      const betweenBells =
        SCHOOL_DAY.DISMISSAL -
        SCHOOL_DAY.START -
        SCHOOL_DAY.PICKUP_LEAD_MINUTES -
        SCHOOL_DAY.HANDOFF_MINUTES;
      this.workRoutes.set(
        key,
        length !== undefined &&
          2 * (length + 1) * SCHOOL_DAY.MINUTES_PER_TILE < betweenBells
          ? walk
          : undefined
      );
    }
    return this.workRoutes.get(key);
  }
  updateResidents(
    city: ICity,
    minute: number,
    reset: boolean,
    bus?: (id: string) => number | undefined
  ) {
    const next = new Map<string, SchoolFamily>(),
      slots = new Map<StreetDoor, number>();
    this.members.clear();
    for (const route of this.routes) {
      const { home, school } = route;
      const slot = slots.get(school) ?? 0;
      if (slot >= SCHOOL_DAY.FAMILIES_PER_SCHOOL) continue;
      const building = city.getTile(home.x, home.z)?.building;
      if (!building || !('residents' in building)) continue;
      const people = building.residents.all;
      const pupils = people
        .filter(
          (p) =>
            p.age >= SCHOOL_DAY.MIN_AGE &&
            p.age < CONFIG.CITIZEN.MIN_WORKING_AGE
        )
        .slice(0, 2);
      if (!pupils.length) continue;
      const adults = people.filter(
        (p) => p.age >= 18 && bus?.(p.id) === undefined
      );
      const adult =
        adults.find(
          (p) => p.age >= CONFIG.CITIZEN.RETIREMENT_AGE && !p.workplace
        ) ??
        adults.find((p) => !p.workplace) ??
        adults.find((p) => this.toWork(school, p));
      if (!adult) continue;
      const key = [
        school.x,
        school.z,
        slot,
        adult.id,
        ...pupils.map((p) => p.id),
      ].join('/');
      let family = this.families.get(key);
      if (family && family.adult !== adult) {
        family.removeFromParent();
        family = undefined;
      }
      const fresh = !family;
      if (!family) {
        family = new SchoolFamily(adult, pupils, slot, school);
        this.add(family);
      }
      if (fresh || this.changed || adult.workplace !== family.workplace) {
        family.setPaths(route, this.toWork(school, adult), this.crosswalks);
      }
      if (reset || fresh) family.reset(minute);
      slots.set(school, slot + 1);
      next.set(key, family);
      for (const p of [adult, ...pupils]) this.members.set(p.id, family);
    }
    for (const [key, family] of this.families)
      if (!next.has(key)) family.removeFromParent();
    this.families = next;
    this.changed = false;
  }
  has(id: string) {
    return this.members.has(id);
  }
  homeSince(id: string) {
    return this.members.get(id)?.homeSince(id);
  }
  advance(
    minute: number,
    requested: Set<Crosswalk>,
    occupied: (c: Crosswalk) => boolean,
    approaching: Set<Crosswalk>
  ) {
    for (const family of this.families.values())
      family.advance(minute, requested, occupied, approaching);
  }
  get preview() {
    const school = this.families.values().next().value?.school as
      StreetDoor | undefined;
    if (!school) return;
    const point = school.door.clone().lerp(school.curb, 0.24);
    const out = school.curb.clone().sub(school.door);
    return {
      x: point.x,
      y: point.z,
      azimuth: (Math.atan2(out.x, out.z) * 180) / Math.PI + 22,
    };
  }
}
