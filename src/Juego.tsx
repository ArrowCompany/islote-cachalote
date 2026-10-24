import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as PE, ReactNode } from 'react';
import { dibujarTablero } from './tablero';
import type { Modo } from './tablero';
import './juego.css';

type Punto = { x: number; y: number };
type Props = { modo?: Modo; semilla?: number; overlay?: ReactNode; fondo?: ReactNode; sinBallena?: boolean; flotante?: boolean; mesa?: boolean };
const INICIO = { x: 0, y: 0, k: 1 };

export default function Juego({ modo: modoFijo, semilla: semillaFija, overlay, fondo, sinBallena, flotante, mesa }: Props) {
  const fijo = modoFijo !== undefined && semillaFija !== undefined;
  const [tam, setTam] = useState<'p' | 'g'>('p');
  const [forma, setForma] = useState<'cachalote' | 'catan'>('cachalote');
  const modoLibre: Modo = forma === 'catan' ? (tam === 'p' ? 'cp' : 'cg') : tam;
  const [semillaLibre, setSemillaLibre] = useState(11);
  const [vista, setVista] = useState(INICIO);
  const modo: Modo = modoFijo ?? modoLibre;
  const semilla: number = semillaFija ?? semillaLibre;
  const svg = useMemo(() => dibujarTablero(modo, semilla, !sinBallena), [modo, semilla, sinBallena]);
  const punteros = useRef(new Map<number, Punto>());
  const inicios = useRef(new Map<number, Punto>());
  const capturados = useRef(new Set<number>());
  const distAnterior = useRef(0);
  const visorRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const zoom = (factor: number) =>
    setVista((v) => ({ ...v, k: Math.min(4, Math.max(mesa ? 0.2 : 0.5, v.k * factor)) }));

  const verMesa = () => {
    const visor = visorRef.current, sv = svgRef.current;
    if (!visor || !sv) return;
    const esc = sv.clientWidth / 860;
    const k = Math.min(visor.clientWidth / (1560 * esc), visor.clientHeight / (1130 * esc), 1);
    setVista({ x: 0, y: 0, k: Math.max(0.2, k) });
  };

  const alPresionar = (e: PE<HTMLDivElement>) => {
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    inicios.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      distAnterior.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const alMover = (e: PE<HTMLDivElement>) => {
    const p = punteros.current.get(e.pointerId);
    if (!p) return;
    if (!capturados.current.has(e.pointerId)) {
      const ini = inicios.current.get(e.pointerId);
      const lejos = ini ? Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 8 : true;
      if (!lejos && punteros.current.size === 1) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      capturados.current.add(e.pointerId);
    }
    if (punteros.current.size === 1) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      setVista((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (distAnterior.current) zoom(d / distAnterior.current);
      distAnterior.current = d;
    }
  };
  const alSoltar = (e: PE<HTMLDivElement>) => {
    punteros.current.delete(e.pointerId);
    inicios.current.delete(e.pointerId);
    capturados.current.delete(e.pointerId);
  };
  const cambiar = (m: 'p' | 'g') => { setTam(m); setVista(INICIO); };

  return (
    <div className="juego">
      {flotante && (
        <div className="zoom-flotante">
          <button onClick={() => zoom(1.25)}>+</button>
          <button onClick={() => zoom(0.8)}>−</button>
          <button onClick={() => setVista(INICIO)}>⟲</button>
          {mesa && <button onClick={verMesa} title="Ver toda la mesa">🗺</button>}
        </div>
      )}
      <div className={flotante ? 'barra oculta' : 'barra'}>
        {!fijo && (
          <>
            <button className={tam === 'p' ? 'on' : ''} onClick={() => cambiar('p')}>3 o 4 jugadores</button>
            <button className={tam === 'g' ? 'on' : ''} onClick={() => cambiar('g')}>5 o 6 jugadores</button>
            <button className={forma === 'cachalote' ? 'on' : ''} onClick={() => setForma('cachalote')}>🐋 Cachalote</button>
            <button className={forma === 'catan' ? 'on' : ''} onClick={() => setForma('catan')}>🏝️ Tipo Catan</button>
          </>
        )}
        <button className="on" onClick={() => zoom(1.25)}>+</button>
        <button className="on" onClick={() => zoom(0.8)}>−</button>
        <button className="on" onClick={() => setVista(INICIO)}>Centrar</button>
        {!fijo && (
          <button className="on" onClick={() => setSemillaLibre(Math.floor(Math.random() * 2147483646) + 1)}>🎲 Mapa aleatorio</button>
        )}
      </div>
      <div
        className="visor"
        ref={visorRef}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
      >
        <svg
          className="tablero"
          ref={svgRef}
          viewBox="0 0 860 670"
          style={{ overflow: 'visible', transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})` }}
        >
          {fondo}
          <g dangerouslySetInnerHTML={{ __html: svg }} />
          {overlay}
        </svg>
      </div>
    </div>
  );
}
