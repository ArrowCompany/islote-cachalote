/**
 * CARGA DE THREE.JS DESDE CDN (versión fija)
 *
 * Three.js NO se empaqueta en la app: se importa en tiempo de ejecución desde
 * jsDelivr con una versión exacta. El paquete `three` que está en devDependencies
 * solo se usa para los tipos de TypeScript (import type), nunca para el runtime.
 */

export type Three = typeof import('three');

/** Versión fijada: si se cambia, hay que probar todo el 3D. */
export const VERSION_THREE = '0.169.0';

const URL_THREE = `https://cdn.jsdelivr.net/npm/three@${VERSION_THREE}/build/three.module.js`;

let promesa: Promise<Three> | null = null;

/**
 * Devuelve (y cachea) el módulo de Three.js.
 * La URL es absoluta, así que Vite la deja intacta y el navegador la importa
 * como módulo nativo. Si falla la red, se puede reintentar más adelante.
 */
export function cargarThree(): Promise<Three> {
  if (!promesa) {
    promesa = import(/* @vite-ignore */ URL_THREE) as Promise<Three>;
    promesa.catch(() => {
      promesa = null;
    });
  }
  return promesa;
}
