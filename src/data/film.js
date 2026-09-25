/**
 * The pizza film made by `npm run film` (see scripts/film.mjs).
 * When the manifest does not exist yet, this is null and the pizza chapter
 * plays its 3D version.
 */
const found = import.meta.glob('./pizza.film.json', { eager: true, import: 'default' });

export const PIZZA_FILM = Object.values(found)[0] || null;
