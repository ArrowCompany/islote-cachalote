import {
  COSTO,
  COSTO_CARTA,
  LIMITE,
  RECURSOS,
  caminosDisponibles,
  contarPiezas,
  lugaresPara,
  manoVacia,
  puedePagar,
  tasasDe,
  totalCartas,
  verticesLibres,
} from './reglas';
import type { EstadoJuego, Recurso, Recursos, TipoPieza } from './reglas';
import type { Geometria, Mapa } from './tablero';

export const esBot = (uid: string) => uid.startsWith('bot_');

// Probabilidad relativa de cada número (fichas): el 6 y el 8 son los mejores.
const PESO: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

export const manoDeBot = (manos: Record<string, Recursos> | undefined, uid: string): Recursos => ({
  ...manoVacia(),
  ...(manos?.[uid] ?? {}),
});

const hexEn = (mapa: Mapa, r: number, c: number) => mapa.hexes.find((h) => h.r === r && h.c === c);

/** Valor de un vértice: suma de probabilidades de los hexágonos + variedad de recursos. */
export function valorVertice(mapa: Mapa, geo: Geometria, v: string): number {
  const hexes = geo.vertices[v]?.hexes ?? [];
  let total = 0;
  const tipos = new Set<string>();
  hexes.forEach(([r, c]) => {
    const h = hexEn(mapa, r, c);
    if (!h || h.tipo === 'desert') return;
    total += PESO[h.num] ?? 0;
    tipos.add(h.tipo);
  });
  return total + tipos.size * 0.6;
}

function mejorDe(mapa: Mapa, geo: Geometria, lista: string[]): string | null {
  let mejor: string | null = null;
  let puntaje = -1;
  lista.forEach((v) => {
    const p = valorVertice(mapa, geo, v);
    if (p > puntaje) {
      puntaje = p;
      mejor = v;
    }
  });
  return mejor;
}

/** Poblado para la fase de colocación inicial (cualquier vértice libre vale). */
export function pobladoInicial(mapa: Mapa, geo: Geometria, j: EstadoJuego): string | null {
  return mejorDe(mapa, geo, verticesLibres(geo, j.poblados));
}

/** Poblado nuevo durante la partida (debe estar conectado a un camino propio). */
export function pobladoNuevo(mapa: Mapa, geo: Geometria, j: EstadoJuego, uid: string): string | null {
  return mejorDe(mapa, geo, lugaresPara(geo, j, uid, 'poblado'));
}

function puntajeVerticeLibre(mapa: Mapa, geo: Geometria, j: EstadoJuego, v: string): number {
  if (j.poblados[v]) return -1;
  const vecinos = geo.vertices[v]?.vecinos ?? [];
  if (vecinos.some((n) => j.poblados[n])) return -1;
  return valorVertice(mapa, geo, v);
}

/** Camino para la colocación inicial, pegado al poblado recién puesto. */
export function caminoInicial(mapa: Mapa, geo: Geometria, j: EstadoJuego, desde: string): string | null {
  const ops = (geo.vertices[desde]?.aristas ?? []).filter((e) => !j.caminos[e]);
  let mejor: string | null = null;
  let puntaje = -1;
  ops.forEach((e) => {
    const a = geo.aristas[e];
    const otro = a.a === desde ? a.b : a.a;
    const p = puntajeVerticeLibre(mapa, geo, j, otro);
    if (p > puntaje) {
      puntaje = p;
      mejor = e;
    }
  });
  return mejor ?? ops[0] ?? null;
}

/** Camino de expansión hacia el mejor hueco libre. */
export function caminoNuevo(mapa: Mapa, geo: Geometria, j: EstadoJuego, uid: string): string | null {
  const ops = caminosDisponibles(geo, j, uid);
  let mejor: string | null = null;
  let puntaje = -1;
  ops.forEach((e) => {
    const a = geo.aristas[e];
    const p = Math.max(puntajeVerticeLibre(mapa, geo, j, a.a), puntajeVerticeLibre(mapa, geo, j, a.b));
    if (p > puntaje) {
      puntaje = p;
      mejor = e;
    }
  });
  return mejor ?? ops[0] ?? null;
}

export type AccionBot =
  | { tipo: 'construir'; pieza: TipoPieza; id: string }
  | { tipo: 'comprar' }
  | { tipo: 'banco'; da: Recurso; recibe: Recurso }
  | { tipo: 'terminar' };

const tiene = (m: Recursos, c: Partial<Recursos>) => RECURSOS.every((r) => m[r] >= (c[r] ?? 0));

function ciudadObjetivo(mapa: Mapa, geo: Geometria, j: EstadoJuego, uid: string): string | null {
  const propias = Object.entries(j.poblados).filter(([, p]) => p.uid === uid && p.tipo === 'poblado');
  let mejor: string | null = null;
  let puntaje = -1;
  propias.forEach(([v]) => {
    const p = valorVertice(mapa, geo, v);
    if (p > puntaje) {
      puntaje = p;
      mejor = v;
    }
  });
  return mejor;
}

/** Busca un cambio con el banco que acerque al bot a su próxima construcción. */
export function cambioBanco(
  s: { manos?: Record<string, Recursos> },
  mapa: Mapa,
  geo: Geometria,
  j: EstadoJuego,
  uid: string,
): { da: Recurso; recibe: Recurso } | null {
  const mano = manoDeBot(s.manos, uid);
  const piezas = contarPiezas(j, uid);
  const objetivos: Partial<Recursos>[] = [];
  if (piezas.ciudad < LIMITE.ciudad) objetivos.push(COSTO.ciudad);
  if (piezas.poblado < LIMITE.poblado) objetivos.push(COSTO.poblado);
  if (j.mazo.length > 0) objetivos.push(COSTO_CARTA);

  const tasas = tasasDe(mapa, geo, j, uid);
  for (const obj of objetivos) {
    const falta = RECURSOS.filter((r) => mano[r] < (obj[r] ?? 0));
    if (falta.length === 0) continue;
    const recibe = [...falta].sort((a, b) => mano[a] - mano[b])[0];
    let da: Recurso | null = null;
    let sobraMax = 0;
    RECURSOS.forEach((r) => {
      if (r === recibe) return;
      const tasa = tasas[r];
      if (mano[r] < tasa) return;
      const sobra = mano[r] - (obj[r] ?? 0) - tasa;
      if (sobra >= 0 && sobra >= sobraMax) {
        sobraMax = sobra;
        da = r;
      }
    });
    if (da) return { da, recibe };
  }
  return null;
}

/** Elige una acción para el bot. Se llama una vez por actualización de estado. */
export function decidirAccion(
  s: { manos?: Record<string, Recursos> },
  mapa: Mapa,
  geo: Geometria,
  j: EstadoJuego,
  uid: string,
  acciones: number,
): AccionBot {
  const mano = manoDeBot(s.manos, uid);
  const piezas = contarPiezas(j, uid);

  if (acciones >= 8) return { tipo: 'terminar' };

  if (piezas.ciudad < LIMITE.ciudad && puedePagar(mano, 'ciudad')) {
    const v = ciudadObjetivo(mapa, geo, j, uid);
    if (v) return { tipo: 'construir', pieza: 'ciudad', id: v };
  }

  if (piezas.poblado < LIMITE.poblado && puedePagar(mano, 'poblado')) {
    const v = pobladoNuevo(mapa, geo, j, uid);
    if (v) return { tipo: 'construir', pieza: 'poblado', id: v };
  }

  if (
    piezas.poblado < LIMITE.poblado &&
    piezas.camino < LIMITE.camino &&
    puedePagar(mano, 'camino')
  ) {
    const e = caminoNuevo(mapa, geo, j, uid);
    if (e) return { tipo: 'construir', pieza: 'camino', id: e };
  }

  if (j.mazo.length > 0 && totalCartas(mano) >= 5 && tiene(mano, COSTO_CARTA)) {
    return { tipo: 'comprar' };
  }

  const cambio = cambioBanco(s, mapa, geo, j, uid);
  if (cambio) return { tipo: 'banco', da: cambio.da, recibe: cambio.recibe };

  return { tipo: 'terminar' };
}

/** Selecciona qué cartas descartar (las más abundantes primero). */
export function elegirDescarte(mano: Recursos, n: number): Partial<Recursos> {
  const copia: Recursos = { ...mano };
  const sel: Partial<Recursos> = {};
  let faltan = n;
  while (faltan > 0) {
    const orden = [...RECURSOS].sort((a, b) => copia[b] - copia[a]);
    const r = orden[0];
    if (!r || copia[r] <= 0) break;
    copia[r] -= 1;
    sel[r] = (sel[r] ?? 0) + 1;
    faltan -= 1;
  }
  return sel;
}

/** Hexágono al que conviene mover al cachalote. */
export function elegirHexLadron(
  mapa: Mapa,
  geo: Geometria,
  j: EstadoJuego,
  uid: string,
  azar: () => number = Math.random,
): string | null {
  const opciones = mapa.hexes.filter((h) => h.r + ',' + h.c !== j.ladron);
  if (opciones.length === 0) return null;
  let mejor = '';
  let puntaje = -Infinity;
  opciones.forEach((h) => {
    const clave = h.r + ',' + h.c;
    let p = (PESO[h.num] ?? 0) * 0.1;
    Object.entries(j.poblados).forEach(([v, pieza]) => {
      if (!(geo.vertices[v]?.hexes ?? []).some(([r, c]) => r === h.r && c === h.c)) return;
      const peso = PESO[h.num] ?? 0;
      if (pieza.uid === uid) p -= peso * 2;
      else p += peso * (pieza.tipo === 'ciudad' ? 2 : 1);
    });
    if (p > puntaje) {
      puntaje = p;
      mejor = clave;
    }
  });
  if (!mejor) {
    const h = opciones[Math.floor(azar() * opciones.length)];
    return h.r + ',' + h.c;
  }
  return mejor;
}

/** Víctima a la que robar: la que tenga más cartas. */
export function elegirVictima(
  manos: Record<string, Recursos> | undefined,
  j: EstadoJuego,
  uid: string,
): string | null {
  const victimas = j.victimas.filter((v) => v !== uid);
  if (victimas.length === 0) return null;
  return victimas.sort((a, b) => totalCartas(manoDeBot(manos, b)) - totalCartas(manoDeBot(manos, a)))[0];
}
