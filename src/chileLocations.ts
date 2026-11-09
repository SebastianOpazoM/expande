import cityData from './data/chile-cities.json' with { type: 'json' };
import { norm } from '../shared/model.ts';

// Region names: https://www.bcn.cl/siit/nuestropais/regiones.htm (north to south).
export const chileanRegions = [
  ['15', 'Arica y Parinacota'],
  ['1', 'Tarapacá'],
  ['2', 'Antofagasta'],
  ['3', 'Atacama'],
  ['4', 'Coquimbo'],
  ['5', 'Valparaíso'],
  ['13', 'Metropolitana de Santiago'],
  ['6', 'Libertador General Bernardo O’Higgins'],
  ['7', 'Maule'],
  ['16', 'Ñuble'],
  ['8', 'Biobío'],
  ['9', 'La Araucanía'],
  ['14', 'Los Ríos'],
  ['10', 'Los Lagos'],
  ['11', 'Aysén del General Carlos Ibáñez del Campo'],
  ['12', 'Magallanes y de la Antártica Chilena'],
].map(([code, name]) => ({
  code,
  id: name === 'Metropolitana de Santiago' ? 'Metropolitana' : name,
  name,
}));

export function citiesForRegion(region: string): string[] {
  const code = chileanRegions.find((r) => r.id === region)?.code;
  return code ? (cityData.citiesByRegion as Record<string, string[]>)[code] || [] : [];
}

export function canonicalCityForRegion(region: string, city: string): string {
  const code = chileanRegions.find((r) => r.id === region)?.code;
  const aliases = code
    ? (cityData.cityAliasesByRegion as Record<string, Record<string, string>>)[code]
    : undefined;
  const cityKey = norm(city).trim();
  const alias = Object.entries(aliases || {}).find(([name]) => norm(name) === cityKey);
  return alias?.[1] || citiesForRegion(region).find((name) => norm(name) === cityKey) || city;
}
