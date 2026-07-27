import { ICity } from '../..';
import CONFIG from '../../../config';
import { Citizen } from '../../citizen';
import { ResidentialZone } from '../zones/residentialZone';
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
      // Move in new residents if there is room
      if (
        this.residents.length < this.maximum &&
        random() < CONFIG.ZONE.RESIDENT_MOVE_IN_CHANCE
      ) {
        const citizen = new Citizen(this.zone as ResidentialZone);
        this.residents.push(citizen);
        cityEvents.emit('citizenMovedIn', {
          citizenId: citizen.id,
          x: this.zone.x,
          y: this.zone.y,
        });
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
