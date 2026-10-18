import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as PE } from 'react';
import { dibujarTablero } from './tablero';
import type { Modo } from './tablero';
import './juego.css';

type Punto = { x: number; y: number };
const INICIO = { x: 0, y: 0, k: 1 };

export default function Juego() {
  const [modo, setModo] = useState<Modo>('p');
  const [vista, setVista] = useState(INICIO);
  const svg = useMemo(() => dibujarTablero(modo), [modo]);
  const punteros = useRef(new Map<number, Punto>());
  const distAnterior = useRef(0);

  const zoom = (factor: number) =>
    setVista((v) => ({ ...v, k: Math.min(4, Math.max(0.5, v.k * factor)) }));

  const alPresionar = (e: PE<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      distAnterior.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const alMover = (e: PE<HTMLDivElement>) => {
    const p = punteros.current.get(e.pointerId);
    if (!p) return;
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
  };
  const cambiar = (m: Modo) => { setModo(m); setVista(INICIO); };

  return (
    <div className="juego">
      <div className="barra">
        <button className={modo === 'p' ? 'on' : ''} onClick={() => cambiar('p')}>3 o 4 jugadores</button>
        <button className={modo === 'g' ? 'on' : ''} onClick={() => cambiar('g')}>5 o 6 jugadores</button>
        <button className="on" onClick={() => zoom(1.25)}>+</button>
        <button className="on" onClick={() => zoom(0.8)}>−</button>
        <button className="on" onClick={() => setVista(INICIO)}>Centrar</button>
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
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}