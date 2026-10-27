import type { ReactNode } from 'react';
import type { Recurso, Recursos } from './reglas';
import { RECURSOS } from './reglas';
import { COLOR } from './tablero';

export function IconoRecurso({ tipo }: { tipo: Recurso }) {
  const dibujo: Record<Recurso, ReactNode> = {
    wood: (
      <g strokeWidth="1.5" stroke="#5a3b1e">
        <rect x="3" y="28" width="32" height="11" rx="5.5" fill="#8a5a2b" />
        <circle cx="33" cy="33.5" r="5.5" fill="#ecc88e" />
        <circle cx="33" cy="33.5" r="2.2" fill="none" stroke="#b98a4a" />
        <rect x="9" y="16" width="32" height="11" rx="5.5" fill="#a06a33" />
        <circle cx="39" cy="21.5" r="5.5" fill="#f3d9a6" />
        <circle cx="39" cy="21.5" r="2.2" fill="none" stroke="#b98a4a" />
        <rect x="5" y="5" width="30" height="10" rx="5" fill="#8a5a2b" />
        <circle cx="33" cy="10" r="5" fill="#ecc88e" />
      </g>
    ),
    brick: (
      <g strokeWidth="1.5" stroke="#7a1f1a">
        <rect x="3" y="30" width="20" height="11" rx="2" fill="#d6453d" />
        <rect x="25" y="30" width="20" height="11" rx="2" fill="#c93a32" />
        <rect x="14" y="18" width="20" height="11" rx="2" fill="#e0574e" />
        <rect x="14" y="6" width="20" height="11" rx="2" fill="#d6453d" />
        <path d="M6 33h14M28 33h14M17 21h14M17 9h14" stroke="#f4a29b" strokeWidth="1.5" />
      </g>
    ),
    wool: (
      <g>
        <path d="M15 36v8M31 36v8" stroke="#3b2a14" strokeWidth="3.5" strokeLinecap="round" />
        <g fill="#fffdf4" stroke="#b8c0a0" strokeWidth="1.2">
          <circle cx="16" cy="24" r="10" />
          <circle cx="27" cy="21" r="10" />
          <circle cx="23" cy="31" r="9" />
        </g>
        <ellipse cx="39" cy="26" rx="5.5" ry="6.5" fill="#3b2a14" />
        <circle cx="40" cy="24" r="1.3" fill="#fffdf4" />
      </g>
    ),
    grain: (
      <g>
        <path d="M24 45V13" stroke="#9a7a1c" strokeWidth="2.6" strokeLinecap="round" />
        <g fill="#f2c23c" stroke="#b98a14" strokeWidth="1">
          <ellipse cx="24" cy="7" rx="3.6" ry="6" />
          <ellipse cx="17" cy="15" rx="3.6" ry="6.5" transform="rotate(-28 17 15)" />
          <ellipse cx="31" cy="15" rx="3.6" ry="6.5" transform="rotate(28 31 15)" />
          <ellipse cx="17" cy="26" rx="3.6" ry="6.5" transform="rotate(-28 17 26)" />
          <ellipse cx="31" cy="26" rx="3.6" ry="6.5" transform="rotate(28 31 26)" />
          <ellipse cx="18" cy="37" rx="3.6" ry="6" transform="rotate(-28 18 37)" />
          <ellipse cx="30" cy="37" rx="3.6" ry="6" transform="rotate(28 30 37)" />
        </g>
      </g>
    ),
    ore: (
      <g>
        <ellipse cx="24" cy="42" rx="14" ry="3.5" fill="#1d1f26" />
        <path d="M14 42L22 7M34 42L26 7" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M14 42L22 7M34 42L26 7" stroke="#4b5160" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M17 33H31M19 24H29M20.5 15H27.5" stroke="#4b5160" strokeWidth="1.6" fill="none" />
        <rect x="19" y="3" width="10" height="6" rx="1.5" fill="#4b5160" stroke="#ffffff" strokeWidth="1.3" />
        <circle cx="24" cy="0" r="2.6" fill="#e8607f" stroke="#ffffff" strokeWidth="0.8" />
      </g>
    ),
  };
  return (
    <svg className="icono-rec" viewBox="0 0 48 48" aria-hidden="true">
      {dibujo[tipo]}
    </svg>
  );
}

export function oscurecer(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return '#' + c((n >> 16) & 255) + c((n >> 8) & 255) + c(n & 255);
}

export function listones(x1: number, y1: number, x2: number, y2: number, k: number) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const px = (-dy / L) * 3.3 * k, py = (dx / L) * 3.3 * k;
  let d = '';
  for (let i = 1; i < 6; i++) {
    const cx = x1 + (dx * i) / 6, cy = y1 + (dy * i) / 6;
    d += 'M' + (cx + px).toFixed(1) + ' ' + (cy + py).toFixed(1) + 'L' + (cx - px).toFixed(1) + ' ' + (cy - py).toFixed(1);
  }
  return d;
}

export function FormaPoblado({ color }: { color: string }) {
  const borde = oscurecer(color, 0.5);
  return (
    <g>
      <polygon points="18,8 26,5 38,19 30,22" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
      <polygon points="18,8 26,5 38,19 30,22" fill="#fff" fillOpacity={0.25} stroke="none" />
      <polygon points="30,22 38,19 38,36 30,40" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
      <polygon points="30,22 38,19 38,36 30,40" fill="#000" fillOpacity={0.3} stroke="none" />
      <polygon points="6,40 6,22 18,8 30,22 30,40" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
    </g>
  );
}

export function FormaCiudad({ color }: { color: string }) {
  const borde = oscurecer(color, 0.5);
  return (
    <g>
      <polygon points="26,34 32,28 66,28 60,34" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
      <polygon points="26,34 32,28 66,28 60,34" fill="#fff" fillOpacity={0.25} stroke="none" />
      <polygon points="60,34 66,28 66,48 60,52" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
      <polygon points="60,34 66,28 66,48 60,52" fill="#000" fillOpacity={0.3} stroke="none" />
      <polygon points="26,52 26,34 60,34 60,52" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
      <polygon points="16,6 24,3 34,16 26,22" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
      <polygon points="16,6 24,3 34,16 26,22" fill="#fff" fillOpacity={0.25} stroke="none" />
      <polygon points="26,22 34,16 34,48 26,52" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
      <polygon points="26,22 34,16 34,48 26,52" fill="#000" fillOpacity={0.3} stroke="none" />
      <polygon points="4,52 4,22 16,6 26,22 26,52" fill={color} stroke={borde} strokeWidth={1} strokeLinejoin="round" />
    </g>
  );
}

export function Carta({ tipo, valor, max, onCambio, apagada }: { tipo: Recurso; valor: number; max: number; onCambio: (n: number) => void; apagada?: boolean }) {
  return (
    <div className={apagada ? 'carta apagada' : 'carta'} style={{ background: COLOR[tipo] }}>
      <IconoRecurso tipo={tipo} />
      <b className="cnt">{valor}</b>
      <div className="mm">
        <button disabled={valor <= 0} onClick={() => onCambio(valor - 1)} aria-label="Quitar">−</button>
        <button disabled={apagada || valor >= max} onClick={() => onCambio(valor + 1)} aria-label="Agregar">+</button>
      </div>
    </div>
  );
}

export function Cantidades({ c }: { c: Partial<Recursos> }) {
  return (
    <span className="cants">
      {RECURSOS.filter((r) => c[r]).map((r) => (
        <span key={r} className="cant">
          <IconoRecurso tipo={r} />
          <b>×{c[r]}</b>
        </span>
      ))}
    </span>
  );
}

