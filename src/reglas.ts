import { geometriaDe, mapaDe, verticesPuerto } from './tablero';
import type { Geometria, Mapa, Modo } from './tablero';

export type Recurso = 'wood' | 'brick' | 'wool' | 'grain' | 'ore';
export const RECURSOS: Recurso[] = ['wood', 'brick', 'wool', 'grain', 'ore'];
export const NOMBRE_RECURSO: Record<Recurso, string> = { wood: 'Madera', brick: 'Ladrillo', wool: 'Lana', grain: 'Trigo', ore: 'Mineral' };
export type Recursos = Record<Recurso, number>;
export const manoVacia = (): Recursos => ({ wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 });
export const totalCartas = (m: Recursos) => RECURSOS.reduce((t, r) => t + (m[r] ?? 0), 0);

export type Pieza = { uid: string; tipo: 'poblado' | 'ciudad' };
export type Estadisticas = { cartas: number; desarrollo: number; caballeros: number; puntos: number };
export type Fase = 'orden' | 'colocacion' | 'tirar' | 'accion' | 'descartar' | 'mover' | 'robar' | 'fin';

export type TipoCarta = 'caballero' | 'punto' | 'caminos' | 'abundancia' | 'monopolio';
export const NOMBRE_CARTA: Record<TipoCarta, string> = {
  caballero: 'Caballero',
  punto: 'Punto de victoria',
  caminos: 'Construcción de caminos',
  abundancia: 'Año de la abundancia',
  monopolio: 'Monopolio',
};
export const DESCRIPCION_CARTA: Record<TipoCarta, string> = {
  caballero: 'Mueve al cachalote y roba una carta a un jugador que tenga un poblado o ciudad en ese hexágono.',
  punto: 'Vale 1 punto de victoria. Se queda oculta hasta que ganes.',
  caminos: 'Construyes 2 caminos gratis.',
  abundancia: 'Tomas 2 recursos cualesquiera del banco.',
  monopolio: 'Eliges un recurso y todos los demás jugadores te entregan todas sus cartas de ese recurso.',
};
export const COSTO_CARTA: Partial<Recursos> = { wool: 1, grain: 1, ore: 1 };
export type CartaDes = { id: number; tipo: TipoCarta; turno: number };

export type Oferta = { id: number; de: string; da: Partial<Recursos>; pide: Partial<Recursos>; rechazos: Record<string, boolean> };

export type EstadoJuego = {
  fase: Fase;
  orden: string[];
  turno: number;
  numTurno: number;
  inicioTurno: number;
  tirada: number;
  dados?: [number, number];
  quien?: string;
  aviso?: string;
  stats: Record<string, Estadisticas>;
  grupos: string[][];
  tiradasOrden: Record<string, [number, number]>;
  rondaOrden: number;
  paso: number;
  subpaso: 'poblado' | 'camino';
  ultimoPoblado?: string;
  poblados: Record<string, Pieza>;
  caminos: Record<string, string>;
  ladron: string;
  oferta?: Oferta;
  contadorOfertas?: number;
  bloqueos?: Record<string, boolean>;
  mazo: TipoCarta[];
  descartes: Record<string, number>;
  victimas: string[];
  retorno: 'tirar' | 'accion';
  rondaTurno: number;
  jugoCarta: boolean;
  caminosGratis: number;
  contadorCartas: number;
  ejercito?: { uid: string; n: number };
  camino?: { uid: string; largo: number };
  ganador?: string;
};

export type SalaJuego = {
  partida?: { modo: Modo; semilla: number };
  juego?: EstadoJuego;
  manos?: Record<string, Recursos>;
  cartas?: Record<string, CartaDes[]>;
  jugadores?: Record<string, { nombre: string }>;
};

type Dado = () => number;
type Azar = () => number;
export const dadoAzar: Dado = () => 1 + Math.floor(Math.random() * 6);

export function crearMazo(jugadores: number, azar: Azar = Math.random): TipoCarta[] {
  const grande = jugadores >= 5;
  const cuentas: [TipoCarta, number][] = [
    ['caballero', grande ? 20 : 14],
    ['punto', 5],
    ['caminos', grande ? 3 : 2],
    ['abundancia', grande ? 3 : 2],
    ['monopolio', grande ? 3 : 2],
  ];
  const m: TipoCarta[] = [];
  cuentas.forEach(([t, n]) => {
    for (let i = 0; i < n; i++) m.push(t);
  });
  for (let i = m.length - 1; i > 0; i--) {
    const k = Math.floor(azar() * (i + 1));
    [m[i], m[k]] = [m[k], m[i]];
  }
  return m;
}

export function crearEstadoJuego(jugadores: { uid: string; nombre: string }[], ladron: string, ahora: number): EstadoJuego {
  const ordenados = [...jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  const orden = ordenados.map((j) => j.uid);
  const stats: Record<string, Estadisticas> = {};
  orden.forEach((u) => {
    stats[u] = { cartas: 0, desarrollo: 0, caballeros: 0, puntos: 0 };
  });
  return {
    fase: 'orden',
    orden,
    turno: 0,
    numTurno: 0,
    inicioTurno: ahora,
    tirada: 0,
    stats,
    grupos: [orden],
    tiradasOrden: {},
    rondaOrden: 0,
    paso: 0,
    subpaso: 'poblado',
    poblados: {},
    caminos: {},
    ladron,
    mazo: crearMazo(orden.length),
    descartes: {},
    victimas: [],
    retorno: 'accion',
    rondaTurno: 0,
    jugoCarta: false,
    caminosGratis: 0,
    contadorCartas: 0,
  };
}

export function completar(j: EstadoJuego): EstadoJuego {
  const sinOferta = !j.oferta;
  const base: EstadoJuego = {
    ...j,
    grupos: j.grupos ?? [j.orden],
    tiradasOrden: j.tiradasOrden ?? {},
    poblados: j.poblados ?? {},
    caminos: j.caminos ?? {},
    stats: j.stats ?? {},
    rondaOrden: j.rondaOrden ?? 0,
    paso: j.paso ?? 0,
    subpaso: j.subpaso ?? 'poblado',
    bloqueos: j.bloqueos ?? {},
    mazo: j.mazo ?? [],
    descartes: j.descartes ?? {},
    victimas: j.victimas ?? [],
    retorno: j.retorno ?? 'accion',
    rondaTurno: j.rondaTurno ?? 0,
    jugoCarta: j.jugoCarta ?? false,
    caminosGratis: j.caminosGratis ?? 0,
    contadorCartas: j.contadorCartas ?? 0,
  };
  if (!sinOferta && base.oferta) base.oferta = { ...base.oferta, da: base.oferta.da ?? {}, pide: base.oferta.pide ?? {}, rechazos: base.oferta.rechazos ?? {} };
  return base;
}

type Contexto = { s: SalaJuego; j: EstadoJuego; mapa: Mapa; geo: Geometria };

function contexto(s: SalaJuego): Contexto | null {
  if (!s.juego || !s.partida) return null;
  s.juego = completar(s.juego);
  s.manos = s.manos ?? {};
  s.cartas = s.cartas ?? {};
  const mapa = mapaDe(s.partida.modo, s.partida.semilla);
  const geo = geometriaDe(s.partida.modo, s.partida.semilla);
  return { s, j: s.juego, mapa, geo };
}

const nombreDe = (s: SalaJuego, uid: string) => s.jugadores?.[uid]?.nombre ?? 'Jugador';

export function jugadorActual(j: EstadoJuego): string {
  const n = j.orden.length;
  if (j.fase === 'colocacion') return j.paso < n ? j.orden[j.paso] : j.orden[2 * n - 1 - j.paso];
  if (j.fase === 'tirar' || j.fase === 'accion' || j.fase === 'mover' || j.fase === 'robar') return j.orden[j.turno];
  return '';
}

export function pendientesOrden(j: EstadoJuego): string[] {
  return j.grupos.filter((g) => g.length > 1).flat();
}

export function verticesLibres(geo: Geometria, poblados: Record<string, Pieza>): string[] {
  return geo.listaV.filter((v) => !poblados[v.id] && v.vecinos.every((n) => !poblados[n])).map((v) => v.id);
}

export function caminosDePoblado(geo: Geometria, caminos: Record<string, string>, v: string): string[] {
  return (geo.vertices[v]?.aristas ?? []).filter((e) => !caminos[e]);
}

export function recursosDeVertice(mapa: Mapa, geo: Geometria, v: string): Recursos {
  const m = manoVacia();
  (geo.vertices[v]?.hexes ?? []).forEach(([r, c]) => {
    const h = mapa.hexes.find((x) => x.r === r && x.c === c);
    if (h && h.tipo !== 'desert') m[h.tipo as Recurso] += 1;
  });
  return m;
}

export function produccion(mapa: Mapa, geo: Geometria, poblados: Record<string, Pieza>, suma: number, ladron: string): Record<string, Recursos> {
  const res: Record<string, Recursos> = {};
  Object.entries(poblados).forEach(([v, p]) => {
    (geo.vertices[v]?.hexes ?? []).forEach(([r, c]) => {
      const h = mapa.hexes.find((x) => x.r === r && x.c === c);
      if (!h || h.tipo === 'desert' || h.num !== suma || r + ',' + c === ladron) return;
      res[p.uid] = res[p.uid] ?? manoVacia();
      res[p.uid][h.tipo as Recurso] += p.tipo === 'ciudad' ? 2 : 1;
    });
  });
  return res;
}

function darRecursos(ctx: Contexto, uid: string, gana: Recursos) {
  const m = { ...manoVacia(), ...(ctx.s.manos![uid] ?? {}) };
  RECURSOS.forEach((r) => {
    m[r] += gana[r];
  });
  ctx.s.manos![uid] = m;
  if (ctx.j.stats[uid]) ctx.j.stats[uid].cartas = totalCartas(m);
}

function reiniciarReloj(j: EstadoJuego, ahora: number) {
  j.numTurno += 1;
  j.inicioTurno = ahora;
}

function tirarOrden(j: EstadoJuego, uid: string, dado: Dado) {
  const d: [number, number] = [dado(), dado()];
  j.tiradasOrden[uid] = d;
  j.dados = d;
  j.quien = uid;
  j.tirada += 1;
}

function cerrarRonda(ctx: Contexto, ahora: number) {
  const { s, j } = ctx;
  if (!pendientesOrden(j).every((p) => j.tiradasOrden[p])) return;
  const nuevos: string[][] = [];
  j.grupos.forEach((g) => {
    if (g.length === 1) {
      nuevos.push(g);
      return;
    }
    const porSuma = new Map<number, string[]>();
    g.forEach((u) => {
      const [a, b] = j.tiradasOrden[u];
      porSuma.set(a + b, [...(porSuma.get(a + b) ?? []), u]);
    });
    [...porSuma.entries()].sort((x, y) => y[0] - x[0]).forEach(([, us]) => nuevos.push(us));
  });
  j.grupos = nuevos;
  if (nuevos.every((g) => g.length === 1)) {
    j.orden = nuevos.map((g) => g[0]);
    j.fase = 'colocacion';
    j.paso = 0;
    j.subpaso = 'poblado';
    j.turno = 0;
    j.aviso = 'Orden de juego: ' + j.orden.map((u, i) => i + 1 + '. ' + nombreDe(s, u)).join(', ');
  } else {
    const empatados = nuevos.filter((g) => g.length > 1).flat();
    empatados.forEach((u) => {
      delete j.tiradasOrden[u];
    });
    j.rondaOrden += 1;
    j.aviso = 'Empate entre ' + empatados.map((u) => nombreDe(s, u)).join(', ') + ': vuelvan a lanzar los dados';
  }
  reiniciarReloj(j, ahora);
}

export function lanzarOrden(s: SalaJuego, uid: string, numTurno: number, ahora: number, dado: Dado = dadoAzar): boolean {
  const ctx = contexto(s);
  if (!ctx || ctx.j.fase !== 'orden' || ctx.j.numTurno !== numTurno) return false;
  if (!pendientesOrden(ctx.j).includes(uid) || ctx.j.tiradasOrden[uid]) return false;
  tirarOrden(ctx.j, uid, dado);
  cerrarRonda(ctx, ahora);
  return true;
}

function avanzarColocacion(ctx: Contexto, ahora: number) {
  const { s, j } = ctx;
  j.paso += 1;
  if (j.paso >= j.orden.length * 2) {
    j.fase = 'tirar';
    j.turno = 0;
    j.aviso = '¡Empieza la partida! ' + nombreDe(s, j.orden[0]) + ' lanza primero';
  } else {
    j.subpaso = 'poblado';
  }
  reiniciarReloj(j, ahora);
}

function ponerPoblado(ctx: Contexto, uid: string, v: string) {
  const { j } = ctx;
  j.poblados[v] = { uid, tipo: 'poblado' };
  j.ultimoPoblado = v;
  j.subpaso = 'camino';
  recalcularPuntos(j, ctx.geo);
  if (j.paso >= j.orden.length) darRecursos(ctx, uid, recursosDeVertice(ctx.mapa, ctx.geo, v));
}

function ponerCamino(ctx: Contexto, uid: string, e: string, ahora: number) {
  ctx.j.caminos[e] = uid;
  delete ctx.j.ultimoPoblado;
  avanzarColocacion(ctx, ahora);
}

export function colocarPoblado(s: SalaJuego, uid: string, numTurno: number, v: string): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j, geo } = ctx;
  if (j.fase !== 'colocacion' || j.numTurno !== numTurno || j.subpaso !== 'poblado' || jugadorActual(j) !== uid) return false;
  if (!verticesLibres(geo, j.poblados).includes(v)) return false;
  ponerPoblado(ctx, uid, v);
  return true;
}

export function colocarCamino(s: SalaJuego, uid: string, numTurno: number, e: string, ahora: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j, geo } = ctx;
  if (j.fase !== 'colocacion' || j.numTurno !== numTurno || j.subpaso !== 'camino' || jugadorActual(j) !== uid) return false;
  if (!j.ultimoPoblado || !caminosDePoblado(geo, j.caminos, j.ultimoPoblado).includes(e)) return false;
  ponerCamino(ctx, uid, e, ahora);
  return true;
}


export type TipoPieza = 'camino' | 'poblado' | 'ciudad';
export const COSTO: Record<TipoPieza, Partial<Recursos>> = {
  camino: { wood: 1, brick: 1 },
  poblado: { wood: 1, brick: 1, wool: 1, grain: 1 },
  ciudad: { grain: 2, ore: 3 },
};
export const LIMITE: Record<TipoPieza, number> = { camino: 15, poblado: 5, ciudad: 4 };

export function puedePagar(mano: Recursos, tipo: TipoPieza): boolean {
  return RECURSOS.every((r) => (mano[r] ?? 0) >= (COSTO[tipo][r] ?? 0));
}

export function contarPiezas(j: EstadoJuego, uid: string): Record<TipoPieza, number> {
  const c: Record<TipoPieza, number> = { camino: 0, poblado: 0, ciudad: 0 };
  Object.values(j.caminos).forEach((d) => {
    if (d === uid) c.camino += 1;
  });
  Object.values(j.poblados).forEach((p) => {
    if (p.uid === uid) c[p.tipo] += 1;
  });
  return c;
}

export function largoCamino(geo: Geometria, j: EstadoJuego, uid: string): number {
  const porVertice = new Map<string, string[]>();
  geo.listaA.forEach((a) => {
    if (j.caminos[a.id] !== uid) return;
    [a.a, a.b].forEach((v) => porVertice.set(v, [...(porVertice.get(v) ?? []), a.id]));
  });
  if (porVertice.size === 0) return 0;
  const bloqueado = (v: string) => {
    const p = j.poblados[v];
    return !!p && p.uid !== uid;
  };
  let mejor = 0;
  const dfs = (v: string, usadas: Set<string>, largo: number, inicio: boolean) => {
    if (largo > mejor) mejor = largo;
    if (!inicio && bloqueado(v)) return;
    (porVertice.get(v) ?? []).forEach((e) => {
      if (usadas.has(e)) return;
      const ar = geo.aristas[e];
      usadas.add(e);
      dfs(ar.a === v ? ar.b : ar.a, usadas, largo + 1, false);
      usadas.delete(e);
    });
  };
  porVertice.forEach((_, v) => dfs(v, new Set<string>(), 0, true));
  return mejor;
}

function actualizarCaminoLargo(j: EstadoJuego, geo: Geometria) {
  const largos: Record<string, number> = {};
  j.orden.forEach((u) => {
    largos[u] = largoCamino(geo, j, u);
  });
  const max = Math.max(0, ...Object.values(largos));
  const previo = j.camino?.uid;
  let nuevo: string | undefined;
  if (max >= 5) {
    const cand = j.orden.filter((u) => largos[u] === max);
    if (previo && cand.includes(previo)) nuevo = previo;
    else if (cand.length === 1) nuevo = cand[0];
  }
  if (nuevo) j.camino = { uid: nuevo, largo: max };
  else delete j.camino;
}

export function puntosPublicos(j: EstadoJuego, uid: string): number {
  const c = contarPiezas(j, uid);
  return c.poblado + c.ciudad * 2 + (j.camino?.uid === uid ? 2 : 0) + (j.ejercito?.uid === uid ? 2 : 0);
}

export function recalcularPuntos(j: EstadoJuego, geo?: Geometria) {
  if (geo) actualizarCaminoLargo(j, geo);
  Object.keys(j.stats).forEach((uid) => {
    j.stats[uid].puntos = puntosPublicos(j, uid);
  });
}

export function puntosTotales(s: SalaJuego, j: EstadoJuego, uid: string): number {
  return puntosPublicos(j, uid) + (s.cartas?.[uid] ?? []).filter((c) => c.tipo === 'punto').length;
}

function revisarVictoria(s: SalaJuego, j: EstadoJuego) {
  if (j.fase === 'fin') return;
  const u = j.orden[j.turno];
  if (u && puntosTotales(s, j, u) >= 10) {
    j.ganador = u;
    j.fase = 'fin';
    j.aviso = '🏆 ¡' + nombreDe(s, u) + ' ganó la partida!';
  }
}

function caminoPropioEn(geo: Geometria, caminos: Record<string, string>, uid: string, v: string): boolean {
  return (geo.vertices[v]?.aristas ?? []).some((e) => caminos[e] === uid);
}

export function verticesPoblado(geo: Geometria, j: EstadoJuego, uid: string): string[] {
  return verticesLibres(geo, j.poblados).filter((v) => caminoPropioEn(geo, j.caminos, uid, v));
}

export function verticesCiudad(j: EstadoJuego, uid: string): string[] {
  return Object.entries(j.poblados).filter(([, p]) => p.uid === uid && p.tipo === 'poblado').map(([v]) => v);
}

export function caminosDisponibles(geo: Geometria, j: EstadoJuego, uid: string): string[] {
  const conecta = (v: string) => {
    const p = j.poblados[v];
    if (p) return p.uid === uid;
    return caminoPropioEn(geo, j.caminos, uid, v);
  };
  return geo.listaA.filter((a) => !j.caminos[a.id] && (conecta(a.a) || conecta(a.b))).map((a) => a.id);
}

export function lugaresPara(geo: Geometria, j: EstadoJuego, uid: string, tipo: TipoPieza): string[] {
  if (tipo === 'camino') return caminosDisponibles(geo, j, uid);
  if (tipo === 'poblado') return verticesPoblado(geo, j, uid);
  return verticesCiudad(j, uid);
}

export function construir(s: SalaJuego, uid: string, numTurno: number, tipo: TipoPieza, id: string): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j, geo } = ctx;
  const gratis = tipo === 'camino' && j.caminosGratis > 0 && (j.fase === 'tirar' || j.fase === 'accion');
  if ((!gratis && j.fase !== 'accion') || j.numTurno !== numTurno || jugadorActual(j) !== uid) return false;
  const mano = { ...manoVacia(), ...(s.manos![uid] ?? {}) };
  if (!gratis && !puedePagar(mano, tipo)) return false;
  const c = contarPiezas(j, uid);
  const hay = tipo === 'ciudad' ? c.ciudad : c[tipo];
  if (hay >= LIMITE[tipo]) return false;
  if (!lugaresPara(geo, j, uid, tipo).includes(id)) return false;
  if (!gratis) {
    RECURSOS.forEach((r) => {
      mano[r] -= COSTO[tipo][r] ?? 0;
    });
    s.manos![uid] = mano;
    j.stats[uid].cartas = totalCartas(mano);
  }
  if (tipo === 'camino') j.caminos[id] = uid;
  else j.poblados[id] = { uid, tipo };
  if (gratis) {
    j.caminosGratis -= 1;
    if (j.caminosGratis > 0 && (c.camino + 1 >= LIMITE.camino || caminosDisponibles(geo, j, uid).length === 0)) j.caminosGratis = 0;
  }
  recalcularPuntos(j, geo);
  const que = tipo === 'camino' ? 'un camino' : tipo === 'poblado' ? 'un poblado' : 'una ciudad';
  j.aviso = nombreDe(s, uid) + ' construyó ' + que + (gratis ? ' gratis' : '');
  revisarVictoria(s, j);
  return true;
}


export function tasasDe(mapa: Mapa, geo: Geometria, j: EstadoJuego, uid: string): Record<Recurso, number> {
  const t: Record<Recurso, number> = { wood: 4, brick: 4, wool: 4, grain: 4, ore: 4 };
  mapa.puertos.forEach((pu) => {
    if (!verticesPuerto(mapa, geo, pu).some((v) => j.poblados[v]?.uid === uid)) return;
    if (pu.tipo === '3') {
      RECURSOS.forEach((r) => {
        t[r] = Math.min(t[r], 3);
      });
    } else {
      t[pu.tipo as Recurso] = 2;
    }
  });
  return t;
}

function manoDe(s: SalaJuego, uid: string): Recursos {
  return { ...manoVacia(), ...(s.manos![uid] ?? {}) };
}

function guardarMano(ctx: Contexto, uid: string, m: Recursos) {
  ctx.s.manos![uid] = m;
  if (ctx.j.stats[uid]) ctx.j.stats[uid].cartas = totalCartas(m);
}

export function cambiarBanco(s: SalaJuego, uid: string, numTurno: number, da: Recurso, recibe: Recurso): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'accion' || j.numTurno !== numTurno || jugadorActual(j) !== uid || da === recibe) return false;
  const tasa = tasasDe(ctx.mapa, ctx.geo, j, uid)[da];
  const m = manoDe(s, uid);
  if (m[da] < tasa) return false;
  m[da] -= tasa;
  m[recibe] += 1;
  guardarMano(ctx, uid, m);
  j.aviso = nombreDe(s, uid) + ' cambió ' + tasa + ' ' + NOMBRE_RECURSO[da] + ' por 1 ' + NOMBRE_RECURSO[recibe] + ' con el banco';
  return true;
}

function limpiar(x: Partial<Recursos>): Partial<Recursos> {
  const o: Partial<Recursos> = {};
  RECURSOS.forEach((r) => {
    const n = Math.floor(x[r] ?? 0);
    if (n > 0) o[r] = Math.min(n, 19);
  });
  return o;
}

const tiene = (m: Recursos, c: Partial<Recursos>) => RECURSOS.every((r) => m[r] >= (c[r] ?? 0));
const cuantas = (c: Partial<Recursos>) => RECURSOS.reduce((t, r) => t + (c[r] ?? 0), 0);
const detalle = (c: Partial<Recursos>) => RECURSOS.filter((r) => c[r]).map((r) => c[r] + ' ' + NOMBRE_RECURSO[r]).join(', ');

export function crearOferta(s: SalaJuego, uid: string, numTurno: number, da: Partial<Recursos>, pide: Partial<Recursos>): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'accion' || j.numTurno !== numTurno || jugadorActual(j) !== uid) return false;
  const d = limpiar(da), p = limpiar(pide);
  if (cuantas(d) === 0 || cuantas(p) === 0) return false;
  if (RECURSOS.some((r) => d[r] && p[r])) return false;
  if (!tiene(manoDe(s, uid), d)) return false;
  const rechazos: Record<string, boolean> = {};
  j.orden.forEach((u) => {
    if (u !== uid && j.bloqueos?.[u]) rechazos[u] = true;
  });
  if (j.orden.filter((u) => u !== uid).every((u) => rechazos[u])) return false;
  j.contadorOfertas = (j.contadorOfertas ?? 0) + 1;
  j.oferta = { id: j.contadorOfertas, de: uid, da: d, pide: p, rechazos };
  j.aviso = nombreDe(s, uid) + ' ofrece ' + detalle(d) + ' por ' + detalle(p);
  return true;
}

export function aceptarOferta(s: SalaJuego, uid: string, id: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  const o = j.oferta;
  if (!o || o.id !== id || o.de === uid || o.rechazos[uid] || !j.orden.includes(uid) || j.fase !== 'accion') return false;
  const mDe = manoDe(s, o.de), mA = manoDe(s, uid);
  if (!tiene(mDe, o.da) || !tiene(mA, o.pide)) return false;
  RECURSOS.forEach((r) => {
    mDe[r] += (o.pide[r] ?? 0) - (o.da[r] ?? 0);
    mA[r] += (o.da[r] ?? 0) - (o.pide[r] ?? 0);
  });
  guardarMano(ctx, o.de, mDe);
  guardarMano(ctx, uid, mA);
  j.aviso = nombreDe(s, uid) + ' aceptó el cambio de ' + nombreDe(s, o.de) + ': ' + detalle(o.da) + ' por ' + detalle(o.pide);
  delete j.oferta;
  return true;
}

export function rechazarOferta(s: SalaJuego, uid: string, id: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  const o = j.oferta;
  if (!o || o.id !== id || o.de === uid || !j.orden.includes(uid)) return false;
  o.rechazos[uid] = true;
  if (j.orden.filter((u) => u !== o.de).every((u) => o.rechazos[u])) {
    j.aviso = 'Nadie aceptó el cambio de ' + nombreDe(s, o.de);
    delete j.oferta;
  }
  return true;
}

export function fijarBloqueo(s: SalaJuego, uid: string, valor: boolean): boolean {
  const ctx = contexto(s);
  if (!ctx || !ctx.j.orden.includes(uid)) return false;
  const j = ctx.j;
  j.bloqueos = j.bloqueos ?? {};
  if (valor) j.bloqueos[uid] = true;
  else delete j.bloqueos[uid];
  return true;
}

export function cancelarOferta(s: SalaJuego, uid: string, id: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (!j.oferta || j.oferta.id !== id || j.oferta.de !== uid) return false;
  delete j.oferta;
  return true;
}


function cartasDe(s: SalaJuego, uid: string): CartaDes[] {
  return s.cartas![uid] ?? [];
}

function empezarSiete(ctx: Contexto, ahora: number) {
  const { s, j } = ctx;
  j.retorno = 'accion';
  const pend: Record<string, number> = {};
  j.orden.forEach((u) => {
    const t = totalCartas(manoDe(s, u));
    if (t > 7) pend[u] = Math.floor(t / 2);
  });
  j.descartes = pend;
  j.victimas = [];
  if (Object.keys(pend).length > 0) {
    j.fase = 'descartar';
    j.aviso = 'Salió 7: descartan la mitad de sus cartas los que tienen más de 7';
    reiniciarReloj(j, ahora);
  } else {
    j.aviso = 'Salió 7: ' + nombreDe(s, jugadorActual(j) || j.orden[j.turno]) + ' mueve al cachalote';
    pasarAMover(ctx, ahora);
  }
}

function pasarAMover(ctx: Contexto, ahora: number) {
  const { s, j } = ctx;
  j.fase = 'mover';
  j.aviso = nombreDe(s, j.orden[j.turno]) + ' debe mover al cachalote';
  reiniciarReloj(j, ahora);
}

function terminarRobo(ctx: Contexto, ahora: number) {
  const { j } = ctx;
  j.victimas = [];
  j.fase = j.retorno;
  reiniciarReloj(j, ahora);
}

function descartarAlAzar(ctx: Contexto, uid: string, azar: Azar) {
  const n = ctx.j.descartes[uid] ?? 0;
  const m = manoDe(ctx.s, uid);
  for (let i = 0; i < n; i++) {
    const bolsa: Recurso[] = [];
    RECURSOS.forEach((r) => {
      for (let k = 0; k < m[r]; k++) bolsa.push(r);
    });
    if (bolsa.length === 0) break;
    m[elegir(bolsa, azar)] -= 1;
  }
  guardarMano(ctx, uid, m);
}

export function descartar(s: SalaJuego, uid: string, numTurno: number, sel: Partial<Recursos>, ahora: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'descartar' || j.numTurno !== numTurno) return false;
  const n = j.descartes[uid];
  if (!n) return false;
  const d = limpiar(sel);
  const m = manoDe(s, uid);
  if (cuantas(d) !== n || !tiene(m, d)) return false;
  RECURSOS.forEach((r) => {
    m[r] -= d[r] ?? 0;
  });
  guardarMano(ctx, uid, m);
  delete j.descartes[uid];
  if (Object.keys(j.descartes).length === 0) pasarAMover(ctx, ahora);
  return true;
}

function candidatosRobo(ctx: Contexto, uid: string, clave: string): string[] {
  const { s, j, geo } = ctx;
  const out = new Set<string>();
  Object.entries(j.poblados).forEach(([v, p]) => {
    if (p.uid === uid) return;
    if ((geo.vertices[v]?.hexes ?? []).some(([r, c]) => r + ',' + c === clave) && totalCartas(manoDe(s, p.uid)) > 0) out.add(p.uid);
  });
  return [...out];
}

function robarCarta(ctx: Contexto, uid: string, victima: string, azar: Azar) {
  const { s, j } = ctx;
  const mv = manoDe(s, victima);
  const bolsa: Recurso[] = [];
  RECURSOS.forEach((r) => {
    for (let k = 0; k < mv[r]; k++) bolsa.push(r);
  });
  if (bolsa.length === 0) return;
  const r = elegir(bolsa, azar);
  mv[r] -= 1;
  const mu = manoDe(s, uid);
  mu[r] += 1;
  guardarMano(ctx, victima, mv);
  guardarMano(ctx, uid, mu);
  j.aviso = nombreDe(s, uid) + ' le robó una carta a ' + nombreDe(s, victima);
}

function ponerLadron(ctx: Contexto, uid: string, destino: { r: number; c: number } | string, ahora: number, azar: Azar) {
  const { s, j } = ctx;
  const clave = typeof destino === 'string' ? destino : destino.r + ',' + destino.c;
  j.ladron = clave;
  const victimas = candidatosRobo(ctx, uid, clave);
  if (victimas.length === 0) {
    j.aviso = nombreDe(s, uid) + ' movió al cachalote';
    terminarRobo(ctx, ahora);
  } else if (victimas.length === 1) {
    robarCarta(ctx, uid, victimas[0], azar);
    terminarRobo(ctx, ahora);
  } else {
    j.victimas = victimas;
    j.fase = 'robar';
    j.aviso = nombreDe(s, uid) + ' movió al cachalote: elige a quién robar';
    reiniciarReloj(j, ahora);
  }
}

export function moverLadron(s: SalaJuego, uid: string, numTurno: number, clave: string, ahora: number, azar: Azar = Math.random): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j, mapa } = ctx;
  if (j.fase !== 'mover' || j.numTurno !== numTurno || jugadorActual(j) !== uid) return false;
  if (clave === j.ladron || !mapa.hexes.some((h) => h.r + ',' + h.c === clave)) return false;
  ponerLadron(ctx, uid, clave, ahora, azar);
  return true;
}

export function robarA(s: SalaJuego, uid: string, numTurno: number, victima: string, ahora: number, azar: Azar = Math.random): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'robar' || j.numTurno !== numTurno || jugadorActual(j) !== uid || !j.victimas.includes(victima)) return false;
  robarCarta(ctx, uid, victima, azar);
  terminarRobo(ctx, ahora);
  return true;
}

export function comprarCarta(s: SalaJuego, uid: string, numTurno: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'accion' || j.numTurno !== numTurno || jugadorActual(j) !== uid || j.mazo.length === 0) return false;
  const m = manoDe(s, uid);
  if (!tiene(m, COSTO_CARTA)) return false;
  RECURSOS.forEach((r) => {
    m[r] -= COSTO_CARTA[r] ?? 0;
  });
  guardarMano(ctx, uid, m);
  const tipo = j.mazo.pop() as TipoCarta;
  j.contadorCartas += 1;
  const mano = [...cartasDe(s, uid), { id: j.contadorCartas, tipo, turno: j.rondaTurno }];
  s.cartas![uid] = mano;
  j.stats[uid].desarrollo = mano.length;
  j.aviso = nombreDe(s, uid) + ' compró una carta de desarrollo';
  revisarVictoria(s, j);
  return true;
}

export type ParamCarta = { recurso?: Recurso; recursos?: Recurso[] };

export function jugarCarta(s: SalaJuego, uid: string, numTurno: number, idCarta: number, param: ParamCarta, ahora: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if ((j.fase !== 'tirar' && j.fase !== 'accion') || j.numTurno !== numTurno || jugadorActual(j) !== uid || j.jugoCarta) return false;
  const carta = cartasDe(s, uid).find((c) => c.id === idCarta);
  if (!carta || carta.tipo === 'punto' || carta.turno >= j.rondaTurno) return false;
  const quien = nombreDe(s, uid);
  if (carta.tipo === 'monopolio') {
    const rec = param.recurso;
    if (!rec || !RECURSOS.includes(rec)) return false;
    let total = 0;
    j.orden.forEach((u) => {
      if (u === uid) return;
      const mo = manoDe(s, u);
      total += mo[rec];
      mo[rec] = 0;
      guardarMano(ctx, u, mo);
    });
    const mu = manoDe(s, uid);
    mu[rec] += total;
    guardarMano(ctx, uid, mu);
    j.aviso = quien + ' usó Monopolio de ' + NOMBRE_RECURSO[rec] + ' y recibió ' + total;
  } else if (carta.tipo === 'abundancia') {
    const recs = param.recursos;
    if (!recs || recs.length !== 2 || !recs.every((x) => RECURSOS.includes(x))) return false;
    const mu = manoDe(s, uid);
    recs.forEach((x) => {
      mu[x] += 1;
    });
    guardarMano(ctx, uid, mu);
    j.aviso = quien + ' usó Año de la abundancia: ' + NOMBRE_RECURSO[recs[0]] + ' y ' + NOMBRE_RECURSO[recs[1]];
  } else if (carta.tipo === 'caminos') {
    const c = contarPiezas(j, uid);
    if (c.camino >= LIMITE.camino || caminosDisponibles(ctx.geo, j, uid).length === 0) return false;
    j.caminosGratis = Math.min(2, LIMITE.camino - c.camino);
    j.aviso = quien + ' usó Construcción de caminos: coloca 2 caminos gratis';
  } else {
    j.stats[uid].caballeros += 1;
    const n = j.stats[uid].caballeros;
    if (n >= 3 && (!j.ejercito || (j.ejercito.uid !== uid && n > j.ejercito.n) || j.ejercito.uid === uid)) j.ejercito = { uid, n };
    j.retorno = j.fase;
    j.victimas = [];
    j.aviso = quien + ' jugó un Caballero';
  }
  s.cartas![uid] = cartasDe(s, uid).filter((c) => c.id !== idCarta);
  j.stats[uid].desarrollo = s.cartas![uid].length;
  j.jugoCarta = true;
  recalcularPuntos(j, ctx.geo);
  if (carta.tipo === 'caballero') pasarAMoverCaballero(ctx, ahora);
  revisarVictoria(s, j);
  return true;
}

function pasarAMoverCaballero(ctx: Contexto, ahora: number) {
  const { j } = ctx;
  j.fase = 'mover';
  reiniciarReloj(j, ahora);
}

function elegir<T>(lista: T[], azar: Azar): T {
  return lista[Math.floor(azar() * lista.length)];
}

function colocarAlAzar(ctx: Contexto, ahora: number, azar: Azar) {
  const { j, geo } = ctx;
  const uid = jugadorActual(j);
  if (j.subpaso === 'poblado') {
    const libres = verticesLibres(geo, j.poblados);
    if (libres.length === 0) return;
    ponerPoblado(ctx, uid, elegir(libres, azar));
  }
  const v = j.ultimoPoblado;
  if (!v) return;
  const validos = caminosDePoblado(geo, j.caminos, v);
  if (validos.length === 0) return;
  ponerCamino(ctx, uid, elegir(validos, azar), ahora);
}

function tirarYRepartir(ctx: Contexto, dado: Dado, ahora: number) {
  const { s, j } = ctx;
  const d: [number, number] = [dado(), dado()];
  j.dados = d;
  j.quien = jugadorActual(j);
  j.tirada += 1;
  j.fase = 'accion';
  const suma = d[0] + d[1];
  if (suma === 7) {
    empezarSiete(ctx, ahora);
    return;
  }
  const sumas = suma === 2 || suma === 12 ? [2, 12] : [suma];
  const prod: Record<string, Recursos> = {};
  sumas.forEach((sm) => {
    const p = produccion(ctx.mapa, ctx.geo, j.poblados, sm, j.ladron);
    Object.entries(p).forEach(([uid, gana]) => {
      prod[uid] = prod[uid] ?? manoVacia();
      RECURSOS.forEach((r) => { prod[uid][r] += gana[r]; });
    });
  });
  const partes: string[] = [];
  Object.entries(prod).forEach(([uid, gana]) => {
    darRecursos(ctx, uid, gana);
    partes.push(nombreDe(s, uid) + ' +' + totalCartas(gana));
  });
  j.aviso = partes.length ? 'Salió ' + suma + ' (también ' + (suma === 2 ? 12 : 2) + '): ' + partes.join(', ') : 'Salió ' + suma + ': nadie recibe recursos';
  revisarVictoria(s, j);
}

function avanzarTurno(j: EstadoJuego, ahora: number) {
  delete j.oferta;
  j.rondaTurno += 1;
  j.jugoCarta = false;
  j.caminosGratis = 0;
  j.turno = (j.turno + 1) % j.orden.length;
  j.fase = 'tirar';
  j.aviso = '';
  reiniciarReloj(j, ahora);
}

export function tirarPrincipal(s: SalaJuego, uid: string, numTurno: number, dado: Dado = dadoAzar, ahora: number = Date.now()): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'tirar' || j.numTurno !== numTurno || jugadorActual(j) !== uid) return false;
  tirarYRepartir(ctx, dado, ahora);
  return true;
}

export function terminarTurnoEn(s: SalaJuego, uid: string, numTurno: number, ahora: number): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'accion' || j.numTurno !== numTurno || jugadorActual(j) !== uid) return false;
  avanzarTurno(j, ahora);
  return true;
}

export function tiempoAgotadoEn(s: SalaJuego, numTurno: number, ahora: number, dado: Dado = dadoAzar, azar: Azar = Math.random): boolean {
  const ctx = contexto(s);
  if (!ctx || ctx.j.numTurno !== numTurno) return false;
  const { j } = ctx;
  if (j.fase === 'fin') return false;
  if (j.fase === 'orden') {
    pendientesOrden(j).forEach((u) => {
      if (!j.tiradasOrden[u]) tirarOrden(j, u, dado);
    });
    cerrarRonda(ctx, ahora);
    return true;
  }
  if (j.fase === 'colocacion') {
    colocarAlAzar(ctx, ahora, azar);
    return true;
  }
  if (j.fase === 'descartar') {
    Object.keys(j.descartes).forEach((u) => descartarAlAzar(ctx, u, azar));
    j.descartes = {};
    pasarAMover(ctx, ahora);
    return true;
  }
  if (j.fase === 'mover') {
    const uid = jugadorActual(j);
    const opciones = ctx.mapa.hexes.filter((h) => h.r + ',' + h.c !== j.ladron);
    ponerLadron(ctx, uid, elegir(opciones, azar), ahora, azar);
    return true;
  }
  if (j.fase === 'robar') {
    const uid = jugadorActual(j);
    if (j.victimas.length) robarCarta(ctx, uid, elegir(j.victimas, azar), azar);
    terminarRobo(ctx, ahora);
    return true;
  }
  if (j.fase === 'tirar') tirarYRepartir(ctx, dado, ahora);
  if (j.fase === 'accion') avanzarTurno(j, ahora);
  return true;
}
