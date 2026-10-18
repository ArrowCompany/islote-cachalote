import { useEffect, useRef, useState } from 'react';
import { COLORES } from './salas';
import type { Sala } from './salas';
import { ahoraServidor, terminarTurno, tiempoAgotado, tirarDados } from './turnos';
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
const colorDe = (id: string) => COLORES.find((c) => c.id === id)?.hex ?? '#888';

function Dado({ valor, rodando }: { valor: number; rodando: boolean }) {
  return (
    <div className={rodando ? 'dado rodando' : 'dado'}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PUNTOS[valor].includes(i) ? 'p on' : 'p'} />
      ))}
    </div>
  );
}

export default function Partida({ sala, uid, codigo, onSalir }: Props) {
  const juego = sala.juego;
  const partida = sala.partida;
  const hayJuego = !!juego && !!partida;
  const reloj = sala.config?.reloj ?? 60;
  const tirada = juego?.tirada ?? 0;
  const inicio = juego?.inicioTurno ?? 0;
  const numTurno = juego?.numTurno ?? 0;
  const actualUid = juego ? juego.orden[juego.turno] : '';
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

  if (!juego || !partida) {
    return (
      <div className="partida">
        <p className="cargando">Cargando partida...</p>
      </div>
    );
  }

  const nombreDe = (id: string) => sala.jugadores?.[id]?.nombre ?? 'Jugador';
  const valores: [number, number] = rodando ? azar : (juego.dados ?? [1, 1]);
  const suma = juego.dados ? juego.dados[0] + juego.dados[1] : 0;

  const tirar = async () => {
    setError('');
    try {
      await tirarDados(codigo, numTurno);
    } catch {
      setError('No pude tirar los dados, intenta otra vez');
    }
  };
  const terminar = async () => {
    setError('');
    try {
      await terminarTurno(codigo, numTurno);
    } catch {
      setError('No pude terminar el turno, intenta otra vez');
    }
  };

  return (
    <div className="partida">
      <div className="cabecera">
        <button className="salir" onClick={onSalir}>Salir</button>
        <div className="turno">{soyActual ? '¡Es tu turno!' : 'Turno de ' + nombreDe(actualUid)}</div>
        <div className={restante <= 10 ? 'reloj urgente' : 'reloj'}>⏱ {restante}</div>
      </div>

      <div className="jugadores">
        {juego.orden.map((id) => {
          const e = juego.stats[id];
          return (
            <div key={id} className={id === actualUid ? 'jug actual' : 'jug'}>
              <div className="jug-nombre">
                <span className="punto" style={{ background: colorDe(sala.jugadores?.[id]?.color ?? '') }} />
                <span>{nombreDe(id)}{id === uid ? ' (tú)' : ''}</span>
                {sala.jugadores?.[id]?.conectado === false && <span> ⚪</span>}
              </div>
              <div className="jug-datos">🃏 {e.cartas} · 🎴 {e.desarrollo} · ⚔️ {e.caballeros} · ⭐ {e.puntos}</div>
            </div>
          );
        })}
      </div>

      <div className="tablero-caja">
        <Juego modo={partida.modo} semilla={partida.semilla} />
      </div>

      <div className="pie">
        <div className="dados">
          <Dado valor={valores[0]} rodando={rodando} />
          <Dado valor={valores[1]} rodando={rodando} />
        </div>
        <div className="acciones">
          {!rodando && juego.dados && (
            <div className="suma">Salió {suma}{suma === 7 ? ' 🐋 (el cachalote se mueve más adelante)' : ''}</div>
          )}
          {soyActual && juego.fase === 'tirar' && <button className="accion" onClick={tirar}>🎲 Tirar dados</button>}
          {soyActual && juego.fase === 'accion' && <button className="accion" onClick={terminar}>Terminar turno ➜</button>}
          {!soyActual && <span className="espera">Esperando a {nombreDe(actualUid)}...</span>}
          {error && <div className="error-mini">{error}</div>}
        </div>
      </div>
    </div>
  );
}