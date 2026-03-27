import { ICity } from '..';
import CONFIG from '../../config';
import { CommercialZone } from '../building/zones/commercialZone';
import { IndustrialZone } from '../building/zones/industrialZone';
import { ResidentialZone } from '../building/zones/residentialZone';
import { ITile } from '../tile';
import { CITIZEN_STATE, CitizenState } from './constants';
import { getRandomFirstName, getRandomSurname } from './utils';
import { random } from '../../utils/rng';

import calendarIcon from '../../assetManager/icons/calendar.png';
import jobIcon from '../../assetManager/icons/job.png';

export interface ICitizen {
  id: string;
  firstName: string;
  surname: string;
  age: number;
  state: CitizenState;
  stateCounter: number;
  residence: ResidentialZone;
  workplace: CommercialZone | IndustrialZone | null;
  step(city: ICity): void;
  dispose(): void;
  setWorkplace(workplace: CommercialZone | IndustrialZone | null): void;
  toHTML(): string;
}

export class Citizen implements ICitizen {
  id: string;
  firstName: string;
  surname: string;
  age: number;
  state: CitizenState;
  stateCounter: number;
  residence: ResidentialZone;
  workplace: CommercialZone | IndustrialZone | null;

  constructor(residence: ResidentialZone) {
    this.id = crypto.randomUUID();
    this.firstName = getRandomFirstName();
    this.surname = getRandomSurname();
    this.age = 1 + Math.floor(100 * random());
    this.state = CITIZEN_STATE.IDLE;
    this.stateCounter = 0;
    this.residence = residence;
    this.workplace = null;
    this.initializeState();
  }

  private initializeState() {
    if (this.age < CONFIG.CITIZEN.MIN_WORKING_AGE) {
      this.state = CITIZEN_STATE.SCHOOL;
    } else if (this.age >= CONFIG.CITIZEN.RETIREMENT_AGE) {
      this.state = CITIZEN_STATE.RETIRED;
    } else {
      this.state = CITIZEN_STATE.UNEMPLOYED;
    }
  }

  step(city: ICity): void {
    switch (this.state) {
      case CITIZEN_STATE.IDLE:
      case CITIZEN_STATE.SCHOOL:
      case CITIZEN_STATE.RETIRED:
        // nothing for now
        break;
      case CITIZEN_STATE.UNEMPLOYED:
        this.workplace = this.findJob(city);
        if (this.workplace) {
          this.state = CITIZEN_STATE.EMPLOYED;
        }
        break;
      case CITIZEN_STATE.EMPLOYED:
        if (!this.workplace) {
          this.state = CITIZEN_STATE.UNEMPLOYED;
        }
        break;
      default:
        console.error(
          `Citizen ${this.id} is in an unknown state (${this.state})`
        );
    }
  }

  dispose() {
    // Remove resident from its  workplace
    const workerIndex = this.workplace?.jobs.workers.indexOf(this);

    if (workerIndex !== undefined && workerIndex > -1 && this.workplace) {
      this.workplace.jobs.workers.splice(workerIndex, 1);
    }
  }

  private findJob(city: ICity): CommercialZone | IndustrialZone | null {
    let building: CommercialZone | IndustrialZone | null = null;

    const tile = city.findTile(
      { x: this.residence.x, y: this.residence.y },
      (tile: ITile) => {
        const potentialBuilding = tile.building;
        if (
          potentialBuilding instanceof CommercialZone ||
          potentialBuilding instanceof IndustrialZone
        ) {
          if (potentialBuilding.jobs.availableJobs > 0) {
            building = potentialBuilding;
            return true;
          }
        }
        return false;
      },
      CONFIG.CITIZEN.MAX_JOB_SEARCH_DISTANCE
    );

    if (tile && building) {
      // employ the citizen at the building
      (building as CommercialZone | IndustrialZone).jobs.workers.push(this);
      return building;
    } else {
      return null;
    }
  }

  setWorkplace(workplace: CommercialZone | IndustrialZone | null): void {
    this.workplace = workplace;
  }

  toHTML(): string {
    return `
      <li class="info-citizen">
        <span class="info-citizen-name">${this.firstName} ${this.surname}</span>
        <br>
        <span class="info-citizen-details">
          <span>
            <img class="info-citizen-icon" src=${calendarIcon}>
            ${this.age} 
          </span>
          <span>
            <img class="info-citizen-icon" src=${jobIcon}>
            ${this.state}
          </span>
        </span>
      </li>
    `;
  }
}

