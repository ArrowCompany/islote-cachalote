/**
 * TABLERO 3D PROCEDURAL
 *
 * Construye la isla entera con geometría propia (sin modelos externos):
 * losas con bisel, agua, arena, fichas de número y decoración por recurso.
 *
 * Este archivo SOLO dibuja a partir de los datos del mapa (`Mapa` de tablero.ts).
 * No conoce reglas, turnos ni jugadores.
 */
import type { BufferGeometry, Group, Matrix4, MeshStandardMaterial, Texture, Vector3 } from 'three';
import type { Hex, Mapa } from '../tablero';
import { S, posicion } from '../tablero';
import type { Three } from './cargar';
import {
  ALTURA_ARENA,
  ALTURA_MAR,
  ALTO_FICHA,
  ALTO_TOTAL,
  BISEL,
  PUNTOS_NUMERO,
  RADIO_ARENA,
  RADIO_FICHA,
  RADIO_LOSA,
  RADIO_MAR,
  Y_ARENA,
  Y_LOSA,
  Y_TOPE,
} from './medidas';
import {
  AGUA,
  AGUA_CLARA,
  AGUA_PROFUNDA,
  AGUA_SOMERA,
  ARBOL_COPA,
  ARBOL_COPA_CLARA,
  ARBOL_TRONCO,
  ARENA,
  COLINA,
  DUNA,
  FICHA_BORDE,
  FICHA_FONDO,
  FICHA_LINEA,
  MONTANA,
  MONTANA_CLARA,
  OVEJA,
  OVEJA_CARA,
  ROJO_NUMERO,
  TIERRA,
  TINTA,
  TRIGO,
} from './colores';

export type Tablero = {
  grupo: Group;
  /** Radio del tablero en unidades de mundo (para la cámara de sombras). */
  radio: number;
  /** Vértices de las losas en coordenadas de mundo, para encuadrar la cámara. */
  encuadre: Vector3[];
};

/**
 * Orientación de las fichas para que el número se lea desde la cámara inicial.
 *
 * La tapa del cilindro mapea la textura así: +u → +Z y +v → +X. La cámara
 * inicial mira desde +Z, o sea que en pantalla "arriba" es -Z y "derecha" es +X.
 * Girando 90° la textura queda con su "arriba" (+v) hacia -Z y su "derecha"
 * (+u) hacia +X, que es justo lo que hace falta para leer el número de frente.
 */
const GIRO_FICHA = Math.PI / 2;

type Matrices = Record<string, Matrix4[]>;

const matricesVacias = (): Matrices => ({
  tronco: [],
  copaBaja: [],
  copa: [],
  montana: [],
  piedra: [],
  colina: [],
  oveja: [],
  cabeza: [],
  trigo: [],
  duna: [],
});

/** Generador pseudoaleatorio con semilla: la decoración sale siempre igual. */
function azarDe(semilla: number) {
  let s = Math.abs(Math.floor(semilla)) % 2147483647;
  if (s <= 0) s = 12345;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function matriz(
  T: Three,
  x: number,
  y: number,
  z: number,
  ry = 0,
  sx = 1,
  sy: number = sx,
  sz: number = sx,
): Matrix4 {
  return new T.Matrix4().compose(
    new T.Vector3(x, y, z),
    new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)),
    new T.Vector3(sx, sy, sz),
  );
}

/** Hexágono regular con un vértice arriba (igual que los del mapa 2D). */
function formaHex(T: Three, radio: number) {
  const forma = new T.Shape();
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    const x = radio * Math.cos(a);
    const y = radio * Math.sin(a);
    if (i === 0) forma.moveTo(x, y);
    else forma.lineTo(x, y);
  }
  forma.closePath();
  return forma;
}

/** Losa de terreno: hexágono con grosor y borde redondeado, apoyado en y = 0. */
function geometriaLosa(T: Three) {
  const g = new T.ExtrudeGeometry(formaHex(T, RADIO_LOSA), {
    depth: ALTO_TOTAL - BISEL * 2,
    bevelEnabled: true,
    bevelThickness: BISEL,
    bevelSize: BISEL,
    bevelSegments: 2,
    curveSegments: 1,
  });
  // El plano del mapa (x, y) pasa a ser el plano del suelo (x, z).
  g.rotateX(Math.PI / 2);
  // La base queda en y = 0 y la tapa en y = ALTO_TOTAL (sin cuentas a mano).
  g.computeBoundingBox();
  g.translate(0, -(g.boundingBox?.min.y ?? 0), 0);
  return g;
}

/**
 * Ficha redonda: papel beige, número grande y los puntos de probabilidad.
 * Se dibuja en un canvas (sin imágenes externas) y se usa como textura.
 */
function texturaFicha(T: Three, num: number): Texture {
  const L = 256;
  const cv = document.createElement('canvas');
  cv.width = L;
  cv.height = L;
  const g = cv.getContext('2d');
  if (!g) return new T.Texture();

  const centro = L / 2;
  const radio = centro - 4;

  // Papel
  g.fillStyle = FICHA_FONDO;
  g.beginPath();
  g.arc(centro, centro, radio, 0, Math.PI * 2);
  g.fill();

  // Borde marrón y línea interior
  g.lineWidth = 11;
  g.strokeStyle = FICHA_BORDE;
  g.stroke();
  g.lineWidth = 2.5;
  g.strokeStyle = FICHA_LINEA;
  g.beginPath();
  g.arc(centro, centro, radio - 14, 0, Math.PI * 2);
  g.stroke();

  // Grano de papel
  for (let i = 0; i < 420; i++) {
    g.fillStyle = `rgba(120, 90, 40, ${0.02 + Math.random() * 0.035})`;
    g.fillRect(Math.random() * L, Math.random() * L, 1.4, 1.4);
  }

  const rojo = num === 6 || num === 8;
  g.fillStyle = rojo ? ROJO_NUMERO : TINTA;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 122px Georgia, "Times New Roman", serif';
  g.fillText(String(num), centro, centro - 26);

  // Puntos de probabilidad (1 a 5)
  const puntos = PUNTOS_NUMERO[num] ?? 0;
  const separacion = 23;
  const ancho = (puntos - 1) * separacion;
  for (let i = 0; i < puntos; i++) {
    g.beginPath();
    g.arc(centro - ancho / 2 + i * separacion, centro + 58, 7, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Textura del agua: degradado del centro (isla) hacia afuera (mar abierto). */
function texturaAgua(T: Three): Texture {
  const L = 512;
  const cv = document.createElement('canvas');
  cv.width = L;
  cv.height = L;
  const g = cv.getContext('2d');
  if (!g) return new T.Texture();
  const grad = g.createRadialGradient(L / 2, L / 2, 0, L / 2, L / 2, L / 2);
  grad.addColorStop(0, AGUA_CLARA);
  grad.addColorStop(0.16, AGUA);
  grad.addColorStop(0.46, AGUA_SOMERA);
  grad.addColorStop(1, AGUA_PROFUNDA);
  g.fillStyle = grad;
  g.fillRect(0, 0, L, L);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Coloca la decoración propia de cada tipo de terreno. */
function decorarHex(T: Three, h: Hex, p: Matrices, rnd: () => number) {
  const y = Y_TOPE;

  if (h.tipo === 'wood') {
    // Pinos: tronco + dos copas, repartidos en anillo alrededor de la ficha.
    const n = 5;
    const giro = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
      const r = 0.57 + rnd() * 0.13;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const esc = 0.78 + rnd() * 0.34;
      p.tronco.push(matriz(T, x, y + 0.05 * esc, z, a, esc));
      p.copaBaja.push(matriz(T, x, y + 0.18 * esc, z, rnd() * 6, esc));
      p.copa.push(matriz(T, x, y + 0.31 * esc, z, rnd() * 6, esc));
    }
    return;
  }

  if (h.tipo === 'ore') {
    // Montañas grises con alguna piedra al pie.
    const n = 3;
    const giro = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
      const r = 0.6 + rnd() * 0.1;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const esc = 0.78 + rnd() * 0.4;
      p.montana.push(matriz(T, x, y + 0.21 * esc, z, rnd() * 6, esc));
      p.piedra.push(
        matriz(T, x + (rnd() - 0.5) * 0.2, y + 0.02, z + (rnd() - 0.5) * 0.2, rnd() * 3, 0.6 + rnd() * 0.5),
      );
    }
    return;
  }

  if (h.tipo === 'brick') {
    // Colinas de arcilla: montículos rojizos.
    const n = 3;
    const giro = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
      const r = 0.63 + rnd() * 0.1;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const esc = 0.75 + rnd() * 0.45;
      p.colina.push(matriz(T, x, y + 0.03 * esc, z, rnd() * 6, esc));
    }
    return;
  }

  if (h.tipo === 'wool') {
    // Ovejas blancas con la cara oscura.
    const n = 3;
    const giro = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
      const r = 0.62 + rnd() * 0.08;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const esc = 0.72 + rnd() * 0.35;
      p.oveja.push(matriz(T, x, y + 0.1 * esc, z, -a + Math.PI / 2, 1.15 * esc, 0.85 * esc, 0.9 * esc));
      p.cabeza.push(
        matriz(T, x + Math.cos(a) * 0.11 * esc, y + 0.12 * esc, z + Math.sin(a) * 0.11 * esc, 0, esc),
      );
    }
    return;
  }

  if (h.tipo === 'grain') {
    // Espigas doradas.
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.55 + rnd() * 0.2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const esc = 0.75 + rnd() * 0.5;
      p.trigo.push(matriz(T, x, y + 0.09 * esc, z, rnd() * 6, esc));
    }
    return;
  }

  if (h.tipo === 'desert') {
    // Dunas suaves (el desierto no lleva ficha).
    const n = 2;
    const giro = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + rnd();
      const r = 0.3 + rnd() * 0.25;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const esc = 0.8 + rnd() * 0.5;
      p.duna.push(matriz(T, x, y - 0.06, z, rnd() * 6, esc, esc * 0.32, esc * 1.25));
    }
  }
}

/** Crea una malla instanciada (una sola llamada de dibujo para muchas copias). */
function instanciar(T: Three, geo: BufferGeometry, mat: MeshStandardMaterial, lista: Matrix4[]) {
  if (lista.length === 0) return null;
  const malla = new T.InstancedMesh(geo, mat, lista.length);
  lista.forEach((m, i) => malla.setMatrixAt(i, m));
  malla.instanceMatrix.needsUpdate = true;
  malla.castShadow = true;
  malla.receiveShadow = true;
  return malla;
}

/**
 * Construye el tablero completo y devuelve el grupo con todo dentro.
 * El tablero queda centrado en el origen (0, 0, 0).
 */
export function crearTablero(T: Three, mapa: Mapa): Tablero {
  const grupo = new T.Group();

  // --- Centrar el mapa en el origen ---
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const h of mapa.hexes) {
    minX = Math.min(minX, h.x);
    maxX = Math.max(maxX, h.x);
    minY = Math.min(minY, h.y);
    maxY = Math.max(maxY, h.y);
  }
  const centroX = (minX + maxX) / 2;
  const centroY = (minY + maxY) / 2;
  const aMundo = (x: number, y: number) => [(x - centroX) / S, (y - centroY) / S] as const;

  // --- Agua: plano grande con degradado y hexágonos de mar somero ---
  const agua = new T.Mesh(
    new T.PlaneGeometry(170, 170),
    new T.MeshStandardMaterial({ map: texturaAgua(T), roughness: 0.38, metalness: 0.05 }),
  );
  agua.rotation.x = -Math.PI / 2;
  agua.receiveShadow = true;
  grupo.add(agua);

  const geoMar = new T.CylinderGeometry(RADIO_MAR, RADIO_MAR, ALTURA_MAR, 6);
  geoMar.translate(0, ALTURA_MAR / 2, 0);
  const matMar = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.34, metalness: 0.04 });
  const mar = new T.InstancedMesh(geoMar, matMar, Math.max(1, mapa.mar.length));
  mar.receiveShadow = true;
  const colorMar = new T.Color();
  mapa.mar.forEach((celda, i) => {
    const [px, py] = posicion(mapa.modo, celda[0], celda[1]);
    const [x, z] = aMundo(px, py);
    mar.setMatrixAt(i, matriz(T, x, 0, z));
    // Variación muy leve alrededor del azul base: se lee como ondulación,
    // sin manchas oscuras que ensucien el agua.
    colorMar.set(AGUA);
    colorMar.offsetHSL(0, 0, ((i % 3) - 1) * 0.012);
    mar.setColorAt(i, colorMar);
  });
  mar.count = mapa.mar.length;
  mar.instanceMatrix.needsUpdate = true;
  if (mar.instanceColor) mar.instanceColor.needsUpdate = true;
  grupo.add(mar);

  // --- Arena: plataforma bajo la isla. Tapa las juntas entre losas y asoma
  //     como un filo de playa; las alturas alternan 2 mm para que las caras
  //     que se solapan no queden coplanarias (evita parpadeo). ---
  const geoArena = new T.CylinderGeometry(RADIO_ARENA, RADIO_ARENA, ALTURA_ARENA, 6);
  geoArena.translate(0, ALTURA_ARENA / 2, 0);
  const mallaArena = new T.InstancedMesh(
    geoArena,
    new T.MeshStandardMaterial({ color: ARENA, roughness: 0.9 }),
    mapa.hexes.length,
  );
  mallaArena.receiveShadow = true;
  mapa.hexes.forEach((h, i) => {
    const [x, z] = aMundo(h.x, h.y);
    mallaArena.setMatrixAt(i, matriz(T, x, Y_ARENA + (i % 2 ? 0.002 : 0), z));
  });
  mallaArena.instanceMatrix.needsUpdate = true;
  grupo.add(mallaArena);

  // --- Losas de terreno, fichas y decoración ---
  const geoLosa = geometriaLosa(T);
  const geoFicha = new T.CylinderGeometry(RADIO_FICHA, RADIO_FICHA, ALTO_FICHA, 48);
  const texturas = new Map<number, Texture>();
  const cantoFicha = new T.MeshStandardMaterial({ color: '#e6d7b4', roughness: 0.8 });
  const piezas = matricesVacias();

  for (const h of mapa.hexes) {
    const [x, z] = aMundo(h.x, h.y);
    const estilo = TIERRA[h.tipo] ?? TIERRA.desert;
    const rnd = azarDe(mapa.semilla * 131 + h.idx * 977 + 7);

    const cima = new T.MeshStandardMaterial({ color: estilo.cima, roughness: 0.82, metalness: 0.02 });
    // Variación mínima de tono entre losas, como el cartón pintado a mano.
    cima.color.offsetHSL(0, 0, (rnd() - 0.5) * 0.05);
    const lado = new T.MeshStandardMaterial({ color: estilo.lado, roughness: 0.86, metalness: 0.02 });

    const losa = new T.Mesh(geoLosa, [cima, lado]);
    losa.position.set(x, Y_LOSA, z);
    losa.castShadow = true;
    losa.receiveShadow = true;
    grupo.add(losa);

    if (h.tipo !== 'desert' && h.num > 0) {
      let tex = texturas.get(h.num);
      if (!tex) {
        tex = texturaFicha(T, h.num);
        texturas.set(h.num, tex);
      }
      const tapa = new T.MeshStandardMaterial({ map: tex, roughness: 0.74, metalness: 0 });
      const ficha = new T.Mesh(geoFicha, [cantoFicha, tapa, cantoFicha]);
      ficha.position.set(x, Y_TOPE + ALTO_FICHA / 2 + 0.004, z);
      ficha.rotation.y = GIRO_FICHA;
      ficha.castShadow = true;
      ficha.receiveShadow = true;
      grupo.add(ficha);
    }

    decorarHex(T, h, piezas, rnd);
  }

  // --- Decoración instanciada ---
  const decoracion: [string, BufferGeometry, MeshStandardMaterial][] = [
    ['tronco', new T.CylinderGeometry(0.03, 0.045, 0.1, 6), new T.MeshStandardMaterial({ color: ARBOL_TRONCO, roughness: 0.9 })],
    ['copaBaja', new T.ConeGeometry(0.2, 0.26, 7), new T.MeshStandardMaterial({ color: ARBOL_COPA, roughness: 0.85, flatShading: true })],
    ['copa', new T.ConeGeometry(0.14, 0.24, 7), new T.MeshStandardMaterial({ color: ARBOL_COPA_CLARA, roughness: 0.85, flatShading: true })],
    ['montana', new T.ConeGeometry(0.17, 0.42, 5), new T.MeshStandardMaterial({ color: MONTANA, roughness: 0.92, flatShading: true })],
    ['piedra', new T.IcosahedronGeometry(0.07, 0), new T.MeshStandardMaterial({ color: MONTANA_CLARA, roughness: 0.95, flatShading: true })],
    ['colina', new T.DodecahedronGeometry(0.19, 0), new T.MeshStandardMaterial({ color: COLINA, roughness: 0.9, flatShading: true })],
    ['oveja', new T.SphereGeometry(0.12, 10, 8), new T.MeshStandardMaterial({ color: OVEJA, roughness: 0.95 })],
    ['cabeza', new T.SphereGeometry(0.05, 8, 6), new T.MeshStandardMaterial({ color: OVEJA_CARA, roughness: 0.9 })],
    ['trigo', new T.ConeGeometry(0.035, 0.19, 5), new T.MeshStandardMaterial({ color: TRIGO, roughness: 0.88, flatShading: true })],
    ['duna', new T.SphereGeometry(0.3, 12, 8), new T.MeshStandardMaterial({ color: DUNA, roughness: 0.95 })],
  ];

  for (const [clave, geo, mat] of decoracion) {
    const malla = instanciar(T, geo, mat, piezas[clave]);
    if (malla) grupo.add(malla);
  }

  // --- Encuadre: radio (sombras) y huella exacta (cámara) ---
  let radio = 0;
  const encuadre: Vector3[] = [];
  const bordeLosa = RADIO_LOSA + BISEL;
  for (const h of mapa.hexes) {
    const [x, z] = aMundo(h.x, h.y);
    radio = Math.max(radio, Math.hypot(x, z));
    for (let k = 0; k < 6; k++) {
      const a = ((60 * k - 30) * Math.PI) / 180;
      const px = x + Math.cos(a) * bordeLosa;
      const pz = z + Math.sin(a) * bordeLosa;
      // Los dos extremos en altura: así el encuadre tiene en cuenta el grosor.
      encuadre.push(new T.Vector3(px, Y_TOPE, pz), new T.Vector3(px, Y_LOSA, pz));
    }
  }
  radio += 1.15;

  return { grupo, radio, encuadre };
}
