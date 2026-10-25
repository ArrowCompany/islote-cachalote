/**
 * CÁMARA ORBITADA (sin OrbitControls de Three.js)
 *
 * - Arrastrar con el mouse o el dedo: gira alrededor del tablero.
 * - Rueda del mouse o pellizco con dos dedos: acerca / aleja.
 * - El movimiento es suave (interpolado) para que no se sienta brusco.
 */
import type { PerspectiveCamera, Vector3 } from 'three';
import type { Three } from './cargar';

export type Orbita = {
  /** Aplica el suavizado. Devuelve true si aún quedan frames por animar. */
  paso: (dt: number) => boolean;
  acercar: (factor: number) => void;
  girar: (grados: number) => void;
  /** Ajusta la distancia para que la huella del tablero quepa en pantalla. */
  encuadrar: (puntos: Vector3[]) => void;
  reiniciar: () => void;
  /** true cuando el jugador ya movió la cámara a mano. */
  tocado: boolean;
  destruir: () => void;
};

const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function crearOrbita(T: Three, camara: PerspectiveCamera, dom: HTMLElement, pedir: () => void): Orbita {
  // El tablero está centrado en (0,0,0); miramos un poco por encima del agua.
  const objetivo = new T.Vector3(0, 0.35, 0);

  // Vista inicial: desde el sur, inclinada ~55° (parecida a Catan Universe).
  const vista = { azimut: Math.PI / 2, elevacion: 0.95, distancia: 14 };
  const meta = { ...vista };

  let distMin = 6;
  let distMax = 40;
  let tocado = false;

  // Puntos de la huella del tablero (vértices de las losas): con ellos se
  // calcula el encuadre exacto, sin desperdiciar pantalla como haría un círculo.
  let puntosEncuadre: Vector3[] = [];
  const proyectado = new T.Vector3();

  /** Caja del tablero en NDC con la cámara actual. */
  const caja = () => {
    camara.updateMatrixWorld();
    camara.updateProjectionMatrix();
    let mayor = 0;
    let minY = 1;
    let maxY = -1;
    for (const p of puntosEncuadre) {
      proyectado.copy(p).project(camara);
      mayor = Math.max(mayor, Math.abs(proyectado.x), Math.abs(proyectado.y));
      minY = Math.min(minY, proyectado.y);
      maxY = Math.max(maxY, proyectado.y);
    }
    return { mayor, centroY: (minY + maxY) / 2 };
  };

  /** Deja la huella del tablero al 88% de la pantalla (12% de margen). */
  const ajustarDistancia = () => {
    let d = vista.distancia;
    for (let intento = 0; intento < 8; intento++) {
      vista.distancia = d;
      aplicar();
      const { mayor } = caja();
      if (mayor < 1e-4) break;
      d = acotar(d * (mayor / 0.88), 2, 200);
    }
    return d;
  };

  const aplicar = () => {
    const cos = Math.cos(vista.elevacion);
    camara.position.set(
      objetivo.x + vista.distancia * cos * Math.cos(vista.azimut),
      objetivo.y + vista.distancia * Math.sin(vista.elevacion),
      objetivo.z + vista.distancia * cos * Math.sin(vista.azimut),
    );
    camara.lookAt(objetivo);
  };

  const paso = (dt: number) => {
    // Interpolación exponencial: independiente de los FPS.
    const k = 1 - Math.exp(-dt * 14);
    vista.azimut += (meta.azimut - vista.azimut) * k;
    vista.elevacion += (meta.elevacion - vista.elevacion) * k;
    vista.distancia += (meta.distancia - vista.distancia) * k;
    aplicar();

    // Al girar, la isla puede asomarse fuera de la pantalla: la cámara se aleja
    // lo justo para que vuelva a entrar. Nunca se acerca sola.
    if (puntosEncuadre.length > 0) {
      const { mayor } = caja();
      if (mayor > 1.01) meta.distancia = acotar(meta.distancia * (mayor / 0.94), distMin, distMax);
    }

    const cerca =
      Math.abs(meta.azimut - vista.azimut) < 0.0004 &&
      Math.abs(meta.elevacion - vista.elevacion) < 0.0004 &&
      Math.abs(meta.distancia - vista.distancia) < 0.002;
    if (cerca) {
      vista.azimut = meta.azimut;
      vista.elevacion = meta.elevacion;
      vista.distancia = meta.distancia;
      aplicar();
    }
    return !cerca;
  };

  const acercar = (factor: number) => {
    meta.distancia = acotar(meta.distancia / factor, distMin, distMax);
    tocado = true;
    pedir();
  };

  const girar = (grados: number) => {
    meta.azimut += (grados * Math.PI) / 180;
    tocado = true;
    pedir();
  };

  const encuadrar = (puntos: Vector3[]) => {
    puntosEncuadre = puntos;
    objetivo.set(0, 0.35, 0);
    let d = ajustarDistancia();

    // La perspectiva agranda el borde cercano y deja aire arriba: se corre el
    // punto de mira sobre el suelo hasta que el tablero queda centrado.
    for (let pasada = 0; pasada < 3; pasada++) {
      vista.distancia = d;
      aplicar();
      const { centroY } = caja();
      if (Math.abs(centroY) < 0.01) break;
      const k = acotar(-centroY * 5, -3, 3);
      objetivo.x += Math.cos(vista.azimut) * k;
      objetivo.z += Math.sin(vista.azimut) * k;
      d = ajustarDistancia();
    }

    meta.distancia = d;
    vista.distancia = d;
    distMin = d * 0.55;
    distMax = d * 2.6;
    aplicar();
    pedir();
  };

  const reiniciar = () => {
    meta.azimut = Math.PI / 2;
    meta.elevacion = 0.95;
    encuadrar(puntosEncuadre);
    tocado = false;
  };

  // --- Gestos ---
  const punteros = new Map<number, { x: number; y: number }>();
  let pinzaPrevia = 0;

  const abajo = (e: PointerEvent) => {
    dom.setPointerCapture?.(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      pinzaPrevia = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const mover = (e: PointerEvent) => {
    const p = punteros.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (punteros.size === 1) {
      // Girar: el tablero sigue el dedo.
      meta.azimut -= dx * 0.007;
      meta.elevacion = acotar(meta.elevacion + dy * 0.006, 0.3, 1.5);
      tocado = true;
      pedir();
      return;
    }

    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinzaPrevia > 0 && d > 0) {
        meta.distancia = acotar(meta.distancia * (pinzaPrevia / d), distMin, distMax);
      }
      pinzaPrevia = d;
      tocado = true;
      pedir();
    }
  };

  const soltar = (e: PointerEvent) => {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) pinzaPrevia = 0;
  };

  const rueda = (e: WheelEvent) => {
    e.preventDefault();
    meta.distancia = acotar(meta.distancia * Math.exp(e.deltaY * 0.0012), distMin, distMax);
    tocado = true;
    pedir();
  };

  dom.addEventListener('pointerdown', abajo);
  dom.addEventListener('pointermove', mover);
  dom.addEventListener('pointerup', soltar);
  dom.addEventListener('pointercancel', soltar);
  dom.addEventListener('lostpointercapture', soltar);
  dom.addEventListener('wheel', rueda, { passive: false });

  const destruir = () => {
    dom.removeEventListener('pointerdown', abajo);
    dom.removeEventListener('pointermove', mover);
    dom.removeEventListener('pointerup', soltar);
    dom.removeEventListener('pointercancel', soltar);
    dom.removeEventListener('lostpointercapture', soltar);
    dom.removeEventListener('wheel', rueda);
  };

  return {
    paso,
    acercar,
    girar,
    encuadrar,
    reiniciar,
    destruir,
    get tocado() {
      return tocado;
    },
  };
}
