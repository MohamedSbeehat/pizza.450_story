/**
 * The pizza film made by `npm run film` (see scripts/film.mjs).
 * When the manifest does not exist yet, this is null and the pizza chapter
 * plays its 3D version.
 */
import { PIZZA } from './story';

const found = import.meta.glob('./pizza.film.json', { eager: true, import: 'default' });

/** null → the pizza chapter plays in 3D (also when PIZZA.film.useFilm is false). */
export const PIZZA_FILM = PIZZA.film?.useFilm === false ? null : Object.values(found)[0] || null;
