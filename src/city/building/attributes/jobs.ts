import CONFIG from '../../../config';
import { Citizen } from '../../citizen';
import { Zone } from '../zones/zone';
import { DevelopmentState } from './development';
import { cityEvents } from '../../../events';

export class JobsAttribute {
  private zone: Zone;
  private _workers: Citizen[] = [];

  constructor(zone: Zone) {
    this.zone = zone;
  }

  /** Read-only: hire()/layOff() are the only ways to change the roster. */
  get workers(): readonly Citizen[] {
    return this._workers;
  }

  get maxWorkers(): number {
    // if building is not developed, there are no available jobs
    if (
      this.zone.development.state === DevelopmentState.ABANDONED ||
      this.zone.development.state === DevelopmentState.UNDEVELOPED
    ) {
      return 0;
    } else {
      return Math.pow(CONFIG.ZONE.MAX_WORKERS, this.zone.development.level);
    }
  }

  get availableJobs(): number {
    return this.maxWorkers - this._workers.length;
  }

  get filledJobs(): number {
    return this._workers.length;
  }

  update(): void {
    // if building is abandoned, all workers are laid off and no
    // more workers are allowed to work here
    if (this.zone.development.state === DevelopmentState.ABANDONED) {
      this.layOffWorkers();
    }
  }

  hire(citizen: Citizen): void {
    this._workers.push(citizen);
    cityEvents.emit('citizenEmployed', {
      citizenId: citizen.id,
      x: this.zone.x,
      y: this.zone.y,
    });
  }

  layOff(citizen: Citizen): void {
    const index = this._workers.indexOf(citizen);
    if (index === -1) return;
    this._workers.splice(index, 1);
    cityEvents.emit('citizenUnemployed', {
      citizenId: citizen.id,
      x: this.zone.x,
      y: this.zone.y,
    });
  }

  layOffWorkers(): void {
    for (const worker of this._workers) {
      worker.setWorkplace(null);
      cityEvents.emit('citizenUnemployed', {
        citizenId: worker.id,
        x: this.zone.x,
        y: this.zone.y,
      });
    }
    this._workers = [];
  }

  dispose(): void {
    this.layOffWorkers();
  }
}
