/**
 * PIEZAS 3D (Etapa 2)
 *
 * Caminos, poblados, ciudades y ladrón con geometría propia, a la misma escala
 * que el tablero. Este archivo solo recibe una "foto" del estado (qué jugador
 * tiene cada vértice y arista); no conoce turnos ni reglas.
 *
 * Las piezas nuevas caen con una animación corta (crecen y bajan). Las que se
 * van se retiran al instante. Las geometrías y los materiales son compartidos
 * entre piezas: da igual tener 50 poblados, se dibujan con los mismos recursos.
 */
import type { BufferGeometry, Group, MeshStandardMaterial, Object3D } from 'three';
import type { Geometria, Mapa } from '../tablero';
import type { Three } from './cargar';
import {
  ALTO_CAMINO,
  ALTO_CIUDAD,
  ALTO_FICHA,
  ALTO_LADRON,
  ALTO_POBLADO,
  ANCHO_CAMINO,
  LARGO_CAMINO,
  RADIO_CIUDAD,
  RADIO_LADRON,
  RADIO_POBLADO,
  Y_TOPE,
} from './medidas';

export type PiezaVista = { uid: string; tipo: 'poblado' | 'ciudad' };

/** Estado de las piezas tal como lo pinta el 2D, pero con los colores ya resueltos. */
export type PiezasVista = {
  poblados: Record<string, PiezaVista>;
  caminos: Record<string, string>;
  /** uid del jugador → color hex de su ficha. */
  colores: Record<string, string>;
  /** Clave "r,c" del hexágono donde está el ladrón. */
  ladron: string;
};

export type Piezas3D = {
  grupo: Group;
  /** Aplica un nuevo estado. Devuelve true si cambió algo (hay que redibujar). */
  actualizar: (piezas: PiezasVista | null) => boolean;
  /** Avanza las animaciones. Devuelve true mientras queden frames. */
  animar: (dt: number) => boolean;
  /** Libera las geometrías y materiales compartidos (al desmontar la escena). */
  destruir: () => void;
};

/** Las piezas apoyan sobre la cara de la losa, con 3 mm de aire. */
const Y_PIEZA = Y_TOPE + 0.003;
const COLOR_SIN_DUENO = '#8a8a8a';

type Anim = { obj: Object3D; baseY: number; caida: number; dur: number; t: number };
type Colocada = { tipo: string; color: string; obj: Object3D };
type Geometrias = {
  poblado: BufferGeometry[];
  ciudad: BufferGeometry[];
  camino: BufferGeometry;
  ladron: BufferGeometry[];
};

export function crearPiezas(
  T: Three,
  mapa: Mapa,
  geo: Geometria,
  aMundo: (x: number, y: number) => readonly [number, number],
): Piezas3D {
  const grupo = new T.Group();
  const geos: Geometrias = {
    poblado: geosPoblado(T),
    ciudad: geosCiudad(T),
    camino: geosCamino(T),
    ladron: geosLadron(T),
  };

  // --- Materiales de plástico por color de jugador (compartidos) ---
  const materiales = new Map<string, MeshStandardMaterial>();
  const materialDe = (hex: string) => {
    let mat = materiales.get(hex);
    if (!mat) {
      mat = new T.MeshStandardMaterial({ color: hex, roughness: 0.46, metalness: 0.05 });
      materiales.set(hex, mat);
    }
    return mat;
  };
  const materialLadron = new T.MeshStandardMaterial({ color: '#17171a', roughness: 0.42, metalness: 0.14 });

  const montar = (lista: BufferGeometry[], mat: MeshStandardMaterial) => {
    const g = new T.Group();
    for (const g2 of lista) {
      const malla = new T.Mesh(g2, mat);
      malla.castShadow = true;
      malla.receiveShadow = true;
      g.add(malla);
    }
    return g;
  };

  // --- Estado actual y animaciones ---
  const poblados = new Map<string, Colocada>();
  const caminos = new Map<string, Colocada>();
  let ladron: { clave: string; obj: Group } | null = null;
  const animos = new Set<Anim>();
  // La primera foto es la partida ya en marcha: las piezas aparecen puestas, sin
  // caer todas a la vez cada vez que se entra a la vista 3D. Solo se anima lo
  // que se coloca después.
  let primera = true;

  const animarDesde = (obj: Object3D, baseY: number, caida: number, dur: number) => {
    if (primera) {
      obj.scale.setScalar(1);
      obj.position.y = baseY;
      return;
    }
    obj.scale.setScalar(0.01);
    obj.position.y = baseY + caida;
    animos.add({ obj, baseY, caida, dur, t: 0 });
  };

  const quitar = (obj: Object3D) => {
    grupo.remove(obj);
    for (const a of animos) if (a.obj === obj) animos.delete(a);
  };

  const actualizar = (piezas: PiezasVista | null) => {
    let cambios = false;
    const colorDe = (uid: string) => piezas?.colores?.[uid] ?? COLOR_SIN_DUENO;

    // --- Poblados y ciudades ---
    const vistosP = new Set<string>();
    for (const [id, pieza] of Object.entries(piezas?.poblados ?? {})) {
      const v = geo.vertices[id];
      if (!v) continue;
      const color = colorDe(pieza.uid);
      const prev = poblados.get(id);
      if (prev && prev.tipo === pieza.tipo && prev.color === color) {
        vistosP.add(id);
        continue;
      }
      if (prev) quitar(prev.obj);

      const [x, z] = aMundo(v.x, v.y);
      const obj = pieza.tipo === 'ciudad' ? montar(geos.ciudad, materialDe(color)) : montar(geos.poblado, materialDe(color));
      obj.position.set(x, Y_PIEZA, z);
      // Las ciudades miran hacia fuera: la muralla queda del lado del mar.
      obj.rotation.y = Math.atan2(x, z);
      grupo.add(obj);
      animarDesde(obj, Y_PIEZA, pieza.tipo === 'ciudad' ? 0.7 : 0.55, 0.3);

      poblados.set(id, { tipo: pieza.tipo, color, obj });
      vistosP.add(id);
      cambios = true;
    }
    for (const [id, c] of [...poblados]) {
      if (vistosP.has(id)) continue;
      quitar(c.obj);
      poblados.delete(id);
      cambios = true;
    }

    // --- Caminos ---
    const vistosC = new Set<string>();
    for (const [id, uid] of Object.entries(piezas?.caminos ?? {})) {
      const arista = geo.aristas[id];
      if (!arista) continue;
      const color = colorDe(uid);
      const prev = caminos.get(id);
      if (prev && prev.color === color) {
        vistosC.add(id);
        continue;
      }
      if (prev) quitar(prev.obj);

      const va = geo.vertices[arista.a];
      const vb = geo.vertices[arista.b];
      if (!va || !vb) continue;
      const [x1, z1] = aMundo(va.x, va.y);
      const [x2, z2] = aMundo(vb.x, vb.y);
      const malla = new T.Mesh(geos.camino, materialDe(color));
      malla.position.set((x1 + x2) / 2, Y_PIEZA, (z1 + z2) / 2);
      // La geometría va a lo largo de +X: se gira para alinearla con la arista.
      malla.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
      malla.castShadow = true;
      malla.receiveShadow = true;
      grupo.add(malla);
      animarDesde(malla, Y_PIEZA, 0.2, 0.22);

      caminos.set(id, { tipo: 'camino', color, obj: malla });
      vistosC.add(id);
      cambios = true;
    }
    for (const [id, c] of [...caminos]) {
      if (vistosC.has(id)) continue;
      quitar(c.obj);
      caminos.delete(id);
      cambios = true;
    }

    // --- Ladrón (cachalote negro) ---
    const clave = piezas?.ladron ?? '';
    if (clave !== (ladron?.clave ?? '')) {
      if (ladron) quitar(ladron.obj);
      ladron = null;
      if (clave) {
        const hex = mapa.hexes.find((h) => h.r + ',' + h.c === clave);
        if (hex) {
          const [x, z] = aMundo(hex.x, hex.y);
          // Sobre una ficha de número apoya en su tapa; en el desierto, en la losa.
          const baseY = hex.tipo !== 'desert' && hex.num > 0 ? Y_TOPE + ALTO_FICHA + 0.008 : Y_PIEZA;
          const obj = montar(geos.ladron, materialLadron);
          obj.position.set(x, baseY, z);
          grupo.add(obj);
          animarDesde(obj, baseY, 0.8, 0.34);
          ladron = { clave, obj };
        }
      }
      cambios = true;
    }

    primera = false;
    return cambios;
  };

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // El reloj de las animaciones lo lleva la escena: así el dibujo sigue
  // funcionando bajo demanda, sin un bucle permanente.
  const animar = (dt: number) => {
    for (const a of animos) {
      a.t = Math.min(1, a.t + dt / a.dur);
      a.obj.scale.setScalar(Math.max(0.01, easeOutBack(a.t)));
      a.obj.position.y = a.baseY + (1 - easeOutCubic(a.t)) * a.caida;
      if (a.t >= 1) {
        a.obj.scale.setScalar(1);
        a.obj.position.y = a.baseY;
        animos.delete(a);
      }
    }
    return animos.size > 0;
  };

  const destruir = () => {
    for (const lista of [geos.poblado, geos.ciudad, geos.ladron]) {
      for (const g of lista) g.dispose();
    }
    geos.camino.dispose();
    for (const m of materiales.values()) m.dispose();
    materialLadron.dispose();
    animos.clear();
  };

  return { grupo, actualizar, animar, destruir };
}

// --- Geometrías -------------------------------------------------------------

function geosPoblado(T: Three): BufferGeometry[] {
  const ancho = RADIO_POBLADO * 2 * 0.94;
  const altoBase = ALTO_POBLADO * 0.52;
  const base = new T.BoxGeometry(ancho, altoBase, ancho);
  base.translate(0, altoBase / 2, 0);

  const altoTecho = ALTO_POBLADO - altoBase;
  const techo = new T.ConeGeometry(ancho * 0.78, altoTecho, 4);
  techo.rotateY(Math.PI / 4);
  techo.translate(0, altoBase + altoTecho / 2, 0);

  return [base, techo];
}

function geosCiudad(T: Three): BufferGeometry[] {
  const ancho = RADIO_CIUDAD * 2;
  const baseH = 0.12;

  const base = new T.BoxGeometry(ancho * 0.92, baseH, ancho * 0.8);
  base.translate(0, baseH / 2, 0);

  // Torreón principal, con tejado a cuatro aguas.
  const altoTorre = ALTO_CIUDAD * 0.5;
  const torre = new T.BoxGeometry(ancho * 0.42, altoTorre, ancho * 0.42);
  torre.translate(-ancho * 0.13, baseH + altoTorre / 2, -ancho * 0.08);

  const altoTecho = ALTO_CIUDAD - baseH - altoTorre;
  const techo = new T.ConeGeometry(ancho * 0.42 * 0.72, altoTecho, 4);
  techo.rotateY(Math.PI / 4);
  techo.translate(-ancho * 0.13, baseH + altoTorre + altoTecho / 2, -ancho * 0.08);

  // Torre baja delantera.
  const altoTorre2 = ALTO_CIUDAD * 0.3;
  const torre2 = new T.BoxGeometry(ancho * 0.28, altoTorre2, ancho * 0.28);
  torre2.translate(ancho * 0.2, baseH + altoTorre2 / 2, ancho * 0.12);

  const altoTecho2 = ALTO_CIUDAD * 0.18;
  const techo2 = new T.ConeGeometry(ancho * 0.28 * 0.7, altoTecho2, 4);
  techo2.rotateY(Math.PI / 4);
  techo2.translate(ancho * 0.2, baseH + altoTorre2 + altoTecho2 / 2, ancho * 0.12);

  // Muralla baja que cierra la ciudad por delante.
  const muralla = new T.BoxGeometry(ancho * 0.62, ALTO_CIUDAD * 0.24, 0.12);
  muralla.translate(0, baseH + ALTO_CIUDAD * 0.12, ancho * 0.3);

  return [base, torre, techo, torre2, techo2, muralla];
}

function geosCamino(T: Three): BufferGeometry {
  const largo = LARGO_CAMINO * 0.9;
  const ancho = ANCHO_CAMINO;
  const r = Math.min(ancho / 2, 0.08);
  const x0 = -largo / 2;
  const x1 = largo / 2;
  const y0 = -ancho / 2;
  const y1 = ancho / 2;

  // Rectángulo redondeado: el camino real tiene las puntas suavizadas.
  const forma = new T.Shape();
  forma.moveTo(x0 + r, y0);
  forma.lineTo(x1 - r, y0);
  forma.quadraticCurveTo(x1, y0, x1, y0 + r);
  forma.lineTo(x1, y1 - r);
  forma.quadraticCurveTo(x1, y1, x1 - r, y1);
  forma.lineTo(x0 + r, y1);
  forma.quadraticCurveTo(x0, y1, x0, y1 - r);
  forma.lineTo(x0, y0 + r);
  forma.quadraticCurveTo(x0, y0, x0 + r, y0);

  const alto = ALTO_CAMINO;
  const bisel = 0.008;
  const geo = new T.ExtrudeGeometry(forma, {
    depth: alto,
    bevelEnabled: true,
    bevelThickness: bisel,
    bevelSize: bisel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // La extrusión nace en XY: se tumba para que el largo quede sobre el tablero.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bisel, 0);
  return geo;
}

function geosLadron(T: Three): BufferGeometry[] {
  const base = new T.CylinderGeometry(RADIO_LADRON * 0.94, RADIO_LADRON, 0.04, 28);
  base.translate(0, 0.02, 0);

  const altoCuerpo = 0.6;
  const cuerpo = new T.CylinderGeometry(0.07, RADIO_LADRON * 0.75, altoCuerpo, 24);
  cuerpo.translate(0, 0.04 + altoCuerpo / 2, 0);

  const cabeza = new T.SphereGeometry(0.09, 20, 14);
  cabeza.translate(0, 0.7, 0);

  const ala = new T.CylinderGeometry(RADIO_LADRON * 0.7, RADIO_LADRON * 0.7, 0.018, 24);
  ala.translate(0, 0.775, 0);

  const altoCopa = ALTO_LADRON - 0.78;
  const copa = new T.ConeGeometry(0.085, altoCopa, 18);
  copa.translate(0, 0.78 + altoCopa / 2, 0);

  return [base, cuerpo, cabeza, ala, copa];
}
