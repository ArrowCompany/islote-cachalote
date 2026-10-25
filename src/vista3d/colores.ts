/**
 * PALETA DEL TABLERO 3D
 *
 * Colores por recurso, con una cara superior y un canto más oscuro para que
 * las losas se lean como piezas de plástico/madera con relieve.
 */
export type EstiloTierra = {
  /** Cara de arriba de la losa. */
  cima: string;
  /** Canto (laterales) de la losa. */
  lado: string;
};

export const TIERRA: Record<string, EstiloTierra> = {
  wood: { cima: '#2f7a45', lado: '#1d4f2b' }, // bosque: verde oscuro
  brick: { cima: '#b9572f', lado: '#7c351a' }, // colinas: rojizo
  wool: { cima: '#86bb4e', lado: '#5c8632' }, // pastos: verde claro
  grain: { cima: '#dfb43e', lado: '#a3811f' }, // campos: amarillo
  ore: { cima: '#9198a1', lado: '#5f656e' }, // montañas: gris
  desert: { cima: '#e3d0a0', lado: '#b5a071' }, // desierto: beige
};

export const AGUA = '#176b8c';
export const AGUA_SOMERA = '#2a8aa8';
export const AGUA_CLARA = '#3ba0bd';
export const AGUA_PROFUNDA = '#0a3348';
export const ARENA = '#d8c48f';
export const ESPUMA = '#cdebf2';

export const FICHA_FONDO = '#f7ecd2';
export const FICHA_BORDE = '#8a5a2b';
export const FICHA_LINEA = '#d9c08a';
export const TINTA = '#3b2a14';
export const ROJO_NUMERO = '#b3352a';

// Decoración
export const ARBOL_COPA = '#1f6b3c';
export const ARBOL_COPA_CLARA = '#2d8a4c';
export const ARBOL_TRONCO = '#6b4526';
export const MONTANA = '#7f868f';
export const MONTANA_CLARA = '#a3aab3';
export const COLINA = '#c0653c';
export const COLINA_CLARA = '#d98a5f';
export const OVEJA = '#f6f2e6';
export const OVEJA_CARA = '#3a3330';
export const TRIGO = '#e8c455';
export const TRIGO_TALLO = '#c9a13a';
export const DUNA = '#d9c794';

/** Sombra suave tipo "papel" para los objetos que apoyan sobre la losa. */
export const SOMBRA = '#000000';
