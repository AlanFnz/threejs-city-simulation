import { ICity } from '../..';
import CONFIG from '../../../config';
import { Zone } from '../zones/zone';

export enum DevelopmentState {
  UNDEVELOPED = 'undeveloped',
  UNDER_CONSTRUCTION = 'under-construction',
  DEVELOPED = 'developed',
  ABANDONED = 'abandoned',
}

export class DevelopmentAttribute {
  private zone: Zone;
  private _state: DevelopmentState = DevelopmentState.UNDEVELOPED;
  private _level: number = 1;
  maxLevel: number;

  /**
   * number of simulation steps that building has met abandonment criteria
   * if abandonment criteria are not met, value is zero
   */
  private abandonmentCounter: number = 0;

  // counter for days under construction
  private constructionCounter: number = 0;

  constructor(zone: Zone, maxLevel: number = 3) {
    this.zone = zone;
    this.maxLevel = maxLevel;
  }

  get level(): number {
    return this._level;
  }

  set level(value: number) {
    this._level = value;
    this.zone.isMeshOutOfDate = true;
  }

  get state(): DevelopmentState {
    return this._state;
  }

  set state(value: DevelopmentState) {
    this._state = value;
    this.zone.isMeshOutOfDate = true;
  }

  simulate(city: ICity): void {
    this.checkAbandonmentCriteria(city);

    switch (this.state) {
      case DevelopmentState.UNDEVELOPED:
        if (
          this.checkDevelopmentCriteria(city) &&
          Math.random() < CONFIG.ZONE.REDEVELOP_CHANCE
        ) {
          this.state = DevelopmentState.UNDER_CONSTRUCTION;
          this.constructionCounter = 0;
        }
        break;
      case DevelopmentState.UNDER_CONSTRUCTION:
        if (++this.constructionCounter === CONFIG.ZONE.CONSTRUCTION_TIME) {
          this.state = DevelopmentState.DEVELOPED;
          this.level = 1;
          this.constructionCounter = 0;
        }
        break;
      case DevelopmentState.DEVELOPED:
        if (this.abandonmentCounter > CONFIG.ZONE.ABANDONMENT_THRESHOLD) {
          if (Math.random() < CONFIG.ZONE.ABANDONMENT_CHANCE) {
            this.state = DevelopmentState.ABANDONED;
          }
        } else {
          if (
            this.level < this.maxLevel &&
            Math.random() < CONFIG.ZONE.LEVEL_UP_CHANCE
          ) {
            this.level++;
          }
        }
        break;
      case DevelopmentState.ABANDONED:
        if (this.abandonmentCounter === 0) {
          if (Math.random() < CONFIG.ZONE.REDEVELOP_CHANCE) {
            this.state = DevelopmentState.DEVELOPED;
          }
        }
        break;
    }
  }

  checkDevelopmentCriteria(city: ICity): boolean {
    const { x, y } = this.zone;

    if (city.getTile(x, y)?.roadAccess?.value) {
      return true;
    } else {
      return false;
    }
  }

  checkAbandonmentCriteria(city: ICity): void {
    const { x, y } = this.zone;

    if (!city.getTile(x, y)?.roadAccess?.value) {
      this.abandonmentCounter++;
    } else {
      this.abandonmentCounter = 0;
    }
  }

  toHTML(): string {
    return `
      <span class="info-label">State </span>
      <span class="info-value">${this.state}</span>
      <br>
      <span class="info-label">Level </span>
      <span class="info-value">${this.level}</span>
      <br>`;
  }
}
