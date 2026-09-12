/** Classify a multi-file model upload without touching Three.js loaders. */

export function classifyModelFiles(files) {
  const list = [...(files ?? [])].filter((file) => file?.name);
  const named = (ext) => list.filter((file) => file.name.toLowerCase().endsWith(ext));
  const objs = named('.obj');
  const gltfs = [...named('.glb'), ...named('.gltf')];
  const mtls = named('.mtl');
  const extras = list.filter((file) => {
    const name = file.name.toLowerCase();
    return !name.endsWith('.obj') && !name.endsWith('.glb') && !name.endsWith('.gltf') && !name.endsWith('.mtl');
  });

  if (objs.length && gltfs.length) {
    return { error: 'Pick either a .glb/.gltf or an .obj set, not both.' };
  }
  if (gltfs.length > 1) {
    return { error: 'Choose a single .glb or .gltf file.' };
  }
  if (gltfs.length === 1) {
    return { kind: 'gltf', primary: gltfs[0], sidecars: [] };
  }
  if (objs.length > 1) {
    return { error: 'Choose one .obj file (you can add its .mtl and textures).' };
  }
  if (objs.length === 1) {
    return { kind: 'obj', primary: objs[0], mtl: mtls[0] ?? null, sidecars: [...mtls, ...extras] };
  }
  if (mtls.length) {
    return { error: 'That .mtl needs its .obj. Select both files together.' };
  }
  return { error: 'Choose a .glb, .gltf, or .obj file.' };
}

export function formatUploadLabel(classified) {
  if (!classified?.primary) return '';
  const extras = (classified.sidecars ?? []).map((file) => file.name);
  if (!extras.length) return classified.primary.name;
  return [classified.primary.name, ...extras].join(' + ');
}
