import { useEffect, useMemo, useRef, useState } from 'react';
import { get, ref } from 'firebase/database';
import { db } from './firebase';
import { COLORES, actualizarRegistroMaquina, actualizarRanking } from './salas';
import type { Sala } from './salas';
import { esBotJugador, caminoInicial, decidirAccion, elegirDescarte, elegirHexLadron, elegirVictima, manoDeBot, pobladoInicial } from './bots';
import { aceptarCambio, ahoraServidor, bloquearCambios, cambiarConBanco, cancelarCambio, comprarDesarrollo, construirPieza, descartarCartas, lanzarDadosOrden, mandarLadron, ponerCamino, ponerPoblado, proponerCambio, rechazarCambio, robarCartaA, terminarTurno, tiempoAgotado, tirarDados, usarCarta } from './turnos';
import { enviarMensaje } from './salas';
import { COSTO, COSTO_CARTA, DESCRIPCION_CARTA, LIMITE, NOMBRE_CARTA, NOMBRE_RECURSO, RECURSOS, caminosDePoblado, completar, contarPiezas, jugadorActual, lugaresPara, manoVacia, pendientesOrden, puedePagar, puntosTotales, tasasDe, verticesLibres } from './reglas';
import type { CartaDes, ParamCarta, Recurso, Recursos, TipoPieza } from './reglas';
import { COLOR, ballena, geometriaDe, mapaDe, posicion } from './tablero';
import Juego from './Juego';
import type { CartaVuelo } from './vista3d/vuelo3d';
import type { PiezasVista } from './vista3d/piezas3d';
import type { Control3D } from './vista3d/escena';
import * as sonido from './sonido';
import type { ModoSonido } from './sonido';
import Mesa from './Mesa';
import { Cantidades, Carta, FormaCiudad, FormaPoblado, IconoRecurso, listones } from './piezas';
import './partida.css';

type Props = { sala: Sala; uid: string; codigo: string; onSalir: () => void; onActualizar?: (s: Sala) => void };
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

const DURACIONES = { pulso: 600, subida: 300, pausa: 500, viaje: 600, escalon: 150 };

const SVG_ICONOS_RECURSO: Record<string, string> = {
  wood: '<g stroke-width="1.5" stroke="#5a3b1e"><rect x="3" y="28" width="32" height="11" rx="5.5" fill="#8a5a2b"/><circle cx="33" cy="33.5" r="5.5" fill="#ecc88e"/><circle cx="33" cy="33.5" r="2.2" fill="none" stroke="#b98a4a"/><rect x="9" y="16" width="32" height="11" rx="5.5" fill="#a06a33"/><circle cx="39" cy="21.5" r="5.5" fill="#f3d9a6"/><circle cx="39" cy="21.5" r="2.2" fill="none" stroke="#b98a4a"/><rect x="5" y="5" width="30" height="10" rx="5" fill="#8a5a2b"/><circle cx="33" cy="10" r="5" fill="#ecc88e"/></g>',
  brick: '<g stroke-width="1.5" stroke="#7a1f1a"><rect x="3" y="30" width="20" height="11" rx="2" fill="#d6453d"/><rect x="25" y="30" width="20" height="11" rx="2" fill="#c93a32"/><rect x="14" y="18" width="20" height="11" rx="2" fill="#e0574e"/><rect x="14" y="6" width="20" height="11" rx="2" fill="#d6453d"/><path d="M6 33h14M28 33h14M17 21h14M17 9h14" stroke="#f4a29b" stroke-width="1.5"/></g>',
  wool: '<g><path d="M15 36v8M31 36v8" stroke="#3b2a14" stroke-width="3.5" stroke-linecap="round"/><g fill="#fffdf4" stroke="#b8c0a0" stroke-width="1.2"><circle cx="16" cy="24" r="10"/><circle cx="27" cy="21" r="10"/><circle cx="23" cy="31" r="9"/></g><ellipse cx="39" cy="26" rx="5.5" ry="6.5" fill="#3b2a14"/><circle cx="40" cy="24" r="1.3" fill="#fffdf4"/></g>',
  grain: '<g><path d="M24 45V13" stroke="#9a7a1c" stroke-width="2.6" stroke-linecap="round"/><g fill="#f2c23c" stroke="#b98a14" stroke-width="1"><ellipse cx="24" cy="7" rx="3.6" ry="6"/><ellipse cx="17" cy="15" rx="3.6" ry="6.5" transform="rotate(-28 17 15)"/><ellipse cx="31" cy="15" rx="3.6" ry="6.5" transform="rotate(28 31 15)"/><ellipse cx="17" cy="26" rx="3.6" ry="6.5" transform="rotate(-28 17 26)"/><ellipse cx="31" cy="26" rx="3.6" ry="6.5" transform="rotate(28 31 26)"/><ellipse cx="18" cy="37" rx="3.6" ry="6" transform="rotate(-28 18 37)"/><ellipse cx="30" cy="37" rx="3.6" ry="6" transform="rotate(28 30 37)"/></g></g>',
  ore: '<g><ellipse cx="24" cy="42" rx="14" ry="3.5" fill="#1d1f26"/><path d="M14 42L22 7M34 42L26 7" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M14 42L22 7M34 42L26 7" stroke="#4b5160" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M17 33H31M19 24H29M20.5 15H27.5" stroke="#4b5160" stroke-width="1.6" fill="none"/><rect x="19" y="3" width="10" height="6" rx="1.5" fill="#4b5160" stroke="#ffffff" stroke-width="1.3"/><circle cx="24" cy="0" r="2.6" fill="#e8607f" stroke="#ffffff" stroke-width="0.8"/></g>',
};

const COLOR_FONDO_RECURSO: Record<string, string> = {
  wood: '#d4ebd4',
  brick: '#f5d6cc',
  wool: '#e2f0d9',
  grain: '#fef3c7',
  ore: '#e2e8f0',
};

function traducirRecurso(r: string): Recurso {
  const map: Record<string, Recurso> = {
    wood: 'wood', madera: 'wood',
    brick: 'brick', ladrillo: 'brick',
    wool: 'wool', oveja: 'wool', lana: 'wool',
    grain: 'grain', trigo: 'grain',
    ore: 'ore', mineral: 'ore',
  };
  const key = (r || '').toLowerCase();
  if (map[key]) return map[key];
  if (RECURSOS.includes(key as Recurso)) return key as Recurso;
  console.warn('sin ícono para', r);
  return 'wood';
}

function obtenerCapa(): HTMLElement {
  let capa = document.getElementById('capa-cartas');
  if (!capa) {
    capa = document.createElement('div');
    capa.id = 'capa-cartas';
    Object.assign(capa.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100vw', height: '100vh',
      pointerEvents: 'none', zIndex: '2147483647'
    });
    document.body.appendChild(capa);
  }
  return capa;
}

async function volarCarta({ recurso, origen, destino, conSubida = true, reverso = false, prod }: { recurso: string; origen: HTMLElement | null; destino: HTMLElement | null; conSubida?: boolean; reverso?: boolean; prod?: { uid: string; recurso: string } }) {
  try {
    const capa = obtenerCapa();

    let origEl = origen;
    if (!origEl && prod) {
      origEl = (document.querySelector('[data-mesa-jugador="' + prod.uid + '"]') as HTMLElement | null) ||
               (document.querySelector('[data-jugador="' + prod.uid + '"][data-recurso="' + prod.recurso + '"]') as HTMLElement | null) ||
               (document.querySelector('[data-jugador="' + prod.uid + '"]') as HTMLElement | null) ||
               (document.querySelector('[data-mano="' + prod.uid + '"]') as HTMLElement | null);
    }

    let destEl = destino;
    if (!destEl && prod) {
      destEl = (document.querySelector('[data-mesa-jugador="' + prod.uid + '"]') as HTMLElement | null) ||
               (document.querySelector('[data-jugador="' + prod.uid + '"][data-recurso="' + prod.recurso + '"]') as HTMLElement | null) ||
               (document.querySelector('[data-jugador="' + prod.uid + '"]') as HTMLElement | null) ||
               (document.querySelector('[data-mano="' + prod.uid + '"]') as HTMLElement | null);
    }
    destEl = destEl || document.body;
    origEl = origEl || document.body;

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    console.log('ORIGEN/DESTINO', origEl, destEl, origEl?.getBoundingClientRect(), destEl?.getBoundingClientRect());

    if (!origEl || !destEl) {
      console.warn('volarCarta cancelada', { origen: origEl, destino: destEl, prod });
      return;
    }

    const rectO2 = origEl.getBoundingClientRect();
    const rectD2 = destEl.getBoundingClientRect();
    const x0 = rectO2.left + rectO2.width / 2;
    const y0 = rectO2.top + rectO2.height / 2;
    const x1 = rectD2.left + rectD2.width / 2;
    const y1 = rectD2.top + rectD2.height / 2;

    const tipoRec = traducirRecurso(recurso);
    const bgColor = reverso ? '#8a2a2a' : (COLOR_FONDO_RECURSO[tipoRec] ?? '#f3e6c4');
    const svgContent = reverso 
      ? '<rect width="48" height="48" fill="#b33939" opacity="0.6"/><path d="M0 0l48 48M48 0L0 48" stroke="#8a5a2b" stroke-width="2"/>'
      : (SVG_ICONOS_RECURSO[tipoRec] ?? SVG_ICONOS_RECURSO['wood']);

    const carta = document.createElement('div');
    carta.style.cssText = `position:absolute;left:0;top:0;width:52px;height:72px;background:${bgColor};border:1px solid #8a5a2b;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:1;z-index:2147483647;pointer-events:none;overflow:hidden;`;
    
    carta.innerHTML = `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">${svgContent}</svg>`;

    capa.appendChild(carta);
    console.log('CARTA DOM', carta.getBoundingClientRect(), getComputedStyle(carta).opacity, getComputedStyle(carta).display, origen, destEl);

    if (conSubida) {
      const anim1 = carta.animate([
        { transform: `translate(${x0 - 26}px, ${y0 - 36}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x0 - 26}px, ${y0 - 36 - 30}px) scale(1)`, opacity: 1 }
      ], { duration: DURACIONES.subida, fill: 'forwards', easing: 'ease-out' });
      await anim1.finished;
      await new Promise((r) => setTimeout(r, DURACIONES.pausa));
    }

    const startX = x0 - 26;
    const startY = conSubida ? y0 - 36 - 30 : y0 - 36;
    const endX = x1 - 26;
    const endY = y1 - 36;

    const anim2 = carta.animate([
      { transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 1 },
      { transform: `translate(${endX}px, ${endY}px) scale(0.8)`, opacity: 1 }
    ], { duration: DURACIONES.viaje, fill: 'forwards', easing: 'ease-in-out' });
    await anim2.finished;

    carta.remove();
    console.log('CARTA LLEGO', recurso);
  } catch (err) {
    console.error('Error en volarCarta:', err);
  }
}

async function pulsoHexagonos(hexIds: string[]) {
  const capa = obtenerCapa();
  const anillos: HTMLElement[] = [];
  for (const hexId of hexIds) {
    const hex = document.querySelector('[data-hex="' + hexId + '"]');
    if (!hex) continue;
    const r = (hex as HTMLElement).getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const anillo = document.createElement('div');
    anillo.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.8);transform:translate(-50%,-50%) scale(1);pointer-events:none;`;
    capa.appendChild(anillo);
    anillos.push(anillo);
    anillo.animate([
      { transform: 'translate(-50%,-50%) scale(0.1)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(1.06)', opacity: 0.6 },
      { transform: 'translate(-50%,-50%) scale(2.5)', opacity: 0 }
    ], { duration: DURACIONES.pulso, fill: 'forwards', easing: 'ease-out' });
  }
  await new Promise((r) => setTimeout(r, DURACIONES.pulso));
  anillos.forEach((a) => a.remove());
}


export default function Partida({ sala, uid, codigo, onSalir, onActualizar }: Props) {
  const partida = sala.partida;
  const juego = useMemo(() => (sala.juego ? completar(sala.juego) : null), [sala.juego]);
  const modo = partida?.modo;
  const semilla = partida?.semilla;
  const geo = useMemo(() => (modo && semilla !== undefined ? geometriaDe(modo, semilla) : null), [modo, semilla]);

  // Evento 3D para la tirada de dados y el vuelo de cartas.
  const [evento3d, setEvento3d] = useState<{ id: number; dados: [number, number]; cartas: CartaVuelo[] } | null>(null);
  const ultimoDado = useRef<string | null>(null);

  // "Foto" de las piezas para la vista 3D: mismos datos que el SVG, con el
  // color ya resuelto de cada jugador.
  const piezas3d = useMemo<PiezasVista | null>(() => {
    if (!juego || !geo) return null;
    const colores: Record<string, string> = {};
    for (const id of juego.orden) colores[id] = colorDe(sala.jugadores?.[id]?.color ?? '');
    return { poblados: juego.poblados, caminos: juego.caminos, colores, ladron: juego.ladron };
  }, [juego, geo, sala.jugadores]);

  // Dispara la animación 3D cuando cambian los dados: primero ruedan los dados,
  // y al terminar vuelan las cartas de los hexágonos productores a cada mano.
  useEffect(() => {
    if (!juego?.dados || !geo || !partida) return;
    const clave = (juego.tirada ?? 0) + ':' + juego.dados.join(',');
    if (ultimoDado.current === clave) return;
    const primera = ultimoDado.current === null;
    ultimoDado.current = clave;
    if (primera) return; // Al cargar una partida en marcha no animar

    const mapa = mapaDe(partida?.modo ?? 'p', partida?.semilla ?? 0);
    const suma = juego.dados[0] + juego.dados[1];
    const cartas: CartaVuelo[] = [];
    for (const [v, p] of Object.entries(juego.poblados)) {
      const verts = geo.vertices[v];
      if (!verts) continue;
      const n = p.tipo === 'ciudad' ? 2 : 1;
      for (const [r, c] of verts.hexes) {
        const h = mapa.hexes.find((x) => x.r === r && x.c === c);
        if (!h || h.tipo === 'desert' || h.num !== suma || r + ',' + c === juego.ladron) continue;
        const chip = (typeof document !== 'undefined') ? document.querySelector('[data-mano="' + p.uid + '"]') : null;
        let destino: [number, number] = [0, -0.85];
        if (chip) {
          const rc = (chip as HTMLElement).getBoundingClientRect();
          destino = [(rc.left + rc.width / 2) / window.innerWidth * 2 - 1, 1 - (rc.top + rc.height / 2) / window.innerHeight * 2];
        }
        for (let i = 0; i < n; i++) cartas.push({ hex: r + ',' + c, recurso: h.tipo, destino });
      }
    }
    setEvento3d({ id: Date.now(), dados: juego.dados, cartas });
  }, [juego?.dados, juego?.tirada, juego?.fase, geo, partida?.modo ?? 'p', partida?.semilla ?? 0]);

  const bots = useMemo(
    () => Object.keys(sala.jugadores ?? {}).filter((id) => esBotJugador(sala.jugadores, id)),
    [sala.jugadores],
  );
  const hayJuego = !!juego && !!partida;
  const reloj = sala.config?.reloj ?? 60;
  const hayChat = sala.config?.chat !== false;
  const tirada = juego?.tirada ?? 0;
  const inicio = juego?.inicioTurno ?? 0;
  const numTurno = juego?.numTurno ?? 0;
  const actualUid = juego ? jugadorActual(juego) : '';
  const soyBot = esBotJugador(sala.jugadores, uid);
  const soyActual = actualUid === uid && !soyBot;
  const soyAnfitrion = sala.anfitrion === uid;

  const [rodando, setRodando] = useState(false);
  const [azar, setAzar] = useState<[number, number]>([1, 1]);
  const [restante, setRestante] = useState<number>(reloj);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>('ninguno');
  const [construyendo, setConstruyendo] = useState<TipoPieza | null>(null);
  const [pendiente, setPendiente] = useState<{ tipo: 'poblado' | 'camino'; id: string } | null>(null);
  const [bloqueadoAnim, setBloqueadoAnim] = useState(false);
  const [popRecurso, setPopRecurso] = useState<string | null>(null);
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
  const control3dRef = useRef<Control3D | null>(null);
  const manoReal = useMemo(() => ({ ...manoVacia(), ...(sala.manos?.[uid] ?? {}) }), [sala.manos, uid]);
  const [manoMostrada, setManoMostrada] = useState<Recursos>(manoReal);
  const animandoRoll = useRef(false);
  const ultimoCambioLocal = useRef(0);

  useEffect(() => {
    if (tirada === tiradaVista.current) return;
    tiradaVista.current = tirada;
    sonido.dados();
    setRodando(true);
    animandoRoll.current = true;
    setBloqueadoAnim(true);
    const intervalo = window.setInterval(() => setAzar([dado6(), dado6()]), 90);
    const dadosFinVal = juego?.dados ?? [1, 1];
    control3dRef.current?.dados(dadosFinVal, () => {});

    const run = async () => {
      // 1. Dados ruedan (2s)
      await new Promise((r) => window.setTimeout(r, 2000));
      window.clearInterval(intervalo);
      setRodando(false);

      const suma = dadosFinVal[0] + dadosFinVal[1];
      if (suma === 7 || !juego || !geo || !partida) {
        setManoMostrada(manoReal);
        setBloqueadoAnim(false);
        animandoRoll.current = false;
        return;
      }

      const mapa = mapaDe(partida.modo, partida.semilla);
      const sumas = suma === 2 || suma === 12 ? [2, 12] : [suma];

      // 2. Calcular producción (sin aplicar)
      const producciones: { hex: string; recurso: string; uid: string }[] = [];
      const hexesProductores = new Set<string>();
      sumas.forEach((sm) => {
        mapa.hexes.forEach((h) => {
          if (h.num !== sm || (h.r + ',' + h.c) === juego.ladron || h.tipo === 'desert') return;
          const vertices = Object.entries(geo.vertices).filter(([_, v]) => (v.hexes ?? []).some(([r, c]) => r === h.r && c === h.c));
          vertices.forEach(([vid]) => {
            const pieza = juego.poblados[vid];
            if (!pieza) return;
            const n = pieza.tipo === 'ciudad' ? 2 : 1;
            for (let i = 0; i < n; i++) {
              producciones.push({ hex: h.r + ',' + h.c, recurso: h.tipo, uid: pieza.uid });
              hexesProductores.add(h.r + ',' + h.c);
            }
          });
        });
      });

      console.log('PRODUCCION', producciones);

      if (producciones.length === 0) {
        setManoMostrada(manoReal);
        setBloqueadoAnim(false);
        animandoRoll.current = false;
        return;
      }

      // 3. Pulso en hexágonos (ripple) ~600ms
      await pulsoHexagonos(Array.from(hexesProductores));

      // 4-6. Por cada producción: carta emerge, pausa, vuela, y al llegar suma +1
      const tareas = producciones.map((prod, idx) => async () => {
        await new Promise((r) => setTimeout(r, idx * DURACIONES.escalon));
        const hexEl = document.querySelector('[data-hex="' + prod.hex + '"]') as HTMLElement | null;
        const destEl = (prod.uid === uid)
          ? document.querySelector('[data-jugador="' + prod.uid + '"][data-recurso="' + prod.recurso + '"]') as HTMLElement | null
          : document.querySelector('[data-jugador="' + prod.uid + '"]') as HTMLElement | null;
        await volarCarta({ recurso: prod.recurso, origen: hexEl, destino: destEl, conSubida: true, prod });

        if (prod.uid === uid) {
          setManoMostrada((prev) => ({
            ...prev,
            [prod.recurso as Recurso]: ((prev as any)[prod.recurso] ?? 0) + 1,
          }));
        }

        // Al llegar: suma +1 con pop
        setPopRecurso(prod.recurso);
        window.setTimeout(() => setPopRecurso(null), 400);
      });

      await Promise.all(tareas.map((t) => t()));

      // 7. Actualizar contadores
      setManoMostrada(manoReal);
      setBloqueadoAnim(false);
      animandoRoll.current = false;
    };

    run();

    return () => {
      window.clearInterval(intervalo);
      animandoRoll.current = false;
    };
  }, [tirada]);

  useEffect(() => {
    setManoMostrada(manoReal);
  }, [manoReal]);

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

  const prevManosRef = useRef(sala.manos ?? {});
  useEffect(() => {
    if (!sala.manos || !juego) return;
    if (juego.fase !== 'mover' && juego.fase !== 'robar') {
      prevManosRef.current = sala.manos;
      return;
    }
    const prev = prevManosRef.current;
    const curr = sala.manos;

    let thief: string | null = null;
    let victim: string | null = null;
    let recursoRobado: Recurso | null = null;

    for (const id of juego.orden) {
      const prevM = prev[id] ?? {};
      const currM = curr[id] ?? {};
      for (const r of RECURSOS) {
        const diff = (currM[r] ?? 0) - (prevM[r] ?? 0);
        if (diff === 1) thief = id;
        if (diff === -1) {
          victim = id;
          recursoRobado = r;
        }
      }
    }

    if (thief && victim && recursoRobado && thief !== victim) {
      const origenEl = (document.querySelector('[data-mesa-jugador="' + victim + '"]') as HTMLElement | null) ||
                        (document.querySelector('[data-jugador="' + victim + '"][data-recurso="' + recursoRobado + '"]') as HTMLElement | null) ||
                        (document.querySelector('[data-jugador="' + victim + '"]') as HTMLElement | null) ||
                        (document.querySelector('[data-mano="' + victim + '"]') as HTMLElement | null);
      const destinoEl = (document.querySelector('[data-mano="' + thief + '"]') as HTMLElement | null) ||
                        (document.querySelector('[data-mesa-jugador="' + thief + '"]') as HTMLElement | null) ||
                        (document.querySelector('[data-jugador="' + thief + '"][data-recurso="' + recursoRobado + '"]') as HTMLElement | null) ||
                        (document.querySelector('[data-jugador="' + thief + '"]') as HTMLElement | null);

      if (victim === uid) {
        setManoMostrada((prevM) => ({
          ...prevM,
          [recursoRobado!]: Math.max(0, (prevM[recursoRobado!] ?? 0) - 1),
        }));
      }

      animandoRoll.current = true;
      void (async () => {
        try {
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          await volarCarta({
            recurso: recursoRobado!,
            origen: origenEl as HTMLElement,
            destino: destinoEl as HTMLElement,
            conSubida: false,
            reverso: true,
            prod: { uid: thief, recurso: recursoRobado! }
          });

          if (thief === uid) {
            setManoMostrada((prevM) => ({
              ...prevM,
              [recursoRobado!]: (prevM[recursoRobado!] ?? 0) + 1,
            }));
          }
        } finally {
          animandoRoll.current = false;
          setManoMostrada(manoReal);
        }
      })();
    }

    prevManosRef.current = curr;
  }, [sala.manos, juego, uid]);



  const prevManosDescRef = useRef(sala.manos ?? {});
  useEffect(() => {
    if (!sala.manos || !juego) return;
    if (juego.fase !== 'descartar') {
      prevManosDescRef.current = sala.manos;
      return;
    }
    const prev = prevManosDescRef.current;
    const curr = sala.manos;

    for (const id of juego.orden) {
      const prevM = prev[id] ?? {};
      const currM = curr[id] ?? {};
      for (const r of RECURSOS) {
        const diff = (prevM[r] ?? 0) - (currM[r] ?? 0);
        if (diff > 0) {
          void (async () => {
            const ladronEl = document.querySelector('[data-ladron]') || document.body;
            for (let i = 0; i < diff; i++) {
              await new Promise((res) => setTimeout(res, i * DURACIONES.escalon));
              const origenEl = document.querySelector('[data-jugador="' + id + '"][data-recurso="' + r + '"]') || document.querySelector('[data-mano="' + id + '"]');

              if (id === uid) {
                setManoMostrada((prevM) => ({
                  ...prevM,
                  [r]: Math.max(0, (prevM[r] ?? 0) - 1),
                }));
              }

              animandoRoll.current = true;
              try {
                await volarCarta({
                  recurso: r,
                  origen: origenEl as HTMLElement,
                  destino: ladronEl as HTMLElement,
                  conSubida: true,
                  reverso: id !== uid,
                  prod: { uid: id, recurso: r }
                });
              } finally {
                animandoRoll.current = false;
                setManoMostrada(manoReal);
              }
            }
          })();
        }
      }
    }

    prevManosDescRef.current = curr;
  }, [sala.manos, juego, uid]);

  const conocidosPoblados = useRef<Set<string>>(new Set(Object.keys(juego?.poblados ?? {})));
  const prevPobladosLen = useRef(Object.keys(juego?.poblados ?? {}).length);
  useEffect(() => {
    if (!juego || !geo || !partida) return;
    const currVerts = Object.keys(juego.poblados);
    const nuevos = currVerts.filter((v) => !conocidosPoblados.current.has(v));
    // actualizar conocidos
    currVerts.forEach((v) => conocidosPoblados.current.add(v));
    if (nuevos.length !== 1) {
      prevPobladosLen.current = currVerts.length;
      return;
    }
    if (!(juego.fase === 'colocacion' && juego.paso >= juego.orden.length)) {
      prevPobladosLen.current = currVerts.length;
      return;
    }
    const nuevoVertice = nuevos[0];
    const nuevaPieza = juego.poblados[nuevoVertice];
    if (!nuevaPieza) { prevPobladosLen.current = currVerts.length; return; }
        const mapa = mapaDe(partida.modo, partida.semilla);
        const vert = geo.vertices[nuevoVertice];
        if (vert && vert.hexes) {
          const hexesAdyacentes = vert.hexes
            .map(([r, c]) => mapa.hexes.find((h) => h.r === r && h.c === c))
            .filter((h): h is NonNullable<typeof h> => !!h && h.tipo !== 'desert');

          if (hexesAdyacentes.length > 0) {
            const hexIds = hexesAdyacentes.map((h) => h.r + ',' + h.c);
            void (async () => {
              animandoRoll.current = true;
              try {
                await pulsoHexagonos(hexIds);
                const tareas = hexesAdyacentes.map((h, idx) => async () => {
                  await new Promise((r) => setTimeout(r, idx * DURACIONES.escalon));
                  const hexEl = document.querySelector('[data-hex="' + h.r + ',' + h.c + '"]') as HTMLElement | null;
                  const destEl = (nuevaPieza.uid === uid)
                    ? document.querySelector('[data-jugador="' + uid + '"][data-recurso="' + h.tipo + '"]') as HTMLElement | null
                    : document.querySelector('[data-jugador="' + nuevaPieza.uid + '"]') as HTMLElement | null;

                  await volarCarta({
                    recurso: h.tipo,
                    origen: hexEl,
                    destino: destEl,
                    conSubida: true,
                    reverso: nuevaPieza.uid !== uid,
                    prod: { uid: nuevaPieza.uid, recurso: h.tipo }
                  });

                  if (nuevaPieza.uid === uid) {
                    setManoMostrada((prev) => ({
                      ...prev,
                      [h.tipo as Recurso]: ((prev as any)[h.tipo] ?? 0) + 1,
                    }));
                  }
                });
                await Promise.all(tareas.map((t) => t()));
              } finally {
                animandoRoll.current = false;
                setManoMostrada(manoReal);
              }
            })();
          }
        }
    prevPobladosLen.current = currVerts.length;
  }, [juego?.poblados, juego?.fase, juego?.paso, geo, partida, uid]);

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
    // Si en la partida hay bots de verdad (modo solo), es una partida contra la máquina:
    // solo cuenta para el registro personal y no toca el ranking de jugadores reales.
    const contraMaquina = juego.orden.some((id) => id.startsWith('bot_'));
    juego.orden.forEach((id) => {
      if (esBotJugador(sala.jugadores, id)) return;
      const pts = puntosTotales(sala, juego, id);
      const nombre = nombreDe(id);
      if (contraMaquina) void actualizarRegistroMaquina(nombre, pts, juego.ganador === id);
      else void actualizarRanking(nombre, pts);
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
  const mano = manoMostrada;  const valores: [number, number] = rodando ? azar : (juego.dados ?? [1, 1]);
  const suma = juego.dados ? juego.dados[0] + juego.dados[1] : 0;
  const enOrden = juego.fase === 'orden';
  const enColocacion = juego.fase === 'colocacion';
  const pendientes = pendientesOrden(juego);
  const yoPuedoLanzarOrden = enOrden && pendientes.includes(uid) && !juego.tiradasOrden[uid];

  const intentar = async (accion: () => Promise<void>, mensaje: string) => {
    setError('');
    try {
      await accion();
      // Forzar relectura inmediata para reflejar el nuevo estado (útil en móvil).
      if (onActualizar) {
        const snap = await get(ref(db, 'salas/' + codigo));
        if (snap.exists()) {
          onActualizar(snap.val() as Sala);
        }
      }
    } catch {
      setError(mensaje);
      setManoMostrada(manoReal);
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
  const aceptarOferta = () => {
    if (!ofertaEntrante) return;
    setManoMostrada((prev) => {
      const n = { ...prev };
      RECURSOS.forEach((r) => {
        n[r] = (n[r] ?? 0) + (ofertaEntrante.da[r] ?? 0) - (ofertaEntrante.pide[r] ?? 0);
      });
      return n;
    });
    return void intentar(() => aceptarCambio(codigo, uid, ofertaEntrante.id), 'No pude aceptar: revisa que tengas las cartas');
  };
  const rechazarOferta = () => (ofertaEntrante ? intentar(() => rechazarCambio(codigo, uid, ofertaEntrante.id), 'No pude rechazar la oferta') : Promise.resolve());
  const hacerBanco = () => {
    if (!doy || !recibo) return;
    const d = doy, r = recibo;
    const tasa = tasas[d] ?? 4;
    ultimoCambioLocal.current = Date.now();
    setManoMostrada((prev) => ({ ...prev, [d]: ((prev as any)[d] ?? 0) - tasa, [r]: ((prev as any)[r] ?? 0) + 1 }));

    // Animación: tasa cartas vuelan del mazo del jugador al banco (todas a la vez, con pequeño escalon).
    const origenEl = document.querySelector('[data-mano="' + uid + '"]') as HTMLElement | null;
    const dummy = document.createElement('div');
    dummy.style.cssText = 'position:fixed;left:50%;top:60px;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(dummy);
    void (async () => {
      const tareas = Array.from({ length: tasa }).map((_, idx) => async () => {
        await new Promise((res) => setTimeout(res, idx * 80));
        await volarCarta({
          recurso: d,
          origen: origenEl,
          destino: dummy,
          conSubida: true,
          reverso: false,
          prod: { uid, recurso: d },
        });
      });
      await Promise.all(tareas.map((t) => t()));
      dummy.remove();
    })();

    void intentar(() => cambiarConBanco(codigo, uid, numTurno, d, r), 'No pude hacer el cambio con el banco');
  };
  const cambiarBloqueo = (v: boolean) => void intentar(() => bloquearCambios(codigo, uid, v), 'No pude cambiar el bloqueo');
  const miTurnoColocar = enColocacion && soyActual;
  const puedoConstruir = juego.fase === 'accion' && soyActual && !bloqueadoAnim;
  const enMover = juego.fase === 'mover';
  const enRobar = juego.fase === 'robar';
  const enDescartar = juego.fase === 'descartar';
  const enFin = juego.fase === 'fin';
  const gratis = soyActual && juego.caminosGratis > 0 && (juego.fase === 'tirar' || juego.fase === 'accion') && !bloqueado;
  const debo = juego.descartes[uid] ?? 0;
  const lugares = puedoConstruir && construyendo && construyendo !== 'camino' ? lugaresPara(geo, juego, uid, construyendo) : [];
  const lugaresCamino = gratis || (puedoConstruir && construyendo === 'camino') ? lugaresPara(geo, juego, uid, 'camino') : [];
  const vValidos = miTurnoColocar && juego.subpaso === 'poblado' ? verticesLibres(geo, juego.poblados) : lugares;
  const eValidas = miTurnoColocar && juego.subpaso === 'camino' && juego.ultimoPoblado ? caminosDePoblado(geo, juego.caminos, juego.ultimoPoblado) : lugaresCamino;
  const hexesMover = enMover && soyActual ? mapa.hexes.filter((h) => h.r + ',' + h.c !== juego.ladron) : [];
  const moverCachalote = (clave: string) => void intentar(() => mandarLadron(codigo, uid, numTurno, clave), 'No pude mover al cachalote, intenta otra vez');
  const robarAlguien = (v: string) => void intentar(() => robarCartaA(codigo, uid, numTurno, v), 'No pude robar, intenta otra vez');
  const descartarYa = () => {
    void intentar(() => descartarCartas(codigo, uid, numTurno, selDescarte), 'No pude descartar: revisa la cantidad');
  };
  const comprarYa = () => {
    setConfirmarCarta(false);
    ultimoCambioLocal.current = Date.now();
    setManoMostrada((prev) => ({ ...prev, grain: ((prev as any).grain ?? 0) - 1, wool: ((prev as any).wool ?? 0) - 1, ore: ((prev as any).ore ?? 0) - 1 }));
    void intentar(() => comprarDesarrollo(codigo, uid, numTurno), 'No pude comprar la carta');
  };
  const jugarYa = (c: CartaDes, param: ParamCarta) => {
    setUsando(null);
    setElegidos([]);
    setPanel('ninguno');
    if (c.tipo === 'abundancia' && (param as any).dar) {
      ultimoCambioLocal.current = Date.now();
      const elegido = (param as any).dar[0];
      setManoMostrada((prev) => ({ ...prev, [elegido]: ((prev as any)[elegido] ?? 0) + 2 }));
    }
    void intentar(() => usarCarta(codigo, uid, numTurno, c.id, param), 'No pude jugar la carta');
  };
  const puedeJugar = (c: CartaDes) => soyActual && (juego.fase === 'tirar' || juego.fase === 'accion') && !juego.jugoCarta && c.tipo !== 'punto' && c.turno < juego.rondaTurno;
  const alcanzaCarta = RECURSOS.every((r) => mano[r] >= (COSTO_CARTA[r] ?? 0)) && juego.mazo.length > 0;
  const construirAqui = (id: string) => {
    const t = construyendo ?? (gratis ? 'camino' : null);
    if (!t) return;
    ultimoCambioLocal.current = Date.now();
    if (t === 'camino') {
      setManoMostrada((prev) => ({ ...prev, wood: ((prev as any).wood ?? 0) - 1, brick: ((prev as any).brick ?? 0) - 1 }));
    } else if (t === 'poblado') {
      setManoMostrada((prev) => ({ ...prev, wood: ((prev as any).wood ?? 0) - 1, brick: ((prev as any).brick ?? 0) - 1, wool: ((prev as any).wool ?? 0) - 1, grain: ((prev as any).grain ?? 0) - 1 }));
    } else if (t === 'ciudad') {
      setManoMostrada((prev) => ({ ...prev, grain: ((prev as any).grain ?? 0) - 2, ore: ((prev as any).ore ?? 0) - 3 }));
    }
    setConstruyendo(null);
    void intentar(() => construirPieza(codigo, uid, numTurno, t, id), 'No pude construir, intenta otra vez');
  };
  const confirmarPendiente = () => {
    if (!pendiente) return;
    const id = pendiente.id;
    const tipo = pendiente.tipo;
    setPendiente(null);
    if (tipo === 'poblado') {
      if (miTurnoColocar) void poner(id);
      else {
        setConstruyendo(null);
        setManoMostrada((prev) => ({ ...prev, wood: ((prev as any).wood ?? 0) - 1, brick: ((prev as any).brick ?? 0) - 1, wool: ((prev as any).wool ?? 0) - 1, grain: ((prev as any).grain ?? 0) - 1 }));
        void intentar(() => construirPieza(codigo, uid, numTurno, 'poblado', id), 'No pude construir, intenta otra vez');
      }
    } else if (tipo === 'camino') {
      if (miTurnoColocar) void camino(id);
      else {
        setConstruyendo(null);
        const t = construyendo ?? (gratis ? 'camino' : null);
        if (t === 'camino') setManoMostrada((prev) => ({ ...prev, wood: ((prev as any).wood ?? 0) - 1, brick: ((prev as any).brick ?? 0) - 1 }));
        else if (t === 'poblado') setManoMostrada((prev) => ({ ...prev, wood: ((prev as any).wood ?? 0) - 1, brick: ((prev as any).brick ?? 0) - 1, wool: ((prev as any).wool ?? 0) - 1, grain: ((prev as any).grain ?? 0) - 1 }));
        else if (t === 'ciudad') setManoMostrada((prev) => ({ ...prev, grain: ((prev as any).grain ?? 0) - 2, ore: ((prev as any).ore ?? 0) - 3 }));
        if (t) void intentar(() => construirPieza(codigo, uid, numTurno, t, id), 'No pude construir, intenta otra vez');
      }
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
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke="#000000" strokeWidth={10} strokeLinecap="round" />
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke={colorJ(dueno)} strokeWidth={6} strokeLinecap="round" />
          </g>
        );
      })}
      {Object.entries(juego.poblados).map(([v, p]) => {
        const q = geo.vertices[v];
        if (!q) return null;
        return (
          <g key={v} transform={`translate(${q.x} ${q.y}) scale(0.8)`} pointerEvents="none">
            {p.tipo === 'ciudad' ? <FormaCiudad color={colorJ(p.uid)} /> : <FormaPoblado color={colorJ(p.uid)} />}
          </g>
        );
      })}
      <g pointerEvents="none" data-ladron={juego.ladron} dangerouslySetInnerHTML={{ __html: ballena(bx, by) }} />
      {eValidas.map((e) => {
        const a = geo.aristas[e];
        const va = geo.vertices[a.a];
        const vb = geo.vertices[a.b];
        return (
          <g key={e} onClick={() => setPendiente({ tipo: 'camino', id: e })} style={{ cursor: 'pointer' }}>
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
      {pendiente && pendiente.tipo === 'poblado' && geo.vertices[pendiente.id] && (
        <g transform={`translate(${geo.vertices[pendiente.id].x} ${geo.vertices[pendiente.id].y}) scale(0.95)`} opacity={0.5} pointerEvents="none">
          <FormaPoblado color={miColor} />
        </g>
      )}
      {pendiente && pendiente.tipo === 'camino' && geo.aristas[pendiente.id] && (() => {
        const a = geo.aristas[pendiente.id];
        const va = geo.vertices[a.a];
        const vb = geo.vertices[a.b];
        return (
          <g pointerEvents="none" opacity={0.9}>
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke="#000000" strokeWidth={10} strokeLinecap="round" />
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke={miColor} strokeWidth={6} strokeLinecap="round" />
          </g>
        );
      })()}
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
              piezas={piezas3d}
              dados={juego?.dados ?? null}
              evento3d={evento3d}
              controlRef={control3dRef}
            />
            {pendiente && (
              <div className="barra-confirmar">
                <span>{pendiente.tipo === 'poblado' ? '¿Poner el poblado aquí?' : '¿Poner el camino aquí?'}</span>
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
          {juego.avisos?.[uid] ? <div className="aviso-fuerte">⚠️ {juego.avisos[uid]}</div> : null}
          {soyBot ? <div className="aviso">🤖 Estás siendo reemplazado por un bot porque dejaste pasar el tiempo.</div> : null}
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
                <div key={id} className={id === actualUid ? 'jug actual' : 'jug'} data-mano={id} data-jugador={id}>
                  <div className="jug-nombre">
                    <span className="punto" style={{ background: colorJ(id) }} />
                    <span>
                      {enOrden ? '' : i + 1 + '. '}{nombreDe(id)}{id === uid ? ' (tú)' : ''}
                      {esBotJugador(sala.jugadores, id) ? ' 🤖' : ''}
                    </span>
                    {sala.jugadores?.[id]?.conectado === false && <span> ⚪</span>}
                    {!esBotJugador(sala.jugadores, id) && (juego.ausencias?.[id] ?? 0) > 0 && (
                      <span className="ausencias" title="Turnos dejados pasar sin jugar">⏱ {juego.ausencias?.[id]}/3</span>
                    )}
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
                        <line x1={-16} y1={6} x2={16} y2={-12} stroke="#000000" strokeWidth={10} strokeLinecap="round" />
                        <line x1={-16} y1={6} x2={16} y2={-12} stroke={miColor} strokeWidth={6} strokeLinecap="round" />
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
            {juego.fase === 'accion' && soyActual && <button className="accion" disabled={bloqueadoAnim} onClick={() => void terminar()}>Terminar turno ➜</button>}
            {(juego.fase === 'tirar' || juego.fase === 'accion') && !soyActual && <span className="espera">Esperando a {nombreDe(actualUid)}...</span>}
            {enColocacion && !soyActual && <span className="espera">Esperando a {nombreDe(actualUid)}...</span>}
            {error && <div className="error-mini">{error}</div>}
          </div>
        </div>
        <div className="recursos" data-mano={uid}>
          {RECURSOS.map((r) => (
            <div key={r} className="rec" title={NOMBRE_RECURSO[r]} data-jugador={uid} data-recurso={r}>
              <IconoRecurso tipo={r} />
              <b className={popRecurso === r ? 'pop-num' : ''}>{manoMostrada[r]}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
