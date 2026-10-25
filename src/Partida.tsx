import { useEffect, useMemo, useRef, useState } from 'react';
import { COLORES, actualizarRanking } from './salas';
import type { Sala } from './salas';
import { esBot, caminoInicial, decidirAccion, elegirDescarte, elegirHexLadron, elegirVictima, manoDeBot, pobladoInicial } from './bots';
import { aceptarCambio, ahoraServidor, bloquearCambios, cambiarConBanco, cancelarCambio, comprarDesarrollo, construirPieza, descartarCartas, lanzarDadosOrden, mandarLadron, ponerCamino, ponerPoblado, proponerCambio, rechazarCambio, robarCartaA, terminarTurno, tiempoAgotado, tirarDados, usarCarta } from './turnos';
import { enviarMensaje } from './salas';
import { COSTO, COSTO_CARTA, DESCRIPCION_CARTA, LIMITE, NOMBRE_CARTA, NOMBRE_RECURSO, RECURSOS, caminosDePoblado, completar, contarPiezas, jugadorActual, lugaresPara, manoVacia, pendientesOrden, puedePagar, puntosTotales, tasasDe, verticesLibres } from './reglas';
import type { CartaDes, ParamCarta, Recurso, Recursos, TipoPieza } from './reglas';
import { COLOR, ballena, geometriaDe, mapaDe, posicion } from './tablero';
import Juego from './Juego';
import * as sonido from './sonido';
import type { ModoSonido } from './sonido';
import Mesa from './Mesa';
import { Cantidades, Carta, FormaCiudad, FormaPoblado, IconoRecurso, listones } from './piezas';
import './partida.css';

type Props = { sala: Sala; uid: string; codigo: string; onSalir: () => void };
type Panel = 'ninguno' | 'jugadores' | 'chat' | 'cartas';
type Pestana = 'jugadores' | 'banco';

const PUNTOS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
function hexPath(x: number, y: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    pts.push((x + r * Math.cos(a)).toFixed(1) + ',' + (y + r * Math.sin(a)).toFixed(1));
  }
  return 'M' + pts.join('L') + 'Z';
}
const dado6 = () => 1 + Math.floor(Math.random() * 6);
const colorDe = (id: string) => COLORES.find((c) => c.id === id)?.hex ?? '#888888';
const esClaro = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150;
};

function Dado({ valor, rodando }: { valor: number; rodando: boolean }) {
  return (
    <div className={rodando ? 'dado rodando' : 'dado'}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PUNTOS[valor].includes(i) ? 'p on' : 'p'} />
      ))}
    </div>
  );
}

function IconoBolsa() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
      <path d="M13 6h14l-3 6h-8z" fill="#d9a15b" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 12h8c8 4 11 12 9 20a4 4 0 0 1-4 3H11a4 4 0 0 1-4-3c-2-8 1-16 9-20z" fill="#c98a43" stroke="#ffffff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M17 23h6M20 20v6" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function IconoCartas() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <rect x="4" y="6" width="17" height="22" rx="3" fill="#cfd6e4" stroke="#ffffff" strokeWidth="1.5" transform="rotate(-10 12 17)" />
      <rect x="11" y="4" width="17" height="22" rx="3" fill="#ffffff" />
      <path d="M19.5 10l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#333333" />
    </svg>
  );
}

function IconoCarta() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
      <rect x="9" y="5" width="22" height="30" rx="4" fill="#7a859b" stroke="#ffffff" strokeWidth="1.8" />
      <text x="20" y="27" textAnchor="middle" fontSize="20" fontWeight="700" fill="#2c3340">?</text>
    </svg>
  );
}

function IconoChat() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <path d="M4 5h24a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H15l-7 6v-6H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="#ffffff" />
      <circle cx="10" cy="14" r="2" fill="#333333" />
      <circle cx="16" cy="14" r="2" fill="#333333" />
      <circle cx="22" cy="14" r="2" fill="#333333" />
    </svg>
  );
}

function IconoJugadores() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <g fill="#ffffff">
        <circle cx="11" cy="10" r="5" />
        <path d="M1 27a10 10 0 0 1 20 0z" />
        <circle cx="23" cy="11" r="4.2" />
        <path d="M17 27a8 8 0 0 1 14 0z" />
      </g>
    </svg>
  );
}

export default function Partida({ sala, uid, codigo, onSalir }: Props) {
  const partida = sala.partida;
  const juego = useMemo(() => (sala.juego ? completar(sala.juego) : null), [sala.juego]);
  const modo = partida?.modo;
  const semilla = partida?.semilla;
  const geo = useMemo(() => (modo && semilla !== undefined ? geometriaDe(modo, semilla) : null), [modo, semilla]);
  const bots = useMemo(() => Object.keys(sala.jugadores ?? {}).filter(esBot), [sala.jugadores]);
  const hayJuego = !!juego && !!partida;
  const reloj = sala.config?.reloj ?? 60;
  const hayChat = sala.config?.chat !== false;
  const tirada = juego?.tirada ?? 0;
  const inicio = juego?.inicioTurno ?? 0;
  const numTurno = juego?.numTurno ?? 0;
  const actualUid = juego ? jugadorActual(juego) : '';
  const soyActual = actualUid === uid;
  const soyAnfitrion = sala.anfitrion === uid;

  const [rodando, setRodando] = useState(false);
  const [azar, setAzar] = useState<[number, number]>([1, 1]);
  const [restante, setRestante] = useState<number>(reloj);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>('ninguno');
  const [construyendo, setConstruyendo] = useState<TipoPieza | null>(null);
  const [pendiente, setPendiente] = useState<{ tipo: 'poblado'; id: string } | null>(null);
  const [cambio, setCambio] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('jugadores');
  const [ofDa, setOfDa] = useState<Recursos>(manoVacia());
  const [ofPide, setOfPide] = useState<Recursos>(manoVacia());
  const [doy, setDoy] = useState<Recurso | null>(null);
  const [recibo, setRecibo] = useState<Recurso | null>(null);
  const [selDescarte, setSelDescarte] = useState<Recursos>(manoVacia());
  const [confirmarCarta, setConfirmarCarta] = useState(false);
  const [cartaNueva, setCartaNueva] = useState<CartaDes | null>(null);
  const [usando, setUsando] = useState<CartaDes | null>(null);
  const [elegidos, setElegidos] = useState<Recurso[]>([]);
  const misCartas = sala.cartas?.[uid] ?? [];
  const cantCartasRef = useRef(misCartas.length);
  const faseActual = juego?.fase;
  const tiradaVista = useRef(tirada);
  const disparado = useRef(-1);

  useEffect(() => {
    if (tirada === tiradaVista.current) return;
    tiradaVista.current = tirada;
    sonido.dados();
    setRodando(true);
    const intervalo = window.setInterval(() => setAzar([dado6(), dado6()]), 90);
    const fin = window.setTimeout(() => {
      window.clearInterval(intervalo);
      setRodando(false);
    }, 1100);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(fin);
    };
  }, [tirada]);

  useEffect(() => {
    if (!hayJuego || faseActual === 'fin') return;
    const revisar = () => {
      const pasado = ahoraServidor() - inicio;
      setRestante(Math.max(0, Math.ceil(reloj - pasado / 1000)));
      const gracia = soyActual ? 500 : soyAnfitrion ? 3000 : 8000;
      if (pasado >= reloj * 1000 + gracia && disparado.current !== numTurno) {
        disparado.current = numTurno;
        tiempoAgotado(codigo, numTurno).catch(() => {
          disparado.current = -1;
        });
      }
    };
    revisar();
    const t = window.setInterval(revisar, 250);
    return () => window.clearInterval(t);
  }, [hayJuego, faseActual, inicio, numTurno, reloj, soyActual, soyAnfitrion, codigo]);

  useEffect(() => {
    setConstruyendo(null);
    setPendiente(null);
    setCambio(false);
    setOfDa(manoVacia());
    setOfPide(manoVacia());
    setDoy(null);
    setRecibo(null);
    setSelDescarte(manoVacia());
    setConfirmarCarta(false);
    setUsando(null);
    setElegidos([]);
  }, [numTurno, faseActual]);

  useEffect(() => {
    if (misCartas.length > cantCartasRef.current) setCartaNueva(misCartas[misCartas.length - 1]);
    cantCartasRef.current = misCartas.length;
  }, [misCartas]);

  const [modoSonido, setModoSonido] = useState<ModoSonido>(sonido.obtenerModo());
  const piezasN = juego
    ? Object.keys(juego.poblados).length + Object.keys(juego.caminos).length + Object.values(juego.poblados).filter((q) => q.tipo === 'ciudad').length
    : 0;
  const prevCamino = useRef(juego?.camino?.uid);
  const rankingRegistrado = useRef(false);
  const prevEjercito = useRef(juego?.ejercito?.uid);
  const prevFase = useRef(juego?.fase);
  const prevLadron = useRef(juego?.ladron);
  const prevActual = useRef(actualUid);
  const prevPiezas = useRef(piezasN);

  useEffect(() => {
    sonido.iniciar();
    const h = () => sonido.iniciar();
    window.addEventListener('pointerdown', h, { once: true });
    return () => {
      window.removeEventListener('pointerdown', h);
      sonido.detener();
    };
  }, []);

  useEffect(() => {
    const n = juego?.camino?.uid;
    if (n && n !== prevCamino.current) sonido.caminoLargo();
    prevCamino.current = n;
  }, [juego?.camino?.uid]);

  useEffect(() => {
    const n = juego?.ejercito?.uid;
    if (n && n !== prevEjercito.current) sonido.mayorEjercito();
    prevEjercito.current = n;
  }, [juego?.ejercito?.uid]);

  useEffect(() => {
    const f = juego?.fase;
    const antes = prevFase.current;
    if (f === 'fin' && antes !== 'fin') sonido.victoria();
    else if ((f === 'descartar' || f === 'mover') && antes !== 'descartar' && antes !== 'mover') sonido.ladron();
    prevFase.current = f;
  }, [juego?.fase]);

  useEffect(() => {
    if (prevLadron.current !== juego?.ladron) sonido.chapoteo();
    prevLadron.current = juego?.ladron;
  }, [juego?.ladron]);

  useEffect(() => {
    if (actualUid === uid && prevActual.current !== uid && juego?.fase === 'tirar') sonido.tuTurno();
    prevActual.current = actualUid;
  }, [actualUid, uid, juego?.fase]);

  useEffect(() => {
    if (piezasN > prevPiezas.current) sonido.construir();
    prevPiezas.current = piezasN;
  }, [piezasN]);

  useEffect(() => {
    if (faseActual !== 'fin' || rankingRegistrado.current || !juego) return;
    rankingRegistrado.current = true;
    juego.orden.forEach((id) => {
      if (esBot(id)) return;
      const pts = puntosTotales(sala, juego, id);
      const nombre = nombreDe(id);
      void actualizarRanking(nombre, pts);
    });
  }, [faseActual]);

  const [reintentoBot, setReintentoBot] = useState(0);
  const accionesBot = useRef<{ turno: number; n: number }>({ turno: -1, n: 0 });

  useEffect(() => {
    if (!hayJuego || !juego || !geo || !partida || !soyAnfitrion || bots.length === 0) return;
    if (juego.fase === 'fin') return;
    const mapa = mapaDe(partida.modo, partida.semilla);
    const enSala = new Set(bots);
    let ejecutar: (() => Promise<void>) | null = null;

    const oferta = juego.oferta;
    if (oferta) {
      const b = bots.find((x) => x !== oferta.de && !oferta.rechazos[x] && juego.orden.includes(x));
      if (b) ejecutar = () => rechazarCambio(codigo, b, oferta.id).then(() => undefined);
    }

    if (!ejecutar) {
      const pendientes = pendientesOrden(juego);
      const actual = jugadorActual(juego);
      let bot = '';
      if (juego.fase === 'orden') bot = bots.find((b) => pendientes.includes(b) && !juego.tiradasOrden[b]) ?? '';
      else if (juego.fase === 'descartar') bot = bots.find((b) => (juego.descartes[b] ?? 0) > 0) ?? '';
      else if (['colocacion', 'tirar', 'accion', 'mover', 'robar'].includes(juego.fase) && enSala.has(actual)) bot = actual;

      if (bot) {
        const n = juego.numTurno;
        if (juego.fase === 'orden') {
          ejecutar = () => lanzarDadosOrden(codigo, bot, n).then(() => undefined);
        } else if (juego.fase === 'descartar') {
          const cuantas = juego.descartes[bot] ?? 0;
          const sel = elegirDescarte(manoDeBot(sala.manos, bot), cuantas);
          ejecutar = () => descartarCartas(codigo, bot, n, sel).then(() => undefined);
        } else if (juego.fase === 'colocacion') {
          if (juego.subpaso === 'poblado') {
            const v = pobladoInicial(mapa, geo, juego);
            if (v) ejecutar = () => ponerPoblado(codigo, bot, n, v).then(() => undefined);
          } else if (juego.ultimoPoblado) {
            const e = caminoInicial(mapa, geo, juego, juego.ultimoPoblado);
            if (e) ejecutar = () => ponerCamino(codigo, bot, n, e).then(() => undefined);
          }
        } else if (juego.fase === 'tirar') {
          ejecutar = () => tirarDados(codigo, bot, n).then(() => undefined);
        } else if (juego.fase === 'accion') {
          if (accionesBot.current.turno !== n) accionesBot.current = { turno: n, n: 0 };
          const accion = decidirAccion(sala, mapa, geo, juego, bot, accionesBot.current.n);
          accionesBot.current.n += 1;
          ejecutar = () => {
            if (accion.tipo === 'construir') return construirPieza(codigo, bot, n, accion.pieza, accion.id).then(() => undefined);
            if (accion.tipo === 'comprar') return comprarDesarrollo(codigo, bot, n).then(() => undefined);
            if (accion.tipo === 'banco') return cambiarConBanco(codigo, bot, n, accion.da, accion.recibe).then(() => undefined);
            return terminarTurno(codigo, bot, n).then(() => undefined);
          };
        } else if (juego.fase === 'mover') {
          const clave = elegirHexLadron(mapa, geo, juego, bot);
          if (clave) ejecutar = () => mandarLadron(codigo, bot, n, clave).then(() => undefined);
        } else if (juego.fase === 'robar') {
          const v = elegirVictima(sala.manos, juego, bot);
          if (v) ejecutar = () => robarCartaA(codigo, bot, n, v).then(() => undefined);
        }
      }
    }

    if (!ejecutar) return;
    const accion = ejecutar;
    const t = window.setTimeout(() => {
      void accion().catch(() => {
        window.setTimeout(() => setReintentoBot((x) => x + 1), 900);
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [hayJuego, juego, geo, partida, soyAnfitrion, bots, codigo, sala.manos, reintentoBot]);

  useEffect(() => {
    if (juego?.aviso && juego.aviso.includes('aceptó el cambio')) sonido.cambio();
  }, [juego?.aviso]);

  if (!juego || !partida || !geo) {
    return (
      <div className="partida">
        <p className="cargando">Cargando partida...</p>
      </div>
    );
  }

  const nombreDe = (id: string) => sala.jugadores?.[id]?.nombre ?? 'Jugador';
  const colorJ = (id: string) => colorDe(sala.jugadores?.[id]?.color ?? '');
  const miColor = colorJ(uid);
  const textoMio = esClaro(miColor) ? '#1b1b1b' : '#ffffff';
  const mano = { ...manoVacia(), ...(sala.manos?.[uid] ?? {}) };
  const valores: [number, number] = rodando ? azar : (juego.dados ?? [1, 1]);
  const suma = juego.dados ? juego.dados[0] + juego.dados[1] : 0;
  const enOrden = juego.fase === 'orden';
  const enColocacion = juego.fase === 'colocacion';
  const pendientes = pendientesOrden(juego);
  const yoPuedoLanzarOrden = enOrden && pendientes.includes(uid) && !juego.tiradasOrden[uid];

  const intentar = async (accion: () => Promise<void>, mensaje: string) => {
    setError('');
    try {
      await accion();
    } catch {
      setError(mensaje);
    }
  };
  const lanzarOrden = () => intentar(() => lanzarDadosOrden(codigo, uid, numTurno), 'No pude lanzar los dados, intenta otra vez');
  const tirar = () => intentar(() => tirarDados(codigo, uid, numTurno), 'No pude tirar los dados, intenta otra vez');
  const terminar = () => intentar(() => terminarTurno(codigo, uid, numTurno), 'No pude terminar el turno, intenta otra vez');
  const poner = (v: string) => intentar(() => ponerPoblado(codigo, uid, numTurno, v), 'No pude poner el poblado, intenta otra vez');
  const camino = (e: string) => intentar(() => ponerCamino(codigo, uid, numTurno, e), 'No pude poner el camino, intenta otra vez');

  const mapa = mapaDe(partida.modo, partida.semilla);
  const tasas = tasasDe(mapa, geo, juego, uid);
  const oferta = juego.oferta;
  const miOferta = oferta && oferta.de === uid ? oferta : null;
  const bloqueado = !!juego.bloqueos?.[uid];
  const ofertaEntrante = oferta && oferta.de !== uid && !oferta.rechazos[uid] && !bloqueado && juego.fase === 'accion' ? oferta : null;
  const suma5 = (c: Recursos) => RECURSOS.reduce((t, r) => t + c[r], 0);
  const choque = RECURSOS.some((r) => ofDa[r] > 0 && ofPide[r] > 0);
  const otros = juego.orden.filter((u) => u !== uid);
  const todosBloquean = otros.every((u) => juego.bloqueos?.[u]);
  const puedeOfrecer = suma5(ofDa) > 0 && suma5(ofPide) > 0 && !choque && !todosBloquean && !miOferta;
  const alcanzaOferta = ofertaEntrante ? RECURSOS.every((r) => mano[r] >= (ofertaEntrante.pide[r] ?? 0)) : false;
  const enviarOferta = () => intentar(() => proponerCambio(codigo, uid, numTurno, ofDa, ofPide), 'No pude enviar la oferta, intenta otra vez');
  const quitarOferta = () => (oferta ? intentar(() => cancelarCambio(codigo, uid, oferta.id), 'No pude cancelar la oferta') : Promise.resolve());
  const aceptarOferta = () => (ofertaEntrante ? intentar(() => aceptarCambio(codigo, uid, ofertaEntrante.id), 'No pude aceptar: revisa que tengas las cartas') : Promise.resolve());
  const rechazarOferta = () => (ofertaEntrante ? intentar(() => rechazarCambio(codigo, uid, ofertaEntrante.id), 'No pude rechazar la oferta') : Promise.resolve());
  const hacerBanco = () => {
    if (!doy || !recibo) return;
    const d = doy, r = recibo;
    void intentar(() => cambiarConBanco(codigo, uid, numTurno, d, r), 'No pude hacer el cambio con el banco');
  };
  const cambiarBloqueo = (v: boolean) => void intentar(() => bloquearCambios(codigo, uid, v), 'No pude cambiar el bloqueo');
  const miTurnoColocar = enColocacion && soyActual;
  const puedoConstruir = juego.fase === 'accion' && soyActual;
  const enMover = juego.fase === 'mover';
  const enRobar = juego.fase === 'robar';
  const enDescartar = juego.fase === 'descartar';
  const enFin = juego.fase === 'fin';
  const gratis = soyActual && juego.caminosGratis > 0 && (juego.fase === 'tirar' || juego.fase === 'accion');
  const debo = juego.descartes[uid] ?? 0;
  const lugares = puedoConstruir && construyendo && construyendo !== 'camino' ? lugaresPara(geo, juego, uid, construyendo) : [];
  const lugaresCamino = gratis || (puedoConstruir && construyendo === 'camino') ? lugaresPara(geo, juego, uid, 'camino') : [];
  const vValidos = miTurnoColocar && juego.subpaso === 'poblado' ? verticesLibres(geo, juego.poblados) : lugares;
  const eValidas = miTurnoColocar && juego.subpaso === 'camino' && juego.ultimoPoblado ? caminosDePoblado(geo, juego.caminos, juego.ultimoPoblado) : lugaresCamino;
  const hexesMover = enMover && soyActual ? mapa.hexes.filter((h) => h.r + ',' + h.c !== juego.ladron) : [];
  const moverCachalote = (clave: string) => void intentar(() => mandarLadron(codigo, uid, numTurno, clave), 'No pude mover al cachalote, intenta otra vez');
  const robarAlguien = (v: string) => void intentar(() => robarCartaA(codigo, uid, numTurno, v), 'No pude robar, intenta otra vez');
  const descartarYa = () => void intentar(() => descartarCartas(codigo, uid, numTurno, selDescarte), 'No pude descartar: revisa la cantidad');
  const comprarYa = () => {
    setConfirmarCarta(false);
    void intentar(() => comprarDesarrollo(codigo, uid, numTurno), 'No pude comprar la carta');
  };
  const jugarYa = (c: CartaDes, param: ParamCarta) => {
    setUsando(null);
    setElegidos([]);
    setPanel('ninguno');
    void intentar(() => usarCarta(codigo, uid, numTurno, c.id, param), 'No pude jugar la carta');
  };
  const puedeJugar = (c: CartaDes) => soyActual && (juego.fase === 'tirar' || juego.fase === 'accion') && !juego.jugoCarta && c.tipo !== 'punto' && c.turno < juego.rondaTurno;
  const alcanzaCarta = RECURSOS.every((r) => mano[r] >= (COSTO_CARTA[r] ?? 0)) && juego.mazo.length > 0;
  const construirAqui = (id: string) => {
    const t = construyendo ?? (gratis ? 'camino' : null);
    if (!t) return;
    setConstruyendo(null);
    void intentar(() => construirPieza(codigo, uid, numTurno, t, id), 'No pude construir, intenta otra vez');
  };
  const confirmarPendiente = () => {
    if (!pendiente) return;
    const id = pendiente.id;
    setPendiente(null);
    if (miTurnoColocar) void poner(id);
    else {
      setConstruyendo(null);
      void intentar(() => construirPieza(codigo, uid, numTurno, 'poblado', id), 'No pude construir, intenta otra vez');
    }
  };
  const [br, bc] = juego.ladron.split(',').map(Number);
  const [bx, by] = posicion(partida.modo, br, bc);

  const overlay = (
    <g>
      {Object.entries(juego.caminos).map(([e, dueno]) => {
        const a = geo.aristas[e];
        if (!a) return null;
        const va = geo.vertices[a.a];
        const vb = geo.vertices[a.b];
        return (
          <g key={e} pointerEvents="none">
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke="#000000" strokeWidth={13} strokeLinecap="round" />
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke={colorJ(dueno)} strokeWidth={7} strokeLinecap="round" />
            <path d={listones(va.x, va.y, vb.x, vb.y, 1)} stroke="rgba(0,0,0,0.45)" strokeWidth={1.4} fill="none" />
          </g>
        );
      })}
      {Object.entries(juego.poblados).map(([v, p]) => {
        const q = geo.vertices[v];
        if (!q) return null;
        return (
          <g key={v} transform={`translate(${q.x} ${q.y}) scale(0.95)`} pointerEvents="none">
            {p.tipo === 'ciudad' ? <FormaCiudad color={colorJ(p.uid)} /> : <FormaPoblado color={colorJ(p.uid)} />}
          </g>
        );
      })}
      <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: ballena(bx, by) }} />
      {eValidas.map((e) => {
        const a = geo.aristas[e];
        const va = geo.vertices[a.a];
        const vb = geo.vertices[a.b];
        return (
          <g key={e} onClick={() => (miTurnoColocar ? void camino(e) : construirAqui(e))} style={{ cursor: 'pointer' }}>
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke="transparent" strokeWidth={24} strokeLinecap="round" />
            <line className="hot-arista" x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} />
          </g>
        );
      })}
      {hexesMover.map((h) => (
        <g key={h.r + ',' + h.c} onClick={() => moverCachalote(h.r + ',' + h.c)} style={{ cursor: 'pointer' }}>
          <path d={hexPath(h.x, h.y, 46)} fill="rgba(255,255,255,0.08)" />
          <path className="hot-hex" d={hexPath(h.x, h.y, 40)} />
        </g>
      ))}
      {vValidos.map((v) => (
        <g key={v} onClick={() => {
          if (miTurnoColocar || construyendo === 'poblado') setPendiente({ tipo: 'poblado', id: v });
          else construirAqui(v);
        }} style={{ cursor: 'pointer' }}>
          <circle cx={geo.vertices[v].x} cy={geo.vertices[v].y} r={19} fill="transparent" />
          <circle className="hot" cx={geo.vertices[v].x} cy={geo.vertices[v].y} r={10} />
        </g>
      ))}
      {pendiente && geo.vertices[pendiente.id] && (
        <g transform={`translate(${geo.vertices[pendiente.id].x} ${geo.vertices[pendiente.id].y}) scale(0.95)`} opacity={0.5} pointerEvents="none">
          <FormaPoblado color={miColor} />
        </g>
      )}
    </g>
  );

  let titulo = '';
  if (enOrden) titulo = 'Lancen los dados para ver quién va primero';
  else if (enColocacion) {
    titulo = soyActual
      ? juego.subpaso === 'poblado' ? 'Coloca tu poblado' : 'Coloca tu camino'
      : nombreDe(actualUid) + ' está colocando...';
  } else if (enFin) titulo = 'Partida terminada';
  else if (enDescartar) titulo = debo > 0 ? 'Descarta ' + debo + ' cartas' : 'Esperando que descarten...';
  else if (enMover) titulo = soyActual ? 'Mueve al cachalote: toca un hexágono' : nombreDe(actualUid) + ' mueve al cachalote';
  else if (enRobar) titulo = soyActual ? 'Elige a quién robar' : nombreDe(actualUid) + ' elige a quién robar';
  else if (gratis) titulo = 'Construye caminos gratis: faltan ' + juego.caminosGratis;
  else if (soyActual && construyendo) titulo = 'Toca dónde quieres construir';
  else titulo = soyActual ? '¡Es tu turno!' : 'Turno de ' + nombreDe(actualUid);

  const filasOrden = juego.grupos.flat();
  const listaJugadores = enOrden ? filasOrden : juego.orden;
  const ciclarSonido = () => {
    const n = ((modoSonido + 1) % 3) as ModoSonido;
    sonido.ponerModo(n);
    setModoSonido(n);
  };
  const alternar = (p: Panel) => setPanel((actual) => (actual === p ? 'ninguno' : p));

  return (
    <div className="partida">
      <div className="escena">
        {enOrden ? (
          <div className="orden-caja">
            <h2>🎲 Por favor lancen sus dados para ver quién va primero</h2>
            <div className="orden-lista">
              {filasOrden.map((id) => {
                const t = juego.tiradasOrden[id];
                const empatado = pendientes.includes(id);
                return (
                  <div key={id} className="orden-fila">
                    <span className="punto" style={{ background: colorJ(id) }} />
                    <span className="orden-nombre">{nombreDe(id)}{id === uid ? ' (tú)' : ''}</span>
                    <span className="orden-valor">{t ? 'saca ' + (t[0] + t[1]) : empatado ? 'esperando...' : '—'}</span>
                  </div>
                );
              })}
            </div>
            <p>El que saque el número más alto va primero. Si hay empate, los empatados vuelven a lanzar.</p>
            {yoPuedoLanzarOrden && <button className="accion-centro" onClick={() => void lanzarOrden()}>🎲 Lanzar mis dados</button>}
          </div>
        ) : (
          <div className="tablero-caja">
            <Juego
              modo={partida.modo}
              semilla={partida.semilla}
              overlay={overlay}
              fondo={<Mesa jugadores={juego.orden.map((id) => ({ uid: id, nombre: nombreDe(id), hex: colorJ(id) }))} juego={juego} />}
              sinBallena
              flotante
              mesa
            />
            {pendiente && (
              <div className="barra-confirmar">
                <span>¿Poner el poblado aquí?</span>
                <button className="vx" onClick={() => setPendiente(null)}>✕</button>
                <button className="vv" onClick={confirmarPendiente}>✔</button>
              </div>
            )}
          </div>
        )}

        <div className="flot-izq" style={{ background: miColor }}>
          {hayChat && (
            <button className={panel === 'chat' ? 'sq on' : 'sq'} onClick={() => alternar('chat')} aria-label="Chat">
              <IconoChat />
            </button>
          )}
          <button className={panel === 'jugadores' ? 'sq on' : 'sq'} onClick={() => alternar('jugadores')} aria-label="Jugadores">
            <IconoJugadores />
          </button>
          <button className={panel === 'cartas' ? 'sq on' : 'sq'} onClick={() => alternar('cartas')} aria-label="Mis cartas">
            <IconoCartas />
            {misCartas.length > 0 && <i className="insignia">{misCartas.length}</i>}
          </button>
        </div>

        <div className="flot-centro">
          <div className="pildora">
            <span className="pildora-texto">{titulo}</span>
            <span className={restante <= 10 ? 'pildora-reloj urgente' : 'pildora-reloj'}>⏱ {restante}</span>
          </div>
          <div className="puntos-bar">
            {juego.orden.map((id) => (
              <span key={id} className={id === actualUid ? 'pt actual' : 'pt'} title={nombreDe(id)}>
                <i style={{ background: colorJ(id) }} />
                <b>{juego.stats[id]?.puntos ?? 0}</b>
                {juego.camino?.uid === id ? ' 🛣️' : ''}
                {juego.ejercito?.uid === id ? ' ⚔️' : ''}
              </span>
            ))}
          </div>
          {juego.aviso ? <div className="aviso">{juego.aviso}</div> : null}
        </div>

        <button className="salir flot-der" onClick={onSalir}>Salir</button>
        <button className="sonido-btn" onClick={ciclarSonido} aria-label="Sonido" title={modoSonido === 0 ? 'Música y sonidos' : modoSonido === 1 ? 'Solo sonidos' : 'Silencio'}>
          {modoSonido === 0 ? '🎵' : modoSonido === 1 ? '🔔' : '🔇'}
        </button>

        {panel === 'jugadores' && (
          <div className="panel panel-jug">
            <h3>Jugadores</h3>
            {listaJugadores.map((id, i) => {
              const e = juego.stats[id] ?? { cartas: 0, desarrollo: 0, caballeros: 0, puntos: 0 };
              return (
                <div key={id} className={id === actualUid ? 'jug actual' : 'jug'}>
                  <div className="jug-nombre">
                    <span className="punto" style={{ background: colorJ(id) }} />
                    <span>{enOrden ? '' : i + 1 + '. '}{nombreDe(id)}{id === uid ? ' (tú)' : ''}</span>
                    {sala.jugadores?.[id]?.conectado === false && <span> ⚪</span>}
                  </div>
                  <div className="jug-datos">🃏 {e.cartas} · 🎴 {e.desarrollo} · ⚔️ {e.caballeros} · ⭐ {e.puntos}</div>
                </div>
              );
            })}
          </div>
        )}
        {puedoConstruir && (
          <div className="barra-construir">
            <button className="cons" disabled={!alcanzaCarta} onClick={() => setConfirmarCarta(true)}>
              <IconoCarta />
              <span className="nom">Carta</span>
              <span className="coste">
                {RECURSOS.filter((r) => COSTO_CARTA[r]).map((r) => (
                  <i key={r} style={{ background: COLOR[r] }} title={NOMBRE_RECURSO[r]}>{COSTO_CARTA[r]}</i>
                ))}
              </span>
              <span className="quedan">mazo {juego.mazo.length}</span>
            </button>
            <button className={cambio ? 'cons on' : 'cons'} onClick={() => setCambio((x) => !x)}>
              <IconoBolsa />
              <span className="nom">Comerciar</span>
              <span className="quedan">{miOferta ? 'oferta activa' : 'banco o jugadores'}</span>
            </button>
            {(['camino', 'poblado', 'ciudad'] as TipoPieza[]).map((t) => {
              const c = contarPiezas(juego, uid);
              const quedan = LIMITE[t] - c[t];
              const hayLugar = lugaresPara(geo, juego, uid, t).length > 0;
              const ok = puedePagar(mano, t) && quedan > 0 && hayLugar;
              const nombre = t === 'camino' ? 'Camino' : t === 'poblado' ? 'Poblado' : 'Ciudad';
              return (
                <button key={t} className={construyendo === t ? 'cons on' : 'cons'} disabled={!ok} onClick={() => setConstruyendo(construyendo === t ? null : t)}>
                  <svg viewBox="-20 -25 40 38" width="34" height="32" aria-hidden="true">
                    {t === 'camino' ? (
                      <g>
                        <line x1={-16} y1={6} x2={16} y2={-12} stroke="#000000" strokeWidth={13} strokeLinecap="round" />
                        <line x1={-16} y1={6} x2={16} y2={-12} stroke={miColor} strokeWidth={7} strokeLinecap="round" />
                        <path d={listones(-16, 6, 16, -12, 1)} stroke="rgba(0,0,0,0.35)" strokeWidth={1.4} fill="none" />
                      </g>
                    ) : t === 'poblado' ? <FormaPoblado color={miColor} /> : <FormaCiudad color={miColor} />}
                  </svg>
                  <span className="nom">{nombre}</span>
                  <span className="coste">
                    {RECURSOS.filter((r) => COSTO[t][r]).map((r) => (
                      <i key={r} style={{ background: COLOR[r] }} title={NOMBRE_RECURSO[r]}>{COSTO[t][r]}</i>
                    ))}
                  </span>
                  <span className="quedan">quedan {quedan}</span>
                </button>
              );
            })}
            {construyendo && <button className="cons cancelar" onClick={() => setConstruyendo(null)}>✕</button>}
          </div>
        )}
        {cambio && puedoConstruir && (
          <div className="modal">
            <div className="modal-caja">
              <div className="modal-cab">
                <div className="pestanas">
                  <button className={pestana === 'jugadores' ? 'on' : ''} onClick={() => setPestana('jugadores')}>Comercio con jugadores</button>
                  <button className={pestana === 'banco' ? 'on' : ''} onClick={() => setPestana('banco')}>Comercio con el banco</button>
                </div>
                <label className="bloq">
                  <input type="checkbox" checked={bloqueado} onChange={(e) => cambiarBloqueo(e.target.checked)} /> No recibir ofertas
                </label>
                <button className="cerrar" onClick={() => setCambio(false)} aria-label="Cerrar">✕</button>
              </div>
              {pestana === 'jugadores' ? (
                <div>
                  <h3>Comercio con jugadores</h3>
                  <div className="fila-cartas">
                    <div className="etiqueta">Pido a los demás</div>
                    {RECURSOS.map((r) => (
                      <Carta key={r} tipo={r} valor={ofPide[r]} max={9} apagada={ofDa[r] > 0} onCambio={(n) => setOfPide({ ...ofPide, [r]: n })} />
                    ))}
                  </div>
                  <div className="fila-cartas">
                    <div className="etiqueta">Doy yo</div>
                    {RECURSOS.map((r) => (
                      <Carta key={r} tipo={r} valor={ofDa[r]} max={mano[r]} apagada={ofPide[r] > 0 || mano[r] === 0} onCambio={(n) => setOfDa({ ...ofDa, [r]: n })} />
                    ))}
                  </div>
                  {choque && <p className="nota">No puedes pedir y dar el mismo recurso.</p>}
                  {todosBloquean && <p className="nota">Todos los jugadores tienen bloqueados los intercambios.</p>}
                  {miOferta ? (
                    <p className="nota">Oferta enviada ⏳ Respondieron {Object.keys(miOferta.rechazos).length} de {otros.length} (rechazaron). El primero que acepte hace el cambio.</p>
                  ) : (
                    <p className="nota">Arma tu oferta con + y − y envíala. El primer jugador que la acepte hace el cambio contigo.</p>
                  )}
                  <div className="acc-modal">
                    <button className="ok" disabled={!puedeOfrecer} onClick={() => void enviarOferta()}>✔ Enviar oferta</button>
                    {miOferta && <button className="no" onClick={() => void quitarOferta()}>✕ Cancelar oferta</button>}
                    <button className="ojo" onClick={() => setCambio(false)}>👁 Ocultar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3>Comercio con el banco</h3>
                  <div className="fila-cartas">
                    <div className="etiqueta">Recibo 1 de</div>
                    {RECURSOS.map((r) => (
                      <button key={r} className={recibo === r ? 'cartab on' : 'cartab'} style={{ background: COLOR[r] }} disabled={doy === r} onClick={() => setRecibo(r)}>
                        <IconoRecurso tipo={r} />
                        <small>{NOMBRE_RECURSO[r]}</small>
                      </button>
                    ))}
                  </div>
                  <div className="fila-cartas">
                    <div className="etiqueta">Doy</div>
                    {RECURSOS.map((r) => (
                      <button key={r} className={doy === r ? 'cartab on' : 'cartab'} style={{ background: COLOR[r] }} disabled={mano[r] < tasas[r] || recibo === r} onClick={() => setDoy(r)}>
                        <IconoRecurso tipo={r} />
                        <b className="cnt">{mano[r]}</b>
                        <small>{tasas[r]}:1</small>
                      </button>
                    ))}
                  </div>
                  <p className="nota">
                    {doy && recibo
                      ? 'Das ' + tasas[doy] + ' de ' + NOMBRE_RECURSO[doy] + ' y recibes 1 de ' + NOMBRE_RECURSO[recibo] + '.'
                      : 'Tasa normal 4:1. Con un puerto general 3:1, y con el puerto de un recurso 2:1. Solo se pueden dar los recursos que te alcanzan.'}
                  </p>
                  <div className="acc-modal">
                    <button className="ok" disabled={!doy || !recibo || doy === recibo || mano[doy] < tasas[doy]} onClick={hacerBanco}>✔ Cambiar con el banco</button>
                    <button className="ojo" onClick={() => setCambio(false)}>👁 Ocultar</button>
                  </div>
                </div>
              )}
              {error && <div className="error-mini">{error}</div>}
            </div>
          </div>
        )}
        {ofertaEntrante && (
          <div className="oferta-in">
            <div><b>{nombreDe(ofertaEntrante.de)}</b> ofrece <Cantidades c={ofertaEntrante.da} /> por <Cantidades c={ofertaEntrante.pide} /></div>
            <div className="acc-modal">
              <button className="ok" disabled={!alcanzaOferta} onClick={() => void aceptarOferta()}>Aceptar</button>
              <button className="no" onClick={() => void rechazarOferta()}>Rechazar</button>
            </div>
            {!alcanzaOferta && <small>No tienes las cartas que piden.</small>}
          </div>
        )}
        {miOferta && !cambio && (
          <div className="oferta-in propia">
            <div>Tu oferta: <Cantidades c={miOferta.da} /> por <Cantidades c={miOferta.pide} /> ⏳</div>
            <div className="acc-modal">
              <button className="no" onClick={() => void quitarOferta()}>Cancelar oferta</button>
              <button className="ojo" onClick={() => setCambio(true)}>Ver</button>
            </div>
          </div>
        )}
        {panel === 'cartas' && (
          <div className="panel panel-cartas">
            <h3>Mis cartas de desarrollo</h3>
            {misCartas.length === 0 && <p>Todavía no tienes cartas. Compra una con el botón Carta en tu turno.</p>}
            {misCartas.map((c) => (
              <div key={c.id} className={'carta-fila t-' + c.tipo}>
                <div>
                  <b>{NOMBRE_CARTA[c.tipo]}</b>
                  <small>{DESCRIPCION_CARTA[c.tipo]}</small>
                  {c.turno >= juego.rondaTurno && c.tipo !== 'punto' && <small>Podrás usarla en tu próximo turno.</small>}
                </div>
                {c.tipo === 'punto' ? (
                  <span className="oculta">oculta</span>
                ) : (
                  <button className="ok" disabled={!puedeJugar(c)} onClick={() => (c.tipo === 'monopolio' || c.tipo === 'abundancia' ? setUsando(c) : jugarYa(c, {}))}>Jugar</button>
                )}
              </div>
            ))}
            <p className="nota">Solo puedes jugar 1 carta por turno, y no la que compraste en ese mismo turno.</p>
          </div>
        )}
        {enDescartar && debo > 0 && (
          <div className="modal">
            <div className="modal-caja">
              <h3>🐋 Salió 7: descarta {debo} cartas</h3>
              <p className="nota">Elige exactamente {debo}. Seleccionadas: {suma5(selDescarte)} de {debo}.</p>
              <div className="fila-cartas">
                {RECURSOS.map((r) => (
                  <Carta key={r} tipo={r} valor={selDescarte[r]} max={Math.min(mano[r], selDescarte[r] + debo - suma5(selDescarte))} onCambio={(n) => setSelDescarte({ ...selDescarte, [r]: n })} />
                ))}
              </div>
              <div className="acc-modal">
                <button className="ok" disabled={suma5(selDescarte) !== debo} onClick={descartarYa}>✔ Descartar</button>
              </div>
              {error && <div className="error-mini">{error}</div>}
            </div>
          </div>
        )}
        {enRobar && soyActual && (
          <div className="modal">
            <div className="modal-caja">
              <h3>¿A quién le robas una carta?</h3>
              <div className="victimas">
                {juego.victimas.map((id) => (
                  <button key={id} className="victima" style={{ borderColor: colorJ(id) }} onClick={() => robarAlguien(id)}>
                    <span className="punto" style={{ background: colorJ(id) }} />
                    <b>{nombreDe(id)}</b>
                    <small>{juego.stats[id]?.cartas ?? 0} cartas</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {confirmarCarta && (
          <div className="modal">
            <div className="confirma">
              <div className="confirma-texto">
                <h3>Comprar carta de desarrollo</h3>
                <p>¿Quieres comprar una carta de desarrollo?</p>
                <div className="cons-costo">
                  {RECURSOS.filter((r) => COSTO_CARTA[r]).map((r) => (
                    <span key={r} className="cant">
                      <IconoRecurso tipo={r} />
                      <b>×{COSTO_CARTA[r]}</b>
                    </span>
                  ))}
                </div>
              </div>
              <div className="confirma-botones">
                <button className="vx" onClick={() => setConfirmarCarta(false)} aria-label="Cancelar">✕</button>
                <button className="vv" onClick={comprarYa} aria-label="Comprar">✔</button>
              </div>
            </div>
          </div>
        )}
        {cartaNueva && (
          <div className="modal" onClick={() => setCartaNueva(null)}>
            <div className={'carta-grande t-' + cartaNueva.tipo}>
              <small>Compraste</small>
              <h3>{NOMBRE_CARTA[cartaNueva.tipo]}</h3>
              <p>{DESCRIPCION_CARTA[cartaNueva.tipo]}</p>
              <button className="ok" onClick={() => setCartaNueva(null)}>Entendido</button>
            </div>
          </div>
        )}
        {usando && (
          <div className="modal">
            <div className="modal-caja">
              <h3>{NOMBRE_CARTA[usando.tipo]}</h3>
              {usando.tipo === 'monopolio' ? (
                <div>
                  <p className="nota">Elige el recurso que quieres quitarles a todos.</p>
                  <div className="fila-cartas">
                    {RECURSOS.map((r) => (
                      <button key={r} className={elegidos[0] === r ? 'cartab on' : 'cartab'} style={{ background: COLOR[r] }} onClick={() => setElegidos([r])}>
                        <IconoRecurso tipo={r} />
                        <small>{NOMBRE_RECURSO[r]}</small>
                      </button>
                    ))}
                  </div>
                  <div className="acc-modal">
                    <button className="ok" disabled={elegidos.length !== 1} onClick={() => jugarYa(usando, { recurso: elegidos[0] })}>✔ Usar Monopolio</button>
                    <button className="no" onClick={() => { setUsando(null); setElegidos([]); }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="nota">Elige 2 recursos del banco (pueden ser iguales). Elegidos: {elegidos.length ? elegidos.map((r) => NOMBRE_RECURSO[r]).join(' y ') : 'ninguno'}.</p>
                  <div className="fila-cartas">
                    {RECURSOS.map((r) => (
                      <button key={r} className="cartab" style={{ background: COLOR[r] }} disabled={elegidos.length >= 2} onClick={() => setElegidos([...elegidos, r])}>
                        <IconoRecurso tipo={r} />
                        <small>{NOMBRE_RECURSO[r]}</small>
                      </button>
                    ))}
                  </div>
                  <div className="acc-modal">
                    <button className="ok" disabled={elegidos.length !== 2} onClick={() => jugarYa(usando, { recursos: elegidos })}>✔ Tomar</button>
                    <button className="ojo" onClick={() => setElegidos([])}>Borrar</button>
                    <button className="no" onClick={() => { setUsando(null); setElegidos([]); }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {enFin && (
          <div className="modal">
            <div className="modal-caja final">
              <h2>🏆 {juego.ganador ? nombreDe(juego.ganador) : 'Alguien'} ganó la partida</h2>
              <div className="orden-lista">
                {[...juego.orden]
                  .sort((a, b) => puntosTotales(sala, juego, b) - puntosTotales(sala, juego, a))
                  .map((id) => {
                    const ocultos = (sala.cartas?.[id] ?? []).filter((c) => c.tipo === 'punto').length;
                    return (
                      <div key={id} className="orden-fila">
                        <span className="punto" style={{ background: colorJ(id) }} />
                        <span className="orden-nombre">{nombreDe(id)}{id === juego.ganador ? ' 🏆' : ''}</span>
                        <span className="orden-valor">{puntosTotales(sala, juego, id)} puntos{ocultos ? ' (' + ocultos + ' ocultos)' : ''}</span>
                      </div>
                    );
                  })}
              </div>
              <div className="acc-modal">
                <button className="ojo" onClick={onSalir}>Salir</button>
              </div>
            </div>
          </div>
        )}
        {panel === 'chat' && hayChat && (
          <div className="panel panel-chat">
            <h3>Chat</h3>
            <div className="chat-mensajes">
              {Object.values(sala.chat ?? {}).sort((a, b) => a.ts - b.ts).map((m, i) => (
                <div key={i} className={m.uid === uid ? 'chat-msg yo' : 'chat-msg'}>
                  <b style={{ color: colorJ(m.uid) }}>{m.nombre}:</b> {m.texto}
                </div>
              ))}
            </div>
            <div className="chat-rapidos">
              {['🏴‍☠️', '👉⏱️', '😂', '😠', '🤔', '😢'].map((e) => (
                <button key={e} onClick={() => void enviarMensaje(codigo, uid, sala.jugadores?.[uid]?.nombre ?? 'Jugador', e)}>{e}</button>
              ))}
            </div>
            <form className="chat-form" onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('msg') as HTMLInputElement).value; void enviarMensaje(codigo, uid, sala.jugadores?.[uid]?.nombre ?? 'Jugador', v); (e.currentTarget.elements.namedItem('msg') as HTMLInputElement).value = ''; }}>
              <input name="msg" type="text" placeholder="Mensaje..." maxLength={200} />
              <button type="submit">Enviar</button>
            </form>
          </div>
        )}
      </div>

      <div className="pie" style={{ background: miColor, color: textoMio }}>
        <div className="pie-izq">
          <div className="dados">
            <Dado valor={valores[0]} rodando={rodando} />
            <Dado valor={valores[1]} rodando={rodando} />
          </div>
          <div className="acciones">
            {!rodando && juego.dados && (
              <div className="suma">
                {juego.quien ? nombreDe(juego.quien) + ' sacó ' : 'Salió '}{suma}{suma === 7 && !enOrden ? ' 🐋' : ''}
              </div>
            )}
            {yoPuedoLanzarOrden && <button className="accion" onClick={() => void lanzarOrden()}>🎲 Lanzar mis dados</button>}
            {enOrden && !yoPuedoLanzarOrden && <span className="espera">Esperando a los demás...</span>}
            {juego.fase === 'tirar' && soyActual && <button className="accion" onClick={() => void tirar()}>🎲 Tirar dados</button>}
            {juego.fase === 'accion' && soyActual && <button className="accion" onClick={() => void terminar()}>Terminar turno ➜</button>}
            {(juego.fase === 'tirar' || juego.fase === 'accion') && !soyActual && <span className="espera">Esperando a {nombreDe(actualUid)}...</span>}
            {enColocacion && !soyActual && <span className="espera">Esperando a {nombreDe(actualUid)}...</span>}
            {error && <div className="error-mini">{error}</div>}
          </div>
        </div>
        <div className="recursos">
          {RECURSOS.map((r) => (
            <div key={r} className="rec" title={NOMBRE_RECURSO[r]}>
              <IconoRecurso tipo={r} />
              <b>{mano[r]}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
