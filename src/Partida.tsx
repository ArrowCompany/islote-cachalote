import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { COLORES } from './salas';
import type { Sala } from './salas';
import { ahoraServidor, lanzarDadosOrden, ponerCamino, ponerPoblado, terminarTurno, tiempoAgotado, tirarDados } from './turnos';
import { NOMBRE_RECURSO, RECURSOS, caminosDePoblado, completar, jugadorActual, manoVacia, pendientesOrden, verticesLibres } from './reglas';
import type { Recurso } from './reglas';
import { COLOR, ballena, geometriaDe, posicion } from './tablero';
import Juego from './Juego';
import './partida.css';

type Props = { sala: Sala; uid: string; codigo: string; onSalir: () => void };

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

function Icono({ tipo }: { tipo: Recurso }) {
  const glifo: Record<Recurso, ReactNode> = {
    wood: <path d="M-12 8L-5 -8L2 8ZM-2 8L5 -4L12 8Z" fill="#0e5f4e" />,
    brick: (
      <g fill="#fff3f6" stroke="#8a2a48" strokeWidth="1">
        <rect x="-11" y="-8" width="12" height="7" />
        <rect x="-1" y="1" width="12" height="7" />
      </g>
    ),
    wool: (
      <g fill="#fffdf4" stroke="#5f8a2a" strokeWidth="1">
        <circle cx="-3" cy="0" r="6" />
        <circle cx="4" cy="1" r="5" />
      </g>
    ),
    grain: <path d="M-7 9V-6M0 9V-9M7 9V-6" stroke="#8a5f00" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    ore: <path d="M-12 9L-4 -8L3 9ZM-1 9L6 -3L12 9Z" fill="#fff7e0" stroke="#4d3f95" strokeWidth="1" />,
  };
  return (
    <svg viewBox="-20 -20 40 40" width="30" height="30">
      <circle r="19" fill={COLOR[tipo]} stroke="#ffffff" strokeWidth="2" />
      {glifo[tipo]}
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
  const vValidos = miTurnoColocar && juego.subpaso === 'poblado' ? verticesLibres(geo, juego.poblados) : [];
  const eValidas = miTurnoColocar && juego.subpaso === 'camino' && juego.ultimoPoblado ? caminosDePoblado(geo, juego.caminos, juego.ultimoPoblado) : [];
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
          </g>
        );
      })}
      {Object.entries(juego.poblados).map(([v, p]) => {
        const q = geo.vertices[v];
        if (!q) return null;
        const d = p.tipo === 'ciudad'
          ? `M${q.x - 13} ${q.y + 10}V${q.y - 1}H${q.x - 3}V${q.y - 10}L${q.x + 3} ${q.y - 15}L${q.x + 9} ${q.y - 10}V${q.y - 1}H${q.x + 13}V${q.y + 10}Z`
          : `M${q.x - 10} ${q.y + 8}V${q.y - 2}L${q.x} ${q.y - 11}L${q.x + 10} ${q.y - 2}V${q.y + 8}Z`;
        return <path key={v} d={d} fill={colorJ(p.uid)} stroke="#ffffff" strokeWidth={2.5} strokeLinejoin="round" pointerEvents="none" />;
      })}
      <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: ballena(bx, by) }} />
      {eValidas.map((e) => {
        const a = geo.aristas[e];
        const va = geo.vertices[a.a];
        const vb = geo.vertices[a.b];
        return (
          <g key={e} onClick={() => void camino(e)} style={{ cursor: 'pointer' }}>
            <line x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} stroke="transparent" strokeWidth={24} strokeLinecap="round" />
            <line className="hot-arista" x1={va.x} y1={va.y} x2={vb.x} y2={vb.y} />
          </g>
        );
      })}
      {vValidos.map((v) => (
        <g key={v} onClick={() => void poner(v)} style={{ cursor: 'pointer' }}>
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
  } else titulo = soyActual ? '¡Es tu turno!' : 'Turno de ' + nombreDe(actualUid);

  const filasOrden = juego.grupos.flat();

  return (
    <div className="partida">
      <div className="cabecera">
        <button className="salir" onClick={onSalir}>Salir</button>
        <div className="turno">{titulo}</div>
        <div className={restante <= 10 ? 'reloj urgente' : 'reloj'}>⏱ {restante}</div>
      </div>
      {juego.aviso ? <div className="aviso">{juego.aviso}</div> : null}

      <div className="jugadores">
        {(enOrden ? filasOrden : juego.orden).map((id, i) => {
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
        </div>
      ) : (
        <div className="tablero-caja">
          <Juego modo={partida.modo} semilla={partida.semilla} overlay={overlay} sinBallena />
        </div>
      )}

      <div className="pie" style={{ background: miColor, color: textoMio }}>
        <div className="pie-arriba">
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
              <Icono tipo={r} />
              <b>{mano[r]}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
