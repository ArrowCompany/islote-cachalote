/**
 * MEDIDAS DEL TABLERO 3D
 *
 * La unidad es el LADO del hexágono, igual que en el Catan de mesa.
 * Con lado = 1, un hexágono mide 1.732 de lado a lado (√3) y 2 de punta a punta.
 * Así todo queda a escala real: fichas, caminos, poblados y ciudades.
 */

// --- Hexágonos ---
export const LADO = 1;
export const ANCHO_HEX = Math.sqrt(3); // 1.732: distancia entre dos lados planos

/**
 * Radio de la cara superior. Un hexágono de lado 1 tiene 1.732 entre lados
 * planos, así que con 0.985 la cara mide 1.706 y queda una ranura de 0.026
 * con la losa vecina: se ve la junta, pero no se cuela el mar.
 * El bisel abomba el centro de la losa hasta 1.015, y ahí sí se solapan.
 */
export const RADIO_LOSA = 0.985;
export const BISEL = 0.03; // borde redondeado
export const ALTO_LOSA = 0.16; // grosor del cuerpo
export const ALTO_TOTAL = ALTO_LOSA + BISEL * 2; // 0.22 con los bordes

// --- Fichas de número (el Catan real: ~58% del ancho del hexágono) ---
export const RADIO_FICHA = 0.47;
export const ALTO_FICHA = 0.05;

// --- Agua y arena ---
export const ALTURA_MAR = 0.03;
export const ALTURA_ARENA = 0.12;
export const RADIO_MAR = 0.985;
/** La plataforma de arena tapa las juntas y asoma como borde de playa. */
export const RADIO_ARENA = 1.02;

// --- Piezas (Etapa 2; quedan definidas aquí para que todo use la misma escala) ---
export const LARGO_CAMINO = 1.0; // un camino ocupa exactamente una arista
export const ANCHO_CAMINO = 0.24; // ~25% del lado, como en el juego real
export const ALTO_CAMINO = 0.1;
export const RADIO_POBLADO = 0.24;
export const ALTO_POBLADO = 0.46;
export const RADIO_CIUDAD = 0.34;
export const ALTO_CIUDAD = 0.58;
export const RADIO_LADRON = 0.2;
export const ALTO_LADRON = 0.92;

// --- Alturas de apoyo (para que nada quede flotando ni enterrado) ---
export const Y_ARENA = 0; // la arena nace en el nivel del agua
/** 0.004 de aire para que la losa no quede coplanaria con la arena (parpadeo). */
export const Y_LOSA = Y_ARENA + ALTURA_ARENA + 0.004; // base de las losas
export const Y_TOPE = Y_LOSA + ALTO_TOTAL; // superficie de juego

/** Puntos de probabilidad de cada número (los mismos del juego de mesa). */
export const PUNTOS_NUMERO: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
