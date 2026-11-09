import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citiesForRegion, canonicalCityForRegion } from '../src/chileLocations.ts';

test('Santiago city groups its commune-level components and preserves separate regional cities', () => {
  const options = citiesForRegion('Metropolitana');
  assert.equal(options.filter((city) => city === 'Santiago').length, 1);
  for (const commune of [
    'Providencia',
    'Las Condes',
    'Ñuñoa',
    'Maipú',
    'Puente Alto',
    'San Bernardo',
    'Vitacura',
    'Quilicura',
  ]) {
    assert(!options.includes(commune), commune);
    assert.equal(canonicalCityForRegion('Metropolitana', commune), 'Santiago');
  }
  for (const city of ['Melipilla', 'Talagante', 'Colina', 'Buin', 'Paine', 'Curacaví']) {
    assert(options.includes(city), city);
    assert.equal(canonicalCityForRegion('Metropolitana', city), city);
  }
  assert.equal(canonicalCityForRegion('Metropolitana', '  providencia  '), 'Santiago');
  assert(citiesForRegion('Valparaíso').includes('Viña del Mar'));
  assert(citiesForRegion('Atacama').includes('Copiapó'));
});
