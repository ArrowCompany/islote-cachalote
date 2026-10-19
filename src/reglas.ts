import { geometriaDe, mapaDe } from './tablero';
import type { Geometria, Mapa } from './tablero';

export type Recurso = 'wood' | 'brick' | 'wool' | 'grain' | 'ore';
export const RECURSOS: Recurso[] = ['wood', 'brick', 'wool', 'grain', 'ore'];
export const NOMBRE_RECURSO: Record<Recurso, string> = { wood: 'Madera', brick: 'Ladrillo', wool: 'Lana', grain: 'Trigo', ore: 'Mineral' };
export type Recursos = Record<Recurso, number>;
export const manoVacia = (): Recursos => ({ wood: 0, brick: 0, wool: 0, grain: 0, ore: 0 });
export const totalCartas = (m: Recursos) => RECURSOS.reduce((t, r) => t + (m[r] ?? 0), 0);

export type Pieza = { uid: string; tipo: 'poblado' | 'ciudad' };
export type Estadisticas = { cartas: number; desarrollo: number; caballeros: number; puntos: number };
export type Fase = 'orden' | 'colocacion' | 'tirar' | 'accion';

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
};

export type SalaJuego = {
  partida?: { modo: 'p' | 'g'; semilla: number };
  juego?: EstadoJuego;
  manos?: Record<string, Recursos>;
  jugadores?: Record<string, { nombre: string }>;
};

type Dado = () => number;
type Azar = () => number;
export const dadoAzar: Dado = () => 1 + Math.floor(Math.random() * 6);

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
  };
}

export function completar(j: EstadoJuego): EstadoJuego {
  return {
    ...j,
    grupos: j.grupos ?? [j.orden],
    tiradasOrden: j.tiradasOrden ?? {},
    poblados: j.poblados ?? {},
    caminos: j.caminos ?? {},
    stats: j.stats ?? {},
    rondaOrden: j.rondaOrden ?? 0,
    paso: j.paso ?? 0,
    subpaso: j.subpaso ?? 'poblado',
  };
}

type Contexto = { s: SalaJuego; j: EstadoJuego; mapa: Mapa; geo: Geometria };

function contexto(s: SalaJuego): Contexto | null {
  if (!s.juego || !s.partida) return null;
  s.juego = completar(s.juego);
  s.manos = s.manos ?? {};
  const mapa = mapaDe(s.partida.modo, s.partida.semilla);
  const geo = geometriaDe(s.partida.modo, s.partida.semilla);
  return { s, j: s.juego, mapa, geo };
}

const nombreDe = (s: SalaJuego, uid: string) => s.jugadores?.[uid]?.nombre ?? 'Jugador';

export function jugadorActual(j: EstadoJuego): string {
  const n = j.orden.length;
  if (j.fase === 'colocacion') return j.paso < n ? j.orden[j.paso] : j.orden[2 * n - 1 - j.paso];
  if (j.fase === 'tirar' || j.fase === 'accion') return j.orden[j.turno];
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
  recalcularPuntos(j);
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

export function recalcularPuntos(j: EstadoJuego) {
  Object.keys(j.stats).forEach((uid) => {
    const c = contarPiezas(j, uid);
    j.stats[uid].puntos = c.poblado + c.ciudad * 2;
  });
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
  if (j.fase !== 'accion' || j.numTurno !== numTurno || jugadorActual(j) !== uid) return false;
  const mano = { ...manoVacia(), ...(s.manos![uid] ?? {}) };
  if (!puedePagar(mano, tipo)) return false;
  const c = contarPiezas(j, uid);
  const hay = tipo === 'ciudad' ? c.ciudad : c[tipo];
  if (hay >= LIMITE[tipo]) return false;
  if (!lugaresPara(geo, j, uid, tipo).includes(id)) return false;
  RECURSOS.forEach((r) => {
    mano[r] -= COSTO[tipo][r] ?? 0;
  });
  s.manos![uid] = mano;
  j.stats[uid].cartas = totalCartas(mano);
  if (tipo === 'camino') j.caminos[id] = uid;
  else j.poblados[id] = { uid, tipo };
  recalcularPuntos(j);
  const que = tipo === 'camino' ? 'un camino' : tipo === 'poblado' ? 'un poblado' : 'una ciudad';
  j.aviso = nombreDe(s, uid) + ' construyó ' + que;
  return true;
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

function tirarYRepartir(ctx: Contexto, dado: Dado) {
  const { s, j } = ctx;
  const d: [number, number] = [dado(), dado()];
  j.dados = d;
  j.quien = jugadorActual(j);
  j.tirada += 1;
  j.fase = 'accion';
  const suma = d[0] + d[1];
  if (suma === 7) {
    j.aviso = 'Salió 7: el cachalote se moverá (próximamente)';
    return;
  }
  const prod = produccion(ctx.mapa, ctx.geo, j.poblados, suma, j.ladron);
  const partes: string[] = [];
  Object.entries(prod).forEach(([uid, gana]) => {
    darRecursos(ctx, uid, gana);
    partes.push(nombreDe(s, uid) + ' +' + totalCartas(gana));
  });
  j.aviso = partes.length ? 'Salió ' + suma + ': ' + partes.join(', ') : 'Salió ' + suma + ': nadie recibe recursos';
}

function avanzarTurno(j: EstadoJuego, ahora: number) {
  j.turno = (j.turno + 1) % j.orden.length;
  j.fase = 'tirar';
  j.aviso = '';
  reiniciarReloj(j, ahora);
}

export function tirarPrincipal(s: SalaJuego, uid: string, numTurno: number, dado: Dado = dadoAzar): boolean {
  const ctx = contexto(s);
  if (!ctx) return false;
  const { j } = ctx;
  if (j.fase !== 'tirar' || j.numTurno !== numTurno || jugadorActual(j) !== uid) return false;
  tirarYRepartir(ctx, dado);
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
  if (j.fase === 'tirar') tirarYRepartir(ctx, dado);
  avanzarTurno(j, ahora);
  return true;
}
