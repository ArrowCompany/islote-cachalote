import { onValue, ref, runTransaction } from 'firebase/database';
import { db } from './firebase';

export type Fase = 'tirar' | 'accion';
export type Estadisticas = { cartas: number; desarrollo: number; caballeros: number; puntos: number };
export type EstadoJuego = {
  orden: string[];
  turno: number;
  numTurno: number;
  fase: Fase;
  dados?: [number, number];
  tirada: number;
  inicioTurno: number;
  stats: Record<string, Estadisticas>;
};

let desfase = 0;
onValue(ref(db, '.info/serverTimeOffset'), (s) => {
  desfase = Number(s.val()) || 0;
});
export const ahoraServidor = () => Date.now() + desfase;

const dado = () => 1 + Math.floor(Math.random() * 6);
const refJuego = (codigo: string) => ref(db, `salas/${codigo}/juego`);

function avanzar(j: EstadoJuego, ahora: number) {
  j.turno = (j.turno + 1) % j.orden.length;
  j.numTurno += 1;
  j.fase = 'tirar';
  j.inicioTurno = ahora;
}

export function crearEstadoJuego(uids: string[]): EstadoJuego {
  const orden = [...uids];
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  const stats: Record<string, Estadisticas> = {};
  orden.forEach((u) => {
    stats[u] = { cartas: 0, desarrollo: 0, caballeros: 0, puntos: 0 };
  });
  return { orden, turno: 0, numTurno: 0, fase: 'tirar', tirada: 0, inicioTurno: ahoraServidor(), stats };
}

export async function tirarDados(codigo: string, numTurno: number) {
  await runTransaction(refJuego(codigo), (j: EstadoJuego | null) => {
    if (!j || j.numTurno !== numTurno || j.fase !== 'tirar') return;
    j.dados = [dado(), dado()];
    j.fase = 'accion';
    j.tirada = (j.tirada ?? 0) + 1;
    return j;
  });
}

export async function terminarTurno(codigo: string, numTurno: number) {
  const ahora = ahoraServidor();
  await runTransaction(refJuego(codigo), (j: EstadoJuego | null) => {
    if (!j || j.numTurno !== numTurno || j.fase !== 'accion') return;
    avanzar(j, ahora);
    return j;
  });
}

export async function tiempoAgotado(codigo: string, numTurno: number) {
  const ahora = ahoraServidor();
  await runTransaction(refJuego(codigo), (j: EstadoJuego | null) => {
    if (!j || j.numTurno !== numTurno) return;
    if (j.fase === 'tirar') {
      j.dados = [dado(), dado()];
      j.tirada = (j.tirada ?? 0) + 1;
    }
    avanzar(j, ahora);
    return j;
  });
}