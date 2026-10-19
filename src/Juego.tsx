import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as PE, ReactNode } from 'react';
import { dibujarTablero } from './tablero';
import type { Modo } from './tablero';
import './juego.css';

type Punto = { x: number; y: number };
type Props = { modo?: Modo; semilla?: number; overlay?: ReactNode; sinBallena?: boolean };
const INICIO = { x: 0, y: 0, k: 1 };

export default function Juego({ modo: modoFijo, semilla: semillaFija, overlay, sinBallena }: Props) {
  const fijo = modoFijo !== undefined && semillaFija !== undefined;
  const [modoLibre, setModoLibre] = useState<Modo>('p');
  const [semillaLibre, setSemillaLibre] = useState(11);
  const [vista, setVista] = useState(INICIO);
  const modo: Modo = modoFijo ?? modoLibre;
  const semilla: number = semillaFija ?? semillaLibre;
  const svg = useMemo(() => dibujarTablero(modo, semilla, !sinBallena), [modo, semilla, sinBallena]);
  const punteros = useRef(new Map<number, Punto>());
  const inicios = useRef(new Map<number, Punto>());
  const capturados = useRef(new Set<number>());
  const distAnterior = useRef(0);

  const zoom = (factor: number) =>
    setVista((v) => ({ ...v, k: Math.min(4, Math.max(0.5, v.k * factor)) }));

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
  const cambiar = (m: Modo) => { setModoLibre(m); setVista(INICIO); };

  return (
    <div className="juego">
      <div className="barra">
        {!fijo && (
          <>
            <button className={modo === 'p' ? 'on' : ''} onClick={() => cambiar('p')}>3 o 4 jugadores</button>
            <button className={modo === 'g' ? 'on' : ''} onClick={() => cambiar('g')}>5 o 6 jugadores</button>
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
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
      >
        <svg
          className="tablero"
          viewBox="0 0 860 670"
          style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})` }}
        >
          <g dangerouslySetInnerHTML={{ __html: svg }} />
          {overlay}
        </svg>
      </div>
    </div>
  );
}
