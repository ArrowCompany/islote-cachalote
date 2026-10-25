import { useEffect, useState } from 'react';
import { COLORES, CONFIG_INICIAL, agregarBots, cambiarColor, crearSala, escucharRanking, escucharSala, existeJugador, guardarConfig, iniciarPartida, iniciarSesion, marcarListo, marcarPresencia, salirSala, unirseSala } from './salas';
import type { Config, Sala } from './salas';
import Juego from './Juego';
import Partida from './Partida';
import './lobby.css';

type Pantalla = 'inicio' | 'sala' | 'partida' | 'prueba';

const MIN_JUGADORES = 2;
const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Algo salió mal, intenta otra vez');

export default function Inicio() {
  const [uid, setUid] = useState('');
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [nombre, setNombre] = useState(localStorage.getItem('nombre') ?? '');
  const [color, setColor] = useState(localStorage.getItem('color') ?? '');
  const [codigo, setCodigo] = useState(new URLSearchParams(window.location.search).get('sala') ?? '');
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mostrarRanking, setMostrarRanking] = useState(false);
  const [ranking, setRanking] = useState<{ uid: string; nombre: string; puntos: number; partidas: number }[]>([]);
  const [editarPerfil, setEditarPerfil] = useState(false);

  useEffect(() => {
    iniciarSesion().then((u) => setUid(u.uid)).catch((e) => setError(mensaje(e)));
  }, []);

  useEffect(() => {
    const guardada = localStorage.getItem('sala');
    if (!uid || !guardada) return;
    existeJugador(guardada, uid).then((ok) => {
      if (ok) {
        setCodigo(guardada);
        setPantalla('sala');
      } else {
        localStorage.removeItem('sala');
      }
    });
  }, [uid]);

  useEffect(() => {
    if (pantalla === 'inicio' || !uid || !codigo) return;
    const dejarDeEscuchar = escucharSala(codigo, setSala);
    const dejarPresencia = marcarPresencia(codigo, uid);
    return () => {
      dejarDeEscuchar();
      dejarPresencia();
    };
  }, [pantalla, uid, codigo]);

  useEffect(() => {
    if (pantalla === 'sala' && sala?.estado === 'jugando') setPantalla('partida');
  }, [pantalla, sala]);

  useEffect(() => {
    if (!mostrarRanking) return;
    const off = escucharRanking(setRanking);
    return () => off();
  }, [mostrarRanking]);

  const datosValidos = () => {
    if (!uid) { setError('Conectando, espera un momento...'); return false; }
    if (nombre.trim().length < 2) { setError('Escribe tu nombre'); return false; }
    if (!color) { setError('Elige tu color'); return false; }
    return true;
  };
  const entrarASala = (c: string) => {
    localStorage.setItem('nombre', nombre.trim());
    localStorage.setItem('color', color);
    localStorage.setItem('sala', c);
    setCodigo(c);
    setSala(null);
    setPantalla('sala');
  };
  const crear = async () => {
    setError('');
    if (!datosValidos()) return;
    setCargando(true);
    try {
      entrarASala(await crearSala(uid, nombre.trim(), color));
    } catch (e) {
      setError(mensaje(e));
    }
    setCargando(false);
  };
  const entrar = async () => {
    setError('');
    if (!datosValidos()) return;
    const c = codigo.trim();
    if (c.length !== 6) { setError('El código tiene 6 números'); return; }
    setCargando(true);
    try {
      await unirseSala(c, uid, nombre.trim(), color);
      entrarASala(c);
    } catch (e) {
      setError(mensaje(e));
    }
    setCargando(false);
  };
  const salir = async () => {
    try {
      await salirSala(codigo, uid);
    } catch (e) {
      setError(mensaje(e));
    }
    localStorage.removeItem('sala');
    setSala(null);
    setPantalla('inicio');
  };
  const salirDePartida = () => {
    if (window.confirm('¿Salir de la partida?')) void salir();
  };
  const elegirColor = async (id: string) => {
    setError('');
    try {
      await cambiarColor(codigo, uid, id);
      setColor(id);
      localStorage.setItem('color', id);
    } catch (e) {
      setError(mensaje(e));
    }
  };
  const copiar = async () => {
    const enlace = window.location.origin + window.location.pathname + '?sala=' + codigo;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No pude copiar. Pasa este código: ' + codigo);
    }
  };

  if (pantalla === 'prueba') {
    return (
      <div>
        <button className="volver" onClick={() => setPantalla('sala')}>← Volver a la sala</button>
        <Juego />
      </div>
    );
  }

  if (pantalla === 'partida') {
    if (!sala?.partida || !sala.juego) {
      return (
        <div className="lobby">
          <div className="caja"><p>Cargando partida...</p></div>
        </div>
      );
    }
    return <Partida sala={sala} uid={uid} codigo={codigo} onSalir={salirDePartida} />;
  }

  if (pantalla === 'sala') {
    const jugadores = Object.entries(sala?.jugadores ?? {})
      .filter(([, j]) => j.nombre)
      .sort((a, b) => a[1].orden - b[1].orden);
    const yo = sala?.jugadores?.[uid];
    const ocupados = jugadores.filter(([id]) => id !== uid).map(([, j]) => j.color);
    const hex = (id: string) => COLORES.find((c) => c.id === id)?.hex ?? '#888';
    const cfg: Config = sala?.config ?? CONFIG_INICIAL;
    const mapaElegido: 'cachalote' | 'catan' = cfg.mapa === 'catan' ? 'catan' : 'cachalote';
    const esAnfitrion = sala?.anfitrion === uid;
    const todosListos = jugadores.length >= MIN_JUGADORES && jugadores.every(([, j]) => j.listo);
    const cambiarCfg = (parcial: Partial<Config>) => {
      void guardarConfig(codigo, { ...cfg, ...parcial });
    };
    const iniciar = async () => {
      setError('');
      try {
        await iniciarPartida(codigo, cfg, jugadores.map(([id]) => id));
      } catch (e) {
        setError(mensaje(e));
      }
    };
    const iniciarSolo = async () => {
      setError('');
      setCargando(true);
      try {
        const todos = await agregarBots(codigo, 2);
        await iniciarPartida(codigo, cfg, todos);
      } catch (e) {
        setError(mensaje(e));
      }
      setCargando(false);
    };
    return (
      <div className="lobby">
        <div className="caja">
          <h1>Sala de espera</h1>
          <div className="codigo">{codigo}</div>
          <button className="btn sec" onClick={copiar}>{copiado ? '¡Enlace copiado!' : 'Copiar enlace para invitar'}</button>
          <button className="btn sec" onClick={() => setMostrarRanking(true)}>🏆 Ranking</button>
          {error && <div className="error">{error}</div>}
          {!sala && <p>Cargando sala...</p>}
          {sala && !yo && <p>Ya no estás en esta sala.</p>}
          <h2>Jugadores ({jugadores.length}/6)</h2>
          <div className="lista">
            {jugadores.map(([id, j]) => (
              <div className="fila" key={id}>
                <span className="punto" style={{ background: hex(j.color) }} />
                <span className="nombre">{j.bot || id.startsWith('bot_') ? '🤖 ' : ''}{j.nombre}{id === sala?.anfitrion ? ' 👑' : ''}{id === uid ? ' (tú)' : ''}</span>
                <span className="estado">{j.conectado === false ? '⚪ desconectado' : j.listo ? '✅ listo' : '⏳ esperando'}</span>
              </div>
            ))}
          </div>
          {yo && (
            <>
              <h2>Tu color</h2>
              <div className="colores">
                {COLORES.map((c) => (
                  <button
                    key={c.id}
                    title={c.nombre}
                    aria-label={c.nombre}
                    className={yo.color === c.id ? 'sel' : ''}
                    style={{ background: c.hex }}
                    disabled={ocupados.includes(c.id)}
                    onClick={() => elegirColor(c.id)}
                  />
                ))}
              </div>
              <button className="btn" onClick={() => void marcarListo(codigo, uid, !yo.listo)}>
                {yo.listo ? 'Ya no estoy listo' : 'Estoy listo'}
              </button>
            </>
          )}
          <h2>Configuración {esAnfitrion ? '' : '(la elige el anfitrión)'}</h2>
          <div className="opciones">
            <span className="etq">Mapa</span>
            <div className="grupo">
              <button className={mapaElegido === 'cachalote' ? 'on' : ''} disabled={!esAnfitrion} onClick={() => cambiarCfg({ mapa: 'cachalote' })}>🐋 Mapa cachalote</button>
              <button className={mapaElegido === 'catan' ? 'on' : ''} disabled={!esAnfitrion} onClick={() => cambiarCfg({ mapa: 'catan' })}>🏝️ Mapa tipo Catan</button>
            </div>
            <small>{mapaElegido === 'cachalote' ? 'La isla tiene forma de cachalote.' : 'La isla tiene la forma clásica del Catan.'} En los dos, los hexágonos, los números y los puertos cambian al azar en cada partida.</small>
            <span className="etq">Chat de grupo</span>
            <div className="grupo">
              <button className={cfg.chat ? 'on' : ''} disabled={!esAnfitrion} onClick={() => cambiarCfg({ chat: true })}>Con chat</button>
              <button className={!cfg.chat ? 'on' : ''} disabled={!esAnfitrion} onClick={() => cambiarCfg({ chat: false })}>Sin chat</button>
            </div>
            <span className="etq">Reloj por turno</span>
            <div className="grupo">
              {([40, 60, 90] as const).map((s) => (
                <button key={s} className={cfg.reloj === s ? 'on' : ''} disabled={!esAnfitrion} onClick={() => cambiarCfg({ reloj: s })}>{s} segundos</button>
              ))}
            </div>
          </div>
          {esAnfitrion ? (
            <>
              <button className="btn" disabled={cargando} onClick={iniciarSolo}>🤖 Jugar solo con 2 bots</button>
              <button className="btn" disabled={!todosListos} onClick={iniciar}>Iniciar partida</button>
              {!todosListos && <p>Para iniciar, todos deben tocar "Estoy listo" (mínimo {MIN_JUGADORES} jugadores).</p>}
            </>
          ) : (
            <p>Esperando que el anfitrión inicie la partida...</p>
          )}
          <button className="btn sec" onClick={() => setPantalla('prueba')}>Ver tablero de prueba</button>
          <button className="btn sec" onClick={salir}>Salir de la sala</button>

          {mostrarRanking && (
            <div className="modal-ranking">
              <div className="modal-ranking-caja">
                <h2>🏆 Ranking</h2>
                <div className="lista">
                  {ranking.length === 0 && <p>Sin datos aún.</p>}
                  {ranking.map((r, i) => (
                    <div className="fila" key={r.uid}>
                      <span className="nombre">{i + 1}. {r.nombre}</span>
                      <span className="estado">{r.puntos} pts · {r.partidas} partidas</span>
                    </div>
                  ))}
                </div>
                <button className="btn sec" onClick={() => setMostrarRanking(false)}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="caja">
        <h1>Islote Cachalote 🐋</h1>
        {nombre && color && !editarPerfil ? (
          <>
            <p>¡Hola, <b>{nombre}</b>! Tu color:</p>
            <div className="colores">
              <span className="punto" style={{ background: COLORES.find((c) => c.id === color)?.hex ?? '#888', width: 32, height: 32, borderRadius: '50%', display: 'inline-block' }} />
            </div>
            <button className="btn sec" onClick={() => setEditarPerfil(true)}>Cambiar nombre o color</button>
          </>
        ) : (
          <>
            <p>¡Hola! Antes de empezar, escribe tu nombre y elige tu color.</p>
            <input placeholder="Tu nombre" value={nombre} maxLength={14} onChange={(e) => setNombre(e.target.value)} />
            <div className="colores">
              {COLORES.map((c) => (
                <button
                  key={c.id}
                  title={c.nombre}
                  aria-label={c.nombre}
                  className={color === c.id ? 'sel' : ''}
                  style={{ background: c.hex }}
                  onClick={() => setColor(c.id)}
                />
              ))}
            </div>
            {nombre && color && <button className="btn sec" onClick={() => setEditarPerfil(false)}>Listo</button>}
          </>
        )}
        {error && <div className="error">{error}</div>}
        <h2>Entrar a una sala</h2>
        <input
          placeholder="Código de la sala (6 números)"
          inputMode="numeric"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn" disabled={cargando} onClick={entrar}>Entrar a la sala</button>
        <h2>¿Eres el anfitrión?</h2>
        <button className="btn sec" disabled={cargando} onClick={crear}>Crear sala nueva</button>
      </div>
    </div>
  );
}
