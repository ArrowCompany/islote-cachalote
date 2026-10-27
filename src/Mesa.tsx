import { COLOR } from './tablero';
import { COSTO, COSTO_CARTA, LIMITE, RECURSOS, contarPiezas } from './reglas';
import type { EstadoJuego, Recursos } from './reglas';
import { FormaCiudad, FormaPoblado, listones } from './piezas';

export type JugadorMesa = { uid: string; nombre: string; hex: string };

const SLOTS: [number, number][] = [[-340, 90], [900, 90], [-340, 300], [900, 300], [280, -230], [280, 720]];

const TABLONES = (() => {
  let d = '';
  for (let y = -900; y <= 1600; y += 90) d += 'M-1100 ' + y + 'H1960';
  return d;
})();

function Fichas({ c, x, y }: { c: Partial<Recursos>; x: number; y: number }) {
  const lista = RECURSOS.filter((r) => c[r]);
  return (
    <g>
      {lista.map((r, i) => (
        <g key={r} transform={`translate(${x + i * 30} ${y})`}>
          <circle r={12} fill={COLOR[r]} stroke="#ffffff" strokeWidth={2} />
          <text y={5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1b1b1b">{c[r]}</text>
        </g>
      ))}
    </g>
  );
}

export default function Mesa({ jugadores, juego }: { jugadores: JugadorMesa[]; juego: EstadoJuego }) {
  const filaCoste = (y: number, nombre: string, c: Partial<Recursos>, extra: string) => (
    <g>
      <text x={16} y={y + 6} fontSize={18} fontWeight={700} fill="#3b2a14">{nombre}</text>
      <Fichas c={c} x={118} y={y} />
      <text x={284} y={y + 6} textAnchor="end" fontSize={14} fill="#6b4423">{extra}</text>
    </g>
  );
  return (
    <g pointerEvents="none">
      <rect x={-1100} y={-900} width={3060} height={2500} fill="#9a6a3a" />
      <path d={TABLONES} stroke="#6f4620" strokeWidth={3} opacity={0.55} />
      {jugadores.map((p, i) => {
        const pos = SLOTS[i];
        if (!pos) return null;
        const c = contarPiezas(juego, p.uid);
        const resto = { camino: LIMITE.camino - c.camino, poblado: LIMITE.poblado - c.poblado, ciudad: LIMITE.ciudad - c.ciudad };
        return (
          <g key={p.uid} data-jugador={p.uid} transform={`translate(${pos[0]} ${pos[1]})`}>
            <rect x={-10} y={-10} width={312} height={178} rx={14} fill="rgba(0,0,0,0.25)" />
            <circle cx={10} cy={12} r={9} fill={p.hex} stroke="#ffffff" strokeWidth={2.5} />
            <text x={28} y={20} fontSize={22} fontWeight={700} fill="#ffffff">{p.nombre}</text>
            {Array.from({ length: resto.camino }, (_, k) => (
              <g key={k} transform={`translate(${(k % 5) * 54 + 6} ${42 + Math.floor(k / 5) * 17})`}>
                <line x1={0} y1={0} x2={42} y2={0} stroke="#000000" strokeWidth={13} strokeLinecap="round" />
                <line x1={0} y1={0} x2={42} y2={0} stroke={p.hex} strokeWidth={7} strokeLinecap="round" />
                <path d={listones(0, 0, 42, 0, 0.9)} stroke="rgba(0,0,0,0.35)" strokeWidth={1.2} fill="none" />
              </g>
            ))}
            <text x={294} y={20} textAnchor="end" fontSize={16} fill="#f3e6c4">caminos {resto.camino}/{LIMITE.camino}</text>
            {Array.from({ length: resto.poblado }, (_, k) => (
              <g key={k} transform={`translate(${24 + k * 36} 132) scale(0.8)`}>
                <FormaPoblado color={p.hex} />
              </g>
            ))}
            {Array.from({ length: resto.ciudad }, (_, k) => (
              <g key={k} transform={`translate(${206 + k * 38} 132) scale(0.8)`}>
                <FormaCiudad color={p.hex} />
              </g>
            ))}
            <text x={6} y={158} fontSize={13} fill="#f3e6c4">poblados {resto.poblado}/{LIMITE.poblado} · ciudades {resto.ciudad}/{LIMITE.ciudad}</text>
          </g>
        );
      })}

      <g transform="translate(-340 560)">
        <rect width={300} height={232} rx={14} fill="#f3e6c4" stroke="#6b4423" strokeWidth={4} />
        <text x={150} y={34} textAnchor="middle" fontSize={24} fontWeight={700} fill="#3b2a14">COSTES</text>
        {filaCoste(72, 'Camino', COSTO.camino, '')}
        {filaCoste(116, 'Poblado', COSTO.poblado, '+1 punto')}
        {filaCoste(160, 'Ciudad', COSTO.ciudad, '+2 puntos')}
        {filaCoste(204, 'Carta', COSTO_CARTA, 'desarrollo')}
      </g>

      <g transform="translate(900 580)">
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x={k * 3} y={-k * 3} width={120} height={168} rx={10} fill="#5b6475" stroke="#2c3340" strokeWidth={3} />
        ))}
        <rect x={9} y={-9} width={120} height={168} rx={10} fill="#7a859b" stroke="#2c3340" strokeWidth={3} />
        <text x={69} y={92} textAnchor="middle" fontSize={64} fontWeight={700} fill="#2c3340">?</text>
        <text x={69} y={196} textAnchor="middle" fontSize={20} fontWeight={700} fill="#ffffff">Mazo: {juego.mazo.length}</text>
      </g>
    </g>
  );
}
