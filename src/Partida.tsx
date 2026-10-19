import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { COLORES } from './salas';
import type { Sala } from './salas';
import { ahoraServidor, construirPieza, lanzarDadosOrden, ponerCamino, ponerPoblado, terminarTurno, tiempoAgotado, tirarDados } from './turnos';
import { COSTO, LIMITE, NOMBRE_RECURSO, RECURSOS, caminosDePoblado, completar, contarPiezas, jugadorActual, lugaresPara, manoVacia, pendientesOrden, puedePagar, verticesLibres } from './reglas';
import type { Recurso, TipoPieza } from './reglas';
import { COLOR, ballena, geometriaDe, posicion } from './tablero';
import Juego from './Juego';
import './partida.css';

type Props = { sala: Sala; uid: string; codigo: string; onSalir: () => void };
type Panel = 'ninguno' | 'jugadores' | 'chat';

const PUNTOS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
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

function IconoRecurso({ tipo }: { tipo: Recurso }) {
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
      <g strokeWidth="1.5" stroke="#5c6275">
        <path d="M4 38L11 24H37L44 38Z" fill="#b8bcc7" />
        <path d="M4 38H44V44H4Z" fill="#8b90a0" />
        <path d="M13 24L18 14H30L35 24Z" fill="#d9dde6" />
        <path d="M18 14L22 8H26L30 14Z" fill="#eef0f5" />
      </g>
    ),
  };
  return (
    <svg className="icono-rec" viewBox="0 0 48 48" aria-hidden="true">
      {dibujo[tipo]}
    </svg>
  );
}

function oscurecer(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return '#' + c((n >> 16) & 255) + c((n >> 8) & 255) + c(n & 255);
}

function listones(x1: number, y1: number, x2: number, y2: number, k: number) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const px = (-dy / L) * 3.3 * k, py = (dx / L) * 3.3 * k;
  let d = '';
  for (let i = 1; i < 6; i++) {
    const cx = x1 + (dx * i) / 6, cy = y1 + (dy * i) / 6;
    d += 'M' + (cx + px).toFixed(1) + ' ' + (cy + py).toFixed(1) + 'L' + (cx - px).toFixed(1) + ' ' + (cy - py).toFixed(1);
  }
  return d;
}

function FormaPoblado({ color }: { color: string }) {
  return (
    <g stroke="#ffffff" strokeWidth={2.4} strokeLinejoin="round">
      <rect x={-9} y={-3} width={18} height={12} fill={color} />
      <path d="M-12.5 -3L0 -15.5L12.5 -3Z" fill={oscurecer(color, 0.62)} />
      <rect x={-2.6} y={3} width={5.2} height={6} fill="#1b1b1b" stroke="none" opacity={0.6} />
    </g>
  );
}

function FormaCiudad({ color }: { color: string }) {
  const techo = oscurecer(color, 0.62);
  return (
    <g stroke="#ffffff" strokeWidth={2.4} strokeLinejoin="round">
      <rect x={-4} y={-4} width={19} height={14} fill={color} />
      <path d="M-6 -4L5.5 -14L17 -4Z" fill={techo} />
      <rect x={-16} y={-12} width={12} height={22} fill={color} />
      <path d="M-18.5 -12L-10 -23L-1.5 -12Z" fill={techo} />
      <rect x={7} y={3} width={4.4} height={7} fill="#1b1b1b" stroke="none" opacity={0.6} />
      <rect x={-12} y={-6} width={4} height={5} fill="#fff7e0" stroke="none" opacity={0.85} />
    </g>
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
  const faseActual = juego?.fase;
  const tiradaVista = useRef(tirada);
  const disparado = useRef(-1);

  useEffect(() => {
    if (tirada === tiradaVista.current) return;
    tiradaVista.current = tirada;
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
    if (!hayJuego) return;
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
  }, [hayJuego, inicio, numTurno, reloj, soyActual, soyAnfitrion, codigo]);

  useEffect(() => {
    setConstruyendo(null);
  }, [numTurno, faseActual]);

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

  const miTurnoColocar = enColocacion && soyActual;
  const puedoConstruir = juego.fase === 'accion' && soyActual;
  const lugares = puedoConstruir && construyendo ? lugaresPara(geo, juego, uid, construyendo) : [];
  const vValidos = miTurnoColocar && juego.subpaso === 'poblado' ? verticesLibres(geo, juego.poblados) : construyendo && construyendo !== 'camino' ? lugares : [];
  const eValidas = miTurnoColocar && juego.subpaso === 'camino' && juego.ultimoPoblado ? caminosDePoblado(geo, juego.caminos, juego.ultimoPoblado) : construyendo === 'camino' ? lugares : [];
  const construirAqui = (id: string) => {
    const t = construyendo;
    if (!t) return;
    setConstruyendo(null);
    void intentar(() => construirPieza(codigo, uid, numTurno, t, id), 'No pude construir, intenta otra vez');
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
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke="#ffffff" strokeWidth={12} strokeLinecap="round" />
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke={colorJ(dueno)} strokeWidth={7} strokeLinecap="round" />
            <path d={listones(va.x, va.y, vb.x, vb.y, 1)} stroke="rgba(0,0,0,0.35)" strokeWidth={1.4} fill="none" />
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
      {vValidos.map((v) => (
        <g key={v} onClick={() => (miTurnoColocar ? void poner(v) : construirAqui(v))} style={{ cursor: 'pointer' }}>
          <circle cx={geo.vertices[v].x} cy={geo.vertices[v].y} r={19} fill="transparent" />
          <circle className="hot" cx={geo.vertices[v].x} cy={geo.vertices[v].y} r={10} />
        </g>
      ))}
    </g>
  );

  let titulo = '';
  if (enOrden) titulo = 'Lancen los dados para ver quién va primero';
  else if (enColocacion) {
    titulo = soyActual
      ? juego.subpaso === 'poblado' ? 'Coloca tu poblado' : 'Coloca tu camino'
      : nombreDe(actualUid) + ' está colocando...';
  } else if (soyActual && construyendo) titulo = 'Toca dónde quieres construir';
  else titulo = soyActual ? '¡Es tu turno!' : 'Turno de ' + nombreDe(actualUid);

  const filasOrden = juego.grupos.flat();
  const listaJugadores = enOrden ? filasOrden : juego.orden;
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
            <Juego modo={partida.modo} semilla={partida.semilla} overlay={overlay} sinBallena flotante />
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
        </div>

        <div className="flot-centro">
          <div className="pildora">
            <span className="pildora-texto">{titulo}</span>
            <span className={restante <= 10 ? 'pildora-reloj urgente' : 'pildora-reloj'}>⏱ {restante}</span>
          </div>
          {juego.aviso ? <div className="aviso">{juego.aviso}</div> : null}
        </div>

        <button className="salir flot-der" onClick={onSalir}>Salir</button>

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
                        <line x1={-16} y1={6} x2={16} y2={-12} stroke="#ffffff" strokeWidth={12} strokeLinecap="round" />
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
        {panel === 'chat' && hayChat && (
          <div className="panel panel-chat">
            <h3>Chat</h3>
            <p>El chat de grupo llega en una de las siguientes partes.</p>
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
