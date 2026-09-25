import * as THREE from 'three';
import { brickTextures, woodTexture, marbleTexture, hammeredBump, tileTexture, withRepeat } from './textures';

/* Shared PBR materials for the restaurant (created once, reused). */

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export const brick = (rx = 1, ry = 1) =>
  once(`brick-${rx}-${ry}`, () => {
    const { map, bump } = brickTextures();
    return new THREE.MeshStandardMaterial({
      map: withRepeat(map, rx, ry),
      bumpMap: withRepeat(bump, rx, ry),
      bumpScale: 2.2,
      roughness: 0.92,
      color: '#f4efe6',
    });
  });

export const wood = (tone = 'oak', rx = 1, ry = 1) =>
  once(`wood-${tone}-${rx}-${ry}`, () => new THREE.MeshStandardMaterial({ map: withRepeat(woodTexture(tone), rx, ry), roughness: 0.62 }));

export const marble = () => once('marble', () => new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.22, metalness: 0 }));

export const tile = () => once('tile', () => new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.58 }));

export const blackMetal = () => once('black', () => new THREE.MeshStandardMaterial({ color: '#171412', metalness: 0.65, roughness: 0.42 }));

export const brass = () => once('brass', () => new THREE.MeshStandardMaterial({ color: '#c9a25e', metalness: 1, roughness: 0.26, side: THREE.DoubleSide }));

/** Hammered copper — the oven body (bump = small hammer dimples). */
export const copper = () =>
  once('copper', () =>
    new THREE.MeshStandardMaterial({
      color: '#e39a6c',
      metalness: 1,
      roughness: 0.36,
      bumpMap: withRepeat(hammeredBump(0), 6, 2),
      bumpScale: 1.6,
    }),
  );

/** The copper dome: hammered panels with vertical seams. */
export const copperDome = () =>
  once('copper-dome', () =>
    new THREE.MeshStandardMaterial({
      color: '#d98d5f',
      metalness: 1,
      roughness: 0.24,
      bumpMap: withRepeat(hammeredBump(16), 1, 1),
      bumpScale: 1.8,
    }),
  );

export const copperPipe = () => once('copper-pipe', () => new THREE.MeshStandardMaterial({ color: '#cf7f52', metalness: 1, roughness: 0.28 }));

export const ceramic = () => once('ceramic', () => new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.35 }));

export const glass = (color = '#3c5a2a') =>
  once(`glass-${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.85 }));

export const flat = (color, roughness = 0.8) => once(`flat-${color}-${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness }));
