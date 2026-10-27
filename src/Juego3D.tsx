/**
 * VISTA 3D DEL TABLERO
 *
 * Componente "tonto": recibe el mapa ya generado y lo dibuja en 3D.
 * No conoce reglas, turnos ni jugadores; eso vive en Partida/reglas.
 */
import { useEffect, useRef, useState } from 'react';
import { mapaDe } from './tablero';
import type { Modo } from './tablero';
import { cargarThree } from './vista3d/cargar';
import { montarEscena } from './vista3d/escena';
import type { Control3D } from './vista3d/escena';
import type { PiezasVista } from './vista3d/piezas3d';
import type { CartaVuelo } from './vista3d/vuelo3d';
import './vista3d.css';

type Props = {
  modo: Modo;
  semilla: number;
  /** Caminos, poblados, ciudades y ladrón del estado actual (si hay partida). */
  piezas?: PiezasVista | null;
  /** Último resultado de dados (para mostrarlos al montar la vista). */
  dados?: [number, number] | null;
  /** Evento de tirada: dispara la animación de dados y luego el vuelo de cartas. */
  evento3d?: { id: number; dados: [number, number]; cartas: CartaVuelo[] } | null;
  /** Entrega el control de la cámara al padre (para los botones de zoom). */
  onListo?: (control: Control3D | null) => void;
  /** Se llama si no se pudo cargar Three.js o no hay WebGL. */
  onFallo?: (error: unknown) => void;
};

export default function Juego3D({ modo, semilla, piezas, dados, evento3d, onListo, onFallo }: Props) {
  const caja = useRef<HTMLDivElement | null>(null);
  const control = useRef<Control3D | null>(null);
  const avisos = useRef({ onListo, onFallo });
  const piezasRef = useRef<PiezasVista | null>(piezas ?? null);
  const dadosRef = useRef<[number, number] | null>(dados ?? null);
  const eventoRef = useRef(evento3d ?? null);
  const idRef = useRef(evento3d?.id ?? 0);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [detalle, setDetalle] = useState('');
  const [intento, setIntento] = useState(0);

  // Siempre se usan los callbacks y las piezas más recientes sin reiniciar la escena.
  useEffect(() => {
    avisos.current = { onListo, onFallo };
  });
  piezasRef.current = piezas ?? null;
  dadosRef.current = dados ?? null;
  eventoRef.current = evento3d ?? null;

  useEffect(() => {
    let vivo = true;
    let escena: Control3D | null = null;
    setEstado('cargando');
    setDetalle('');

    void (async () => {
      try {
        const T = await cargarThree();
        if (!vivo || !caja.current) return;
        escena = montarEscena(caja.current, T, mapaDe(modo, semilla));
        if (!vivo) {
          escena.destruir();
          return;
        }
        escena.piezas(piezasRef.current);
        if (dadosRef.current) escena.dados(dadosRef.current, undefined, false);
        control.current = escena;
        avisos.current.onListo?.(escena);
        setEstado('listo');
      } catch (e) {
        if (!vivo) return;
        setDetalle(e instanceof Error ? e.message : 'No se pudo cargar el 3D');
        setEstado('error');
        avisos.current.onFallo?.(e);
      }
    })();

    return () => {
      vivo = false;
      avisos.current.onListo?.(null);
      control.current = null;
      escena?.destruir();
    };
  }, [modo, semilla, intento]);

  // Cambios de la partida (nuevos caminos, poblados, ciudades o ladrón) se
  // aplican en caliente, sin reconstruir la escena.
  useEffect(() => {
    if (estado === 'listo') control.current?.piezas(piezas ?? null);
  }, [piezas, estado]);

  // Evento de tirada: primero ruedan los dados, al terminar vuelan las cartas.
  useEffect(() => {
    if (estado !== 'listo' || !evento3d) return;
    if (evento3d.id === idRef.current) return;
    idRef.current = evento3d.id;
    control.current?.dados(evento3d.dados, () => {
      if (evento3d.cartas.length) control.current?.produccion(evento3d.cartas);
    }, true);
  }, [evento3d, estado]);

  return (
    <div className="vista3d" ref={caja}>
      {estado === 'cargando' && (
        <div className="aviso3d">
          <span className="girando3d" />
          Cargando tablero 3D…
        </div>
      )}

      {estado === 'error' && (
        <div className="aviso3d error">
          <strong>No se pudo cargar el 3D</strong>
          <span>{detalle}</span>
          <span>Revisa tu conexión. Puedes seguir jugando en 2D.</span>
          <button onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      )}

      {estado === 'listo' && (
        <div className="pista3d">Arrastra para girar · rueda o pellizco para acercar</div>
      )}
    </div>
  );
}
