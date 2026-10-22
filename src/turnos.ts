import { onValue, ref, runTransaction } from 'firebase/database';
import { db } from './firebase';
import {
  aceptarOferta,
  cambiarBanco,
  cancelarOferta,
  colocarCamino,
  comprarCarta,
  construir,
  crearOferta,
  descartar,
  fijarBloqueo,
  colocarPoblado,
  crearEstadoJuego as crearEstado,
  jugarCarta,
  lanzarOrden,
  moverLadron,
  rechazarOferta,
  robarA,
  terminarTurnoEn,
  tiempoAgotadoEn,
  tirarPrincipal,
} from './reglas';
import type { EstadoJuego, ParamCarta, Recurso, Recursos, SalaJuego, TipoPieza } from './reglas';

export type { EstadoJuego, Fase, Estadisticas, Recursos, Pieza } from './reglas';

let desfase = 0;
onValue(ref(db, '.info/serverTimeOffset'), (s) => {
  desfase = Number(s.val()) || 0;
});
export const ahoraServidor = () => Date.now() + desfase;

export function crearEstadoJuego(jugadores: { uid: string; nombre: string }[], ladron: string): EstadoJuego {
  return crearEstado(jugadores, ladron, ahoraServidor());
}

async function aplicar(codigo: string, f: (s: SalaJuego) => boolean, estricto: boolean = true) {
  const r = await runTransaction(ref(db, 'salas/' + codigo), (s: SalaJuego | null) => {
    if (!s) return s;
    return f(s) ? s : undefined;
  });
  if (estricto && !r.committed) throw new Error('Acción no permitida');
}

export const lanzarDadosOrden = (codigo: string, uid: string, numTurno: number) =>
  aplicar(codigo, (s) => lanzarOrden(s, uid, numTurno, ahoraServidor()));

export const ponerPoblado = (codigo: string, uid: string, numTurno: number, vertice: string) =>
  aplicar(codigo, (s) => colocarPoblado(s, uid, numTurno, vertice));

export const ponerCamino = (codigo: string, uid: string, numTurno: number, arista: string) =>
  aplicar(codigo, (s) => colocarCamino(s, uid, numTurno, arista, ahoraServidor()));

export const tirarDados = (codigo: string, uid: string, numTurno: number) =>
  aplicar(codigo, (s) => tirarPrincipal(s, uid, numTurno, undefined, ahoraServidor()));

export const terminarTurno = (codigo: string, uid: string, numTurno: number) =>
  aplicar(codigo, (s) => terminarTurnoEn(s, uid, numTurno, ahoraServidor()));

export const tiempoAgotado = (codigo: string, numTurno: number) =>
  aplicar(codigo, (s) => tiempoAgotadoEn(s, numTurno, ahoraServidor()), false);

export const construirPieza = (codigo: string, uid: string, numTurno: number, tipo: TipoPieza, id: string) =>
  aplicar(codigo, (s) => construir(s, uid, numTurno, tipo, id));

export const cambiarConBanco = (codigo: string, uid: string, numTurno: number, da: Recurso, recibe: Recurso) =>
  aplicar(codigo, (s) => cambiarBanco(s, uid, numTurno, da, recibe));

export const proponerCambio = (codigo: string, uid: string, numTurno: number, da: Partial<Recursos>, pide: Partial<Recursos>) =>
  aplicar(codigo, (s) => crearOferta(s, uid, numTurno, da, pide));

export const aceptarCambio = (codigo: string, uid: string, id: number) => aplicar(codigo, (s) => aceptarOferta(s, uid, id));
export const rechazarCambio = (codigo: string, uid: string, id: number) => aplicar(codigo, (s) => rechazarOferta(s, uid, id));
export const cancelarCambio = (codigo: string, uid: string, id: number) => aplicar(codigo, (s) => cancelarOferta(s, uid, id));
export const bloquearCambios = (codigo: string, uid: string, valor: boolean) => aplicar(codigo, (s) => fijarBloqueo(s, uid, valor));

export const descartarCartas = (codigo: string, uid: string, numTurno: number, sel: Partial<Recursos>) =>
  aplicar(codigo, (s) => descartar(s, uid, numTurno, sel, ahoraServidor()));

export const mandarLadron = (codigo: string, uid: string, numTurno: number, clave: string) =>
  aplicar(codigo, (s) => moverLadron(s, uid, numTurno, clave, ahoraServidor()));

export const robarCartaA = (codigo: string, uid: string, numTurno: number, victima: string) =>
  aplicar(codigo, (s) => robarA(s, uid, numTurno, victima, ahoraServidor()));

export const comprarDesarrollo = (codigo: string, uid: string, numTurno: number) =>
  aplicar(codigo, (s) => comprarCarta(s, uid, numTurno));

export const usarCarta = (codigo: string, uid: string, numTurno: number, idCarta: number, param: ParamCarta) =>
  aplicar(codigo, (s) => jugarCarta(s, uid, numTurno, idCarta, param, ahoraServidor()));
