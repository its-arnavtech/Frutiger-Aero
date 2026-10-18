// Each theme owns its scene and journey. New seasonal branches add a loader
// here when their world is ready; unavailable seasons never start a renderer.
export const themes = [
  { id: 'original', name: 'Original', subtitle: 'Glass, water & endless summer', title: 'Aerō — a world to drift through', color: '#62cbe5', loading: 'Entering a little daydream', available: true,
    description: 'A live Frutiger Aero city. Scroll through glass towers, floating gardens and turquoise lagoons.' },
  { id: 'autumn', name: 'Autumn', subtitle: 'The long way home', title: 'Amberfall — the long way home', color: '#b98456', loading: 'Following the last light', available: true,
    description: 'A living autumn valley. Scroll along the river, under the lantern bridge, through the village and around the ancient maple.' },
  { id: 'winter', name: 'Winter', available: false },
  { id: 'spring', name: 'Spring', available: false },
  { id: 'monsoon', name: 'Monsoon', subtitle: 'A world held in rain', title: 'Rainmere — a world held in rain', color: '#698b91', loading: 'Listening to the rain', available: true,
    description: 'An uninhabited alpine lake beneath rain-darkened cliffs. Scroll over clear water, snow shelves, waterfalls and drifting mountain mist.' },
];

export function resolveTheme(search = '') {
  const id = new URLSearchParams(search).get('world');
  return themes.find(theme => theme.id === id && theme.available) || themes[0];
}

export function themeHref(id, search = '') {
  const theme = themes.find(theme => theme.id === id && theme.available);
  if (!theme) return null;
  const params = new URLSearchParams({ world: id });
  const quality = new URLSearchParams(search).get('quality');
  if (['mobile', 'low'].includes(quality)) params.set('quality', quality);
  return `/?${params}`;
}

const loaders = {
  original: () => Promise.all([import('./world.js'), import('./journey.js')]),
  autumn: () => Promise.all([import('./autumn/world.js'), import('./autumn/journey.js')]),
  monsoon: () => Promise.all([import('./monsoon/world.js'), import('./monsoon/journey.js')]),
};
export async function loadTheme(id) {
  if (!Object.hasOwn(loaders, id)) throw new Error('This world is not available yet.');
  const [world, journey] = await loaders[id]();
  return { createWorld: world.createWorld, places: journey.places };
}
