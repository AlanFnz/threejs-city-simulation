import CONFIG from '../../config';

type GroundPoint = { x: number; z: number };

/** The two actual curb landings of a painted crossing, in world coordinates. */
export class Crosswalk {
  readonly approachTile: GroundPoint;
  private acrossX: boolean;
  private center: number;
  private low: number;
  private high: number;

  constructor(a: GroundPoint, b: GroundPoint) {
    this.acrossX = Math.abs(a.x - b.x) > Math.abs(a.z - b.z);
    this.center = (this.alongLane(a) + this.alongLane(b)) / 2;
    const x = Math.round((a.x + b.x) / 2);
    const z = Math.round((a.z + b.z) / 2);
    const outward = Math.sign(this.center - Math.round(this.center));
    this.approachTile = this.acrossX
      ? { x, z: z + outward }
      : { x: x + outward, z };
    this.low = Math.min(this.acrossLane(a), this.acrossLane(b));
    this.high = Math.max(this.acrossLane(a), this.acrossLane(b));
  }

  private alongLane(p: GroundPoint): number {
    return this.acrossX ? p.z : p.x;
  }
  private acrossLane(p: GroundPoint): number {
    return this.acrossX ? p.x : p.z;
  }

  occupiedBy(p: GroundPoint): boolean {
    const side = this.acrossLane(p);
    return (
      side >= this.low &&
      side <= this.high &&
      Math.abs(this.alongLane(p) - this.center) <
        CONFIG.VEHICLE.CROSSWALK_CLEARANCE
    );
  }

  /** Cars already over the stop line must clear the stripes before a walker enters. */
  stoppingDistance(p: GroundPoint, heading: GroundPoint): number {
    const forward = this.alongLane(heading);
    if (Math.abs(forward) < 0.01 || this.occupiedBy(p)) return Infinity;
    const distance = (this.center - this.alongLane(p)) / forward;
    const side = this.acrossLane(p) + distance * this.acrossLane(heading);
    if (distance < 0 || side < this.low || side > this.high) return Infinity;
    return Math.max(0, distance - CONFIG.VEHICLE.STOP_LINE_GAP);
  }
}
