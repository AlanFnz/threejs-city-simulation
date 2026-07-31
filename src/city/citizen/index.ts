import { ICity } from '..';
import CONFIG from '../../config';
import { CommercialZone } from '../building/zones/commercialZone';
import { IndustrialZone } from '../building/zones/industrialZone';
import { ResidentialZone } from '../building/zones/residentialZone';
import { ITile } from '../tile';
import { CITIZEN_STATE, CitizenState } from './constants';
import { getRandomFirstName, getRandomSurname } from './utils';
import { random } from '../../utils/rng';

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

  /**
   * `saved` restores a citizen exactly as it was when a save was written
   * (id/name/age/state), rather than rolling a new one - used only by
   * save/load, which then wires up `workplace` separately once every zone
   * exists.
   */
  constructor(
    residence: ResidentialZone,
    saved?: {
      id: string;
      firstName: string;
      surname: string;
      age: number;
      state: CitizenState;
    }
  ) {
    this.id = saved?.id ?? crypto.randomUUID();
    this.firstName = saved?.firstName ?? getRandomFirstName();
    this.surname = saved?.surname ?? getRandomSurname();
    this.age = saved?.age ?? 1 + Math.floor(100 * random());
    this.state = saved?.state ?? CITIZEN_STATE.IDLE;
    this.stateCounter = 0;
    this.residence = residence;
    this.workplace = null;
    if (!saved) this.initializeState();
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
    this.workplace?.jobs.layOff(this);
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
      (building as CommercialZone | IndustrialZone).jobs.hire(this);
      return building;
    } else {
      return null;
    }
  }

  setWorkplace(workplace: CommercialZone | IndustrialZone | null): void {
    this.workplace = workplace;
  }
}
