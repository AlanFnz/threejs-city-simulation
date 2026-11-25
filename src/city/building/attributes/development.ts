import { ICity } from '../..';
import CONFIG from '../../../config';
import { Zone } from '../zones/zone';
import { random } from '../../../utils/rng';
import { cityEvents } from '../../../events';

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

  private workTicks: number | null = null;

  get constructionTicks(): number | null {
    return this.workTicks;
  }

  get targetLevel(): number {
    return this.state === DevelopmentState.DEVELOPED && this.workTicks !== null
      ? this.level + 1
      : this.level;
  }

  private get duration(): number {
    return this.state === DevelopmentState.UNDER_CONSTRUCTION
      ? CONFIG.ZONE.CONSTRUCTION_TIME
      : CONFIG.ZONE.UPGRADE_TIME;
  }

  get constructionStage(): 'foundations' | 'frame' | null {
    if (this.workTicks === null) return null;
    return this.workTicks < this.duration / 2 ? 'foundations' : 'frame';
  }

  private notifyConstructionStage(): void {
    this.zone.isMeshOutOfDate = true;
    cityEvents.emit('constructionStageChanged', {
      x: this.zone.x,
      y: this.zone.y,
    });
  }

  restoreConstruction(ticks: number | undefined): void {
    if (
      ticks === undefined ||
      !Number.isFinite(ticks) ||
      !(
        this.state === DevelopmentState.UNDER_CONSTRUCTION ||
        (this.state === DevelopmentState.DEVELOPED &&
          this.level < this.maxLevel)
      )
    )
      return;
    this.workTicks = Math.max(
      0,
      Math.min(Math.trunc(ticks), this.duration - 1)
    );
    this.zone.isMeshOutOfDate = true;
  }

  private advanceConstruction(): void {
    const previous = this.constructionStage;
    this.workTicks = (this.workTicks ?? 0) + 1;
    if (this.workTicks >= this.duration) {
      const target = this.targetLevel;
      this.workTicks = null;
      if (this.state === DevelopmentState.UNDER_CONSTRUCTION)
        this.state = DevelopmentState.DEVELOPED;
      this.level = target;
    } else if (this.constructionStage !== previous) {
      this.notifyConstructionStage();
    }
  }

  constructor(zone: Zone, maxLevel: number = 3) {
    this.zone = zone;
    this.maxLevel = maxLevel;
  }

  get level(): number {
    return this._level;
  }

  set level(value: number) {
    const previousLevel = this._level;
    this._level = value;
    this.zone.isMeshOutOfDate = true;
    if (value !== previousLevel) {
      cityEvents.emit('levelChanged', {
        x: this.zone.x,
        y: this.zone.y,
        level: value,
        previousLevel,
      });
    }
  }

  get state(): DevelopmentState {
    return this._state;
  }

  set state(value: DevelopmentState) {
    const previousState = this._state;
    if (value !== previousState) {
      this.workTicks = value === DevelopmentState.UNDER_CONSTRUCTION ? 0 : null;
    }
    this._state = value;
    this.zone.isMeshOutOfDate = true;
    if (value !== previousState) {
      cityEvents.emit('developmentStateChanged', {
        x: this.zone.x,
        y: this.zone.y,
        state: value,
        previousState,
      });
    }
  }

  simulate(city: ICity): void {
    this.checkAbandonmentCriteria(city);

    switch (this.state) {
      case DevelopmentState.UNDEVELOPED:
        if (
          this.checkDevelopmentCriteria(city) &&
          random() < CONFIG.ZONE.REDEVELOP_CHANCE
        ) {
          this.state = DevelopmentState.UNDER_CONSTRUCTION;
        }
        break;
      case DevelopmentState.UNDER_CONSTRUCTION:
        this.advanceConstruction();
        break;
      case DevelopmentState.DEVELOPED:
        if (this.abandonmentCounter > CONFIG.ZONE.ABANDONMENT_THRESHOLD) {
          // A nearby Police Station makes a zone immune to abandonment -
          // the roll never happens at all while covered.
          const tile = city.getTile(this.zone.x, this.zone.y);
          if (
            !tile?.policeStationCoverage?.value &&
            random() < CONFIG.ZONE.ABANDONMENT_CHANCE
          ) {
            this.state = DevelopmentState.ABANDONED;
          }
        } else if (this.workTicks !== null) {
          this.advanceConstruction();
        } else {
          const tile = city.getTile(this.zone.x, this.zone.y);
          const levelUpChance = tile?.schoolCoverage?.value
            ? CONFIG.ZONE.LEVEL_UP_CHANCE *
              CONFIG.CIVIC_SERVICES.SCHOOL.LEVEL_UP_CHANCE_MULTIPLIER
            : CONFIG.ZONE.LEVEL_UP_CHANCE;
          if (
            this.level < this.maxLevel &&
            random() < levelUpChance &&
            city.reserveUpgradeCrew()
          ) {
            this.workTicks = 0;
            this.notifyConstructionStage();
          }
        }
        break;
      case DevelopmentState.ABANDONED:
        if (this.abandonmentCounter === 0) {
          if (random() < CONFIG.ZONE.REDEVELOP_CHANCE) {
            this.state = DevelopmentState.DEVELOPED;
          }
        }
        break;
    }
  }

  checkDevelopmentCriteria(city: ICity): boolean {
    const { x, y } = this.zone;
    const tile = city.getTile(x, y);
    return !!(tile?.roadAccess?.value && tile?.powerAccess?.value);
  }

  checkAbandonmentCriteria(city: ICity): void {
    const { x, y } = this.zone;
    const tile = city.getTile(x, y);

    if (!tile?.roadAccess?.value || !tile?.powerAccess?.value) {
      this.abandonmentCounter++;
    } else {
      this.abandonmentCounter = 0;
    }
  }
}
