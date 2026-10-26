/**
 * ESCENA 3D
 *
 * Monta el renderer, la cámara, las luces y el tablero dentro de un contenedor
 * HTML. Solo se dibuja cuando algo cambia (cámara o resize), para no gastar
 * batería en móvil.
 */
import type { Material, Mesh, Object3D } from 'three';
import { geometriaDe } from '../tablero';
import type { Mapa } from '../tablero';
import type { Three } from './cargar';
import { crearOrbita } from './camara';
import { crearPiezas } from './piezas3d';
import type { PiezasVista } from './piezas3d';
import { crearTablero, proyectoMapa } from './tablero3d';

export type Control3D = {
  acercar: (factor: number) => void;
  girar: (grados: number) => void;
  /** Vuelve a la vista inicial y reencuadra el tablero. */
  reiniciar: () => void;
  /** Actualiza caminos, poblados, ciudades y ladrón. */
  piezas: (piezas: PiezasVista | null) => void;
  destruir: () => void;
};

export function montarEscena(caja: HTMLElement, T: Three, mapa: Mapa): Control3D {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    // En desarrollo se conserva el buffer para poder revisar el render píxel a píxel.
    preserveDrawingBuffer: import.meta.env.DEV,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = T.SRGBColorSpace;
  caja.appendChild(renderer.domElement);

  const escena = new T.Scene();
  const camara = new T.PerspectiveCamera(45, 1, 0.5, 240);

  const tablero = crearTablero(T, mapa);
  escena.add(tablero.grupo);

  // Piezas de los jugadores: reciben su estado desde React y se animan aquí.
  const piezas3d = crearPiezas(T, mapa, geometriaDe(mapa.modo, mapa.semilla), proyectoMapa(mapa));
  escena.add(piezas3d.grupo);

  // Herramienta de depuración (solo en desarrollo): deja la escena accesible
  // para poder proyectar puntos del mundo a píxeles y comprobar el render.
  if (import.meta.env.DEV) {
    (window as Window & { __islote3d?: unknown }).__islote3d = { T, escena, camara, renderer, tablero, piezas: piezas3d };
  }

  // --- Luces ---
  // Sol: luz cálida desde arriba a la izquierda, con sombras suaves.
  const sol = new T.DirectionalLight(0xfff1d6, 2.5);
  sol.position.set(-7, 12, 7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  sol.shadow.radius = 4;
  const sombra = sol.shadow.camera;
  const margen = tablero.radio + 2;
  sombra.left = -margen;
  sombra.right = margen;
  sombra.top = margen;
  sombra.bottom = -margen;
  sombra.near = 1;
  sombra.far = 45;
  sombra.updateProjectionMatrix();
  escena.add(sol);
  escena.add(sol.target);

  // Cielo/rebote: da color a las zonas en sombra.
  escena.add(new T.HemisphereLight(0xd6ecff, 0x1d3a2b, 0.85));

  // Contraluz fría para separar la isla del fondo.
  const relleno = new T.DirectionalLight(0xa9d3ff, 0.45);
  relleno.position.set(8, 7, -7);
  escena.add(relleno);

  // --- Bucle de dibujo bajo demanda ---
  let raf = 0;
  let ultimo = 0;
  const pedir = () => {
    if (!raf) raf = requestAnimationFrame(marco);
  };
  const marco = (t: number) => {
    raf = 0;
    const dt = ultimo ? Math.min(0.05, (t - ultimo) / 1000) : 0.016;
    ultimo = t;
    const animandoCamara = orbita.paso(dt);
    const animandoPiezas = piezas3d.animar(dt);
    renderer.render(escena, camara);
    if (animandoCamara || animandoPiezas) pedir();
  };

  const orbita = crearOrbita(T, camara, caja, pedir);

  const medir = () => {
    const ancho = Math.max(1, caja.clientWidth);
    const alto = Math.max(1, caja.clientHeight);
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  };

  medir();
  orbita.encuadrar(tablero.encuadre);
  pedir();

  // Al cambiar el tamaño (girar el móvil, abrir paneles) se reencuadra,
  // salvo que el jugador ya haya movido la cámara a mano.
  const observador = new ResizeObserver(() => {
    medir();
    if (!orbita.tocado) orbita.encuadrar(tablero.encuadre);
    pedir();
  });
  observador.observe(caja);

  // --- Limpieza: liberar geometrías, materiales y texturas ---
  const liberar = (raiz: Object3D) => {
    raiz.traverse((obj) => {
      const malla = obj as Mesh;
      malla.geometry?.dispose();
      const materiales: Material[] = Array.isArray(malla.material)
        ? malla.material
        : malla.material
          ? [malla.material]
          : [];
      for (const material of materiales) {
        const conTextura = material as Material & { map?: { dispose: () => void } };
        conTextura.map?.dispose();
        material.dispose();
      }
    });
  };

  const destruir = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    observador.disconnect();
    orbita.destruir();
    piezas3d.destruir();
    liberar(escena);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    if (import.meta.env.DEV) delete (window as Window & { __islote3d?: unknown }).__islote3d;
  };

  return {
    acercar: (factor) => orbita.acercar(factor),
    girar: (grados) => orbita.girar(grados),
    reiniciar: () => orbita.reiniciar(),
    piezas: (estado) => {
      if (piezas3d.actualizar(estado)) pedir();
    },
    destruir,
  };
}
