import { get, onDisconnect, onValue, push, ref, runTransaction, set, update } from 'firebase/database';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';
import { crearEstadoJuego } from './turnos';
import type { EstadoJuego, Recursos } from './turnos';
import { manoVacia, revisarUltimoHumano } from './reglas';
import type { CartaDes } from './reglas';
import { mapaDe } from './tablero';
import type { Modo } from './tablero';

export const COLORES: { id: string; nombre: string; hex: string }[] = [
  { id: 'amarillo', nombre: 'Amarillo', hex: '#FFD21F' },
  { id: 'azul', nombre: 'Azul oscuro', hex: '#1e3a8a' },
  { id: 'rojo', nombre: 'Rojo', hex: '#d62828' },
  { id: 'verde', nombre: 'Verde', hex: '#2e9e44' },
  { id: 'negro', nombre: 'Negro', hex: '#1b1b1b' },
  { id: 'morado', nombre: 'Morado', hex: '#7b2cbf' },
  { id: 'cafe', nombre: 'Café', hex: '#7a4a21' },
  { id: 'naranja', nombre: 'Naranja', hex: '#f77f00' },
];

export type Config = { mapa: 'cachalote' | 'catan'; chat: boolean; reloj: 40 | 60 | 90; cuentaRanking?: boolean };
export type Partida = { modo: Modo; semilla: number };
export type Jugador = { nombre: string; color: string; listo: boolean; orden: number; conectado?: boolean; bot?: boolean };
export type MensajeChat = { uid: string; nombre: string; texto: string; ts: number };
export type Sala = {
  anfitrion: string;
  estado: string;
  creada?: number;
  config?: Config;
  partida?: Partida;
  juego?: EstadoJuego;
  manos?: Record<string, Recursos>;
  cartas?: Record<string, CartaDes[]>;
  jugadores?: Record<string, Jugador>;
  chat?: Record<string, MensajeChat>;
};

export const CONFIG_INICIAL: Config = { mapa: 'cachalote', chat: true, reloj: 60, cuentaRanking: true };

const esUidBot = (uid: string) => uid.startsWith('bot_');
const esBotSala = (js: Record<string, Jugador>, uid: string) => esUidBot(uid) || !!js[uid]?.bot;

/** Agrega bots a la sala y devuelve todos los uids ordenados. */
export async function agregarBots(codigo: string, cantidad: number): Promise<string[]> {
  let uids: string[] = [];
  await runTransaction(ref(db, 'salas/' + codigo), (s: Sala | null) => {
    if (!s) return s;
    const js = s.jugadores ?? {};
    const usados = new Set(Object.values(js).map((j) => j.color));
    let n = 1;
    for (let i = 0; i < cantidad && Object.keys(js).length < 6; i++) {
      let uid = 'bot_' + n;
      while (js[uid]) {
        n += 1;
        uid = 'bot_' + n;
      }
      const color = COLORES.find((c) => !usados.has(c.id))?.id ?? 'negro';
      usados.add(color);
      js[uid] = { nombre: 'Bot ' + n, color, listo: true, orden: Object.keys(js).length, conectado: true, bot: true };
      n += 1;
    }
    s.jugadores = js;
    uids = Object.entries(js)
      .sort((a, b) => a[1].orden - b[1].orden)
      .map(([id]) => id);
    return s;
  });
  return uids;
}

export function iniciarSesion(): Promise<User> {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (u) => {
      if (u) {
        off();
        resolve(u);
      }
    });
    signInAnonymously(auth).catch(reject);
  });
}

const nuevoCodigo = () => String(Math.floor(100000 + Math.random() * 900000));

export async function crearSala(uid: string, nombre: string, color: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const codigo = nuevoCodigo();
    const r = ref(db, 'salas/' + codigo);
    if ((await get(r)).exists()) continue;
    const sala: Sala = {
      anfitrion: uid,
      estado: 'espera',
      creada: Date.now(),
      config: CONFIG_INICIAL,
      jugadores: { [uid]: { nombre, color, listo: false, orden: 0 } },
    };
    await set(r, sala);
    return codigo;
  }
  throw new Error('No se pudo crear la sala, intenta otra vez');
}

export async function unirseSala(codigo: string, uid: string, nombre: string, color: string) {
  const r = ref(db, 'salas/' + codigo);
  const snap = await get(r);
  if (!snap.exists()) throw new Error('Esa sala no existe');
  const actual = snap.val() as Sala;
  if (actual.estado !== 'espera' && !actual.jugadores?.[uid]) throw new Error('La partida ya empezó');
  let error = '';
  await runTransaction(r, (s: Sala | null) => {
    error = '';
    if (!s) return s;
    const js = s.jugadores ?? {};
    if (!js[uid]) {
      if (Object.keys(js).length >= 6) {
        error = 'La sala está llena (6 jugadores)';
        return;
      }
      if (Object.values(js).some((j) => j.color === color)) {
        error = 'Ese color ya está ocupado, elige otro';
        return;
      }
      js[uid] = { nombre, color, listo: false, orden: Object.keys(js).length };
    }
    s.jugadores = js;
    return s;
  });
  if (error) throw new Error(error);
}

export async function existeJugador(codigo: string, uid: string): Promise<boolean> {
  const snap = await get(ref(db, `salas/${codigo}/jugadores/${uid}/nombre`));
  return snap.exists();
}

export async function cambiarColor(codigo: string, uid: string, color: string) {
  let error = '';
  await runTransaction(ref(db, 'salas/' + codigo), (s: Sala | null) => {
    error = '';
    if (!s || !s.jugadores?.[uid]) return s;
    if (Object.entries(s.jugadores).some(([id, j]) => id !== uid && j.color === color)) {
      error = 'Ese color ya está ocupado';
      return;
    }
    s.jugadores[uid].color = color;
    return s;
  });
  if (error) throw new Error(error);
}

export function marcarListo(codigo: string, uid: string, listo: boolean) {
  return update(ref(db, `salas/${codigo}/jugadores/${uid}`), { listo });
}

export function guardarConfig(codigo: string, config: Config) {
  return update(ref(db, 'salas/' + codigo), { config });
}

export async function iniciarPartida(codigo: string, config: Config, uids: string[]) {
  const snap = await get(ref(db, 'salas/' + codigo));
  const actual = snap.val() as Sala | null;
  const js = actual?.jugadores ?? {};
  const lista = uids.map((uid) => ({ uid, nombre: js[uid]?.nombre ?? '' }));
  const grande = uids.length >= 5;
  const modo: Modo = config.mapa === 'catan' ? (grande ? 'cg' : 'cp') : grande ? 'g' : 'p';
  const semilla = Math.floor(Math.random() * 2147483646) + 1;
  const mapa = mapaDe(modo, semilla);
  const [dr, dc] = mapa.desiertos[0];
  const manos: Record<string, Recursos> = {};
  uids.forEach((u) => {
    manos[u] = manoVacia();
  });
  await update(ref(db, 'salas/' + codigo), {
    config,
    partida: { modo, semilla },
    juego: crearEstadoJuego(lista, dr + ',' + dc),
    manos,
    estado: 'jugando',
  });
}

export function marcarPresencia(codigo: string, uid: string) {
  const c = ref(db, `salas/${codigo}/jugadores/${uid}/conectado`);
  return onValue(ref(db, '.info/connected'), (s) => {
    if (s.val() === true) {
      onDisconnect(c).set(false);
      set(c, true);
    }
  });
}

export function escucharSala(codigo: string, cb: (s: Sala | null) => void) {
  return onValue(ref(db, 'salas/' + codigo), (s) => cb(s.exists() ? (s.val() as Sala) : null));
}

export function enviarMensaje(codigo: string, uid: string, nombre: string, texto: string) {
  const t = texto.trim();
  if (!t) return Promise.resolve();
  return push(ref(db, `salas/${codigo}/chat`), { uid, nombre, texto: t, ts: Date.now() });
}

export type EntradaRanking = { nombre: string; puntos: number; partidas: number };

export function claveRanking(nombre: string): string {
  return (nombre || 'jugador').trim().replace(/[.$#[\]/]/g, '').replace(/\s+/g, '_') || 'jugador';
}

export function actualizarRanking(nombre: string, puntos: number) {
  const clave = claveRanking(nombre);
  const r = ref(db, `ranking/${clave}`);
  return runTransaction(r, (cur: EntradaRanking | null) => {
    if (!cur) return { nombre: nombre.trim(), puntos, partidas: 1 };
    return { nombre: nombre.trim(), puntos: (cur.puntos ?? 0) + puntos, partidas: (cur.partidas ?? 0) + 1 };
  });
}

export function escucharRanking(cb: (lista: { uid: string; nombre: string; puntos: number; partidas: number }[]) => void) {
  return onValue(ref(db, 'ranking'), (s) => {
    const val = s.val() as Record<string, EntradaRanking> | null;
    const lista = Object.entries(val ?? {}).map(([uid, e]) => ({ uid, nombre: e.nombre, puntos: e.puntos ?? 0, partidas: e.partidas ?? 0 }));
    lista.sort((a, b) => b.puntos - a.puntos);
    cb(lista);
  });
}

export type RegistroMaquina = { nombre: string; puntos: number; partidas: number; victorias: number; mejor: number };

/**
 * Partidas contra la máquina: es un registro personal y NUNCA se suma al ranking
 * de jugadores reales. Se guarda aparte, por nombre.
 */
export function actualizarRegistroMaquina(nombre: string, puntos: number, gano: boolean) {
  const clave = claveRanking(nombre);
  return runTransaction(ref(db, `rankingMaquina/${clave}`), (cur: RegistroMaquina | null) => {
    if (!cur) return { nombre: nombre.trim(), puntos, partidas: 1, victorias: gano ? 1 : 0, mejor: puntos };
    return {
      nombre: nombre.trim(),
      puntos: (cur.puntos ?? 0) + puntos,
      partidas: (cur.partidas ?? 0) + 1,
      victorias: (cur.victorias ?? 0) + (gano ? 1 : 0),
      mejor: Math.max(cur.mejor ?? 0, puntos),
    };
  });
}

export function escucharRegistroMaquina(nombre: string, cb: (r: RegistroMaquina | null) => void) {
  return onValue(ref(db, `rankingMaquina/${claveRanking(nombre)}`), (s) => cb(s.exists() ? (s.val() as RegistroMaquina) : null));
}

export async function salirSala(codigo: string, uid: string) {
  await onDisconnect(ref(db, `salas/${codigo}/jugadores/${uid}/conectado`)).cancel();
  await runTransaction(ref(db, 'salas/' + codigo), (s: Sala | null) => {
    if (!s) return s;
    const js = s.jugadores ?? {};
    const j = s.juego;
    // Si se va en plena partida, su lugar lo ocupa un bot para que el juego no se trabe.
    if (j && j.fase !== 'fin' && j.orden.includes(uid)) {
      const previo = js[uid] ?? { nombre: 'Jugador', color: 'negro', listo: true, orden: Object.keys(js).length };
      js[uid] = { ...previo, conectado: false, bot: true };
      s.jugadores = js;
      if (s.anfitrion === uid) {
        const humano = Object.keys(js).find((id) => id !== uid && !esBotSala(js, id) && js[id]?.conectado !== false);
        if (humano) s.anfitrion = humano;
      }
      revisarUltimoHumano(s, j);
      return s;
    }
    delete js[uid];
    const ids = Object.keys(js);
    if (ids.length === 0) return null;
    if (ids.every((id) => esBotSala(js, id))) return null;
    s.jugadores = js;
    if (s.anfitrion === uid) s.anfitrion = ids.find((id) => !esBotSala(js, id)) ?? ids[0];
    return s;
  });
}
