import { firstNames, surnames } from './names';
import { random } from '../../../utils/rng';

function getRandomFirstName(): string {
  return firstNames[Math.floor(random() * firstNames.length)];
}

function getRandomSurname(): string {
  return surnames[Math.floor(random() * surnames.length)];
}

function getRandomAge(min: number = 1, max: number = 99): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export { getRandomFirstName, getRandomSurname, getRandomAge };
