import { onValue, ref, runTransaction } from 'firebase/database';
import { db } from './firebase';
import {
  colocarCamino,
  colocarPoblado,
  crearEstadoJuego as crearEstado,
  lanzarOrden,
  terminarTurnoEn,
  tiempoAgotadoEn,
  tirarPrincipal,
} from './reglas';
import type { EstadoJuego, SalaJuego } from './reglas';

export type { EstadoJuego, Fase, Estadisticas, Recursos, Pieza } from './reglas';

let desfase = 0;
onValue(ref(db, '.info/serverTimeOffset'), (s) => {
  desfase = Number(s.val()) || 0;
});
export const ahoraServidor = () => Date.now() + desfase;

export function crearEstadoJuego(jugadores: { uid: string; nombre: string }[], ladron: string): EstadoJuego {
  return crearEstado(jugadores, ladron, ahoraServidor());
}

async function aplicar(codigo: string, f: (s: SalaJuego) => boolean) {
  await runTransaction(ref(db, 'salas/' + codigo), (s: SalaJuego | null) => {
    if (!s) return s;
    return f(s) ? s : undefined;
  });
}

export const lanzarDadosOrden = (codigo: string, uid: string, numTurno: number) =>
  aplicar(codigo, (s) => lanzarOrden(s, uid, numTurno, ahoraServidor()));

export const ponerPoblado = (codigo: string, uid: string, numTurno: number, vertice: string) =>
  aplicar(codigo, (s) => colocarPoblado(s, uid, numTurno, vertice));

export const ponerCamino = (codigo: string, uid: string, numTurno: number, arista: string) =>
  aplicar(codigo, (s) => colocarCamino(s, uid, numTurno, arista, ahoraServidor()));

export const tirarDados = (codigo: string, uid: string, numTurno: number) =>
  aplicar(codigo, (s) => tirarPrincipal(s, uid, numTurno));

export const terminarTurno = (codigo: string, uid: string, numTurno: number) =>
  aplicar(codigo, (s) => terminarTurnoEn(s, uid, numTurno, ahoraServidor()));

export const tiempoAgotado = (codigo: string, numTurno: number) =>
  aplicar(codigo, (s) => tiempoAgotadoEn(s, numTurno, ahoraServidor()));
