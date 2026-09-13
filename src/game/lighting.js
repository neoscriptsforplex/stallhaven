/** Shop/dungeon light levels. Shop is a modest bump over the old 0.9 hemi / 1.05 exposure. */

export const SHOP_LIGHT = {
  hemi: 1.14,
  ambient: 0.24,
  fill: 0.48,
  door: 2.2,
  sun: 1.15,
  exposure: 1.12,
};

export const DUNGEON_LIGHT = {
  hemi: 0.46,
  ambient: 0.06,
  fill: 0,
  door: 0,
  sun: 0.35,
  exposure: 0.94,
};

export function lightingForScene(mode = 'shop') {
  return mode === 'dungeon' ? DUNGEON_LIGHT : SHOP_LIGHT;
}

export function applySceneLighting(lights, mode = 'shop') {
  const next = lightingForScene(mode);
  if (lights.hemi) lights.hemi.intensity = next.hemi;
  if (lights.ambient) lights.ambient.intensity = next.ambient;
  if (lights.fill) lights.fill.intensity = next.fill;
  if (lights.door) lights.door.intensity = next.door;
  if (lights.sun) lights.sun.intensity = next.sun;
  if (lights.renderer) lights.renderer.toneMappingExposure = next.exposure;
  return next;
}
