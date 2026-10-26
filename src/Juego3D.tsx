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
import './vista3d.css';

type Props = {
  modo: Modo;
  semilla: number;
  /** Caminos, poblados, ciudades y ladrón del estado actual (si hay partida). */
  piezas?: PiezasVista | null;
  /** Entrega el control de la cámara al padre (para los botones de zoom). */
  onListo?: (control: Control3D | null) => void;
  /** Se llama si no se pudo cargar Three.js o no hay WebGL. */
  onFallo?: (error: unknown) => void;
};

export default function Juego3D({ modo, semilla, piezas, onListo, onFallo }: Props) {
  const caja = useRef<HTMLDivElement | null>(null);
  const control = useRef<Control3D | null>(null);
  const avisos = useRef({ onListo, onFallo });
  const piezasRef = useRef<PiezasVista | null>(piezas ?? null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [detalle, setDetalle] = useState('');
  const [intento, setIntento] = useState(0);

  // Siempre se usan los callbacks y las piezas más recientes sin reiniciar la escena.
  useEffect(() => {
    avisos.current = { onListo, onFallo };
  });
  piezasRef.current = piezas ?? null;

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
