import { readFileSync } from 'node:fs';
import type { Data } from '../shared/model.ts';
export const sourcePath = new URL('../source-package/Expande_paquete_para_Figma/', import.meta.url);
export const seed: Data = JSON.parse(
  readFileSync(new URL('03_datos_mockup.json', sourcePath), 'utf8'),
);
export const schema = JSON.parse(
  readFileSync(new URL('04_esquema_datos.json', sourcePath), 'utf8'),
);
