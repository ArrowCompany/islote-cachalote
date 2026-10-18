import { get, onDisconnect, onValue, ref, runTransaction, set, update } from 'firebase/database';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';
import { crearEstadoJuego } from './turnos';
import type { EstadoJuego } from './turnos';

export const COLORES: { id: string; nombre: string; hex: string }[] = [
  { id: 'amarillo', nombre: 'Amarillo', hex: '#f5c400' },
  { id: 'azul', nombre: 'Azul oscuro', hex: '#1e3a8a' },
  { id: 'rojo', nombre: 'Rojo', hex: '#d62828' },
  { id: 'verde', nombre: 'Verde', hex: '#2e9e44' },
  { id: 'negro', nombre: 'Negro', hex: '#1b1b1b' },
  { id: 'morado', nombre: 'Morado', hex: '#7b2cbf' },
  { id: 'cafe', nombre: 'Café', hex: '#7a4a21' },
  { id: 'naranja', nombre: 'Naranja', hex: '#f77f00' },
];

export type Config = { mapa: 'aleatorio' | 'normal'; chat: boolean; reloj: 40 | 60 | 90 };
export type Partida = { modo: 'p' | 'g'; semilla: number };
export type Jugador = { nombre: string; color: string; listo: boolean; orden: number; conectado?: boolean };
export type Sala = {
  anfitrion: string;
  estado: string;
  creada?: number;
  config?: Config;
  partida?: Partida;
  juego?: EstadoJuego;
  jugadores?: Record<string, Jugador>;
};

export const CONFIG_INICIAL: Config = { mapa: 'aleatorio', chat: true, reloj: 60 };

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
  const modo: 'p' | 'g' = uids.length >= 5 ? 'g' : 'p';
  const semilla = config.mapa === 'normal' ? 11 : Math.floor(Math.random() * 2147483646) + 1;
  await update(ref(db, 'salas/' + codigo), {
    config,
    partida: { modo, semilla },
    juego: crearEstadoJuego(uids),
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

export async function salirSala(codigo: string, uid: string) {
  await onDisconnect(ref(db, `salas/${codigo}/jugadores/${uid}/conectado`)).cancel();
  await runTransaction(ref(db, 'salas/' + codigo), (s: Sala | null) => {
    if (!s) return s;
    const js = s.jugadores ?? {};
    delete js[uid];
    const ids = Object.keys(js);
    if (ids.length === 0) return null;
    s.jugadores = js;
    if (s.anfitrion === uid) s.anfitrion = ids[0];
    return s;
  });
}