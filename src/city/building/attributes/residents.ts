import { ICity } from '../..';
import CONFIG from '../../../config';
import { Citizen } from '../../citizen';
import { ResidentialZone } from '../zones/residentialZone';
import { CommercialZone } from '../zones/commercialZone';
import { IndustrialZone } from '../zones/industrialZone';
import { Zone } from '../zones/zone';
import { random } from '../../../utils/rng';
import { cityEvents } from '../../../events';

export class ResidentsAttribute {
  private zone: Zone;
  private residents: Citizen[] = [];

  constructor(zone: Zone) {
    this.zone = zone;
  }

  get count(): number {
    return this.residents.length;
  }

  get all(): readonly Citizen[] {
    return this.residents;
  }

  get maximum(): number {
    return Math.pow(CONFIG.ZONE.MAX_RESIDENTS, this.zone.development.level);
  }

  update(city: ICity): void {
    // If building is abandoned, all residents are evicted and no more residents are allowed to move in.
    if (
      this.zone.development.state === 'abandoned' &&
      this.residents.length > 0
    ) {
      this.evictAll();
    } else if (this.zone.development.state === 'developed') {
      // Move in new residents if there is room - a nearby Hospital boosts
      // the move-in chance (healthcare access draws residents), while a
      // lack of nearby jobs slows it sharply (but doesn't stop it outright -
      // retirees/students/remote workers don't need one).
      if (this.residents.length < this.maximum) {
        const tile = city.getTile(this.zone.x, this.zone.y);
        let moveInChance = tile?.hospitalCoverage?.value
          ? CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE * CONFIG.CIVIC_SERVICES.HOSPITAL.MOVE_IN_CHANCE_MULTIPLIER
          : CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE;
        if (!this.hasAvailableJobsNearby(city)) {
          moveInChance *= CONFIG.ZONE.NO_JOBS_MOVE_IN_MULTIPLIER;
        }

        if (random() < moveInChance) {
          const citizen = new Citizen(this.zone as ResidentialZone);
          this.residents.push(citizen);
          cityEvents.emit('citizenMovedIn', {
            citizenId: citizen.id,
            x: this.zone.x,
            y: this.zone.y,
          });
        }
      }
    }

    for (const resident of this.residents) {
      resident.step(city);
    }
  }

  /** Bypasses the normal random move-in gate - save/load only, to restore an
   * exact roster rather than letting residents move in on their own schedule. */
  restore(citizens: Citizen[]): void {
    this.residents = citizens;
  }

  /** Same search radius/shape a citizen itself uses to find work
   * (Citizen.findJob) - checked here too so the decision to move in at all
   * accounts for whether work would actually be reachable afterward. */
  private hasAvailableJobsNearby(city: ICity): boolean {
    const jobTile = city.findTile(
      this.zone,
      (tile) => {
        const building = tile.building;
        return (
          (building instanceof CommercialZone || building instanceof IndustrialZone) &&
          building.jobs.availableJobs > 0
        );
      },
      CONFIG.CITIZEN.MAX_JOB_SEARCH_DISTANCE
    );
    return jobTile !== null;
  }

  evictAll(): void {
    const evicted = this.residents;
    this.residents = [];
    for (const resident of evicted) {
      resident.dispose();
      cityEvents.emit('citizenMovedOut', {
        citizenId: resident.id,
        x: this.zone.x,
        y: this.zone.y,
      });
    }
  }

  dispose(): void {
    this.evictAll();
  }

  toHTML(): string {
    let html = `<div class="info-heading">Residents (${this.residents.length}/${this.maximum})</div>`;

    html += '<ul class="info-citizen-list">';
    for (const resident of this.residents) {
      html += resident.toHTML();
    }
    html += '</ul>';

    return html;
  }
}
