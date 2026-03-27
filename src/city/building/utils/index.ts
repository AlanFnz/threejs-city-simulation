import {
  adjectives,
  commercialBusinessTypes,
  descriptors,
  industryTypes,
} from './names';
import { random } from '../../../utils/rng';

function getRandomElement<T>(array: T[]): T {
  const randomIndex = Math.floor(random() * array.length);
  return array[randomIndex];
}

function generateCommericalBuildingName(): string {
  const adjective = getRandomElement(adjectives);
  const businessType = getRandomElement(commercialBusinessTypes);
  return `${adjective} ${businessType}`;
}

function generateIndustrialBuildingName(): string {
  const descriptor = getRandomElement(descriptors);
  const industryType = getRandomElement(industryTypes);
  return `${descriptor} ${industryType}`;
}

export {
  generateCommericalBuildingName,
  generateIndustrialBuildingName,
};
