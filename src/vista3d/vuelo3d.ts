/**
 * CARTAS VOLANDO (Etapa 3)
 *
 * Anima cartas de recursos volando desde los hexágonos que producen
 * hacia la mano del jugador (punto de la pantalla por jugador).
 */
import type { Group, PerspectiveCamera } from 'three';
import type { Mapa } from '../tablero';
import type { Three } from './cargar';
import { Y_TOPE } from './medidas';

export type CartaVuelo = {
  hex: string; // "r,c"
  recurso: string;
  /** Destino en coordenadas normalizadas de pantalla [-1,1]. */
  destino: [number, number];
};

export type Vuelo3D = {
  grupo: Group;
  lanzar: (cartas: CartaVuelo[], aMundo: (x: number, y: number) => readonly [number, number], camara: PerspectiveCamera) => void;
  animar: (dt: number) => boolean;
};

const COLOR_RECURSO: Record<string, string> = {
  wood: '#2f7a45',
  brick: '#b9572f',
  wool: '#86bb4e',
  grain: '#dfb43e',
  ore: '#9198a1',
};

const texturasCarta = new Map<string, any>();

function texturaCarta(T: Three, recurso: string) {
  const cached = texturasCarta.get(recurso);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const color = COLOR_RECURSO[recurso] ?? '#888888';
  // Fondo con borde
  ctx.fillStyle = '#fbf8ef';
  ctx.fillRect(0, 0, 96, 128);
  ctx.strokeStyle = '#3b2a14';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 92, 124);
  // Banda de color
  ctx.fillStyle = color;
  ctx.fillRect(8, 8, 80, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(recurso.toUpperCase(), 48, 32);
  // Dibujo simple del recurso
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  const icono = (x: number, y: number) => {
    ctx.beginPath();
    if (recurso === 'wood') { ctx.moveTo(x, y - 12); ctx.lineTo(x - 10, y + 10); ctx.lineTo(x + 10, y + 10); ctx.fill(); }
    else if (recurso === 'brick') { ctx.fillRect(x - 12, y - 6, 24, 12); ctx.fillRect(x - 12, y + 8, 24, 6); }
    else if (recurso === 'wool') { ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); }
    else if (recurso === 'grain') { ctx.ellipse(x, y, 4, 12, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (recurso === 'ore') { ctx.moveTo(x, y - 12); ctx.lineTo(x - 12, y + 8); ctx.lineTo(x + 12, y + 8); ctx.fill(); }
  };
  icono(48, 80);
  ctx.globalAlpha = 1;

  const nuevaTex = new T.CanvasTexture(canvas);
  nuevaTex.colorSpace = T.SRGBColorSpace;
  texturasCarta.set(recurso, nuevaTex);
  return nuevaTex;
}

export function crearVueloCartas(T: Three, mapa: Mapa): Vuelo3D {
  const grupo = new T.Group();
  let vuelos: { mesh: Group; x0: number; z0: number; ndcX: number; ndcY: number; t: number; dur: number }[] = [];
  let camaraActiva: PerspectiveCamera | null = null;

  const lanzar = (cartas: CartaVuelo[], aMundo: (x: number, y: number) => readonly [number, number], camara: PerspectiveCamera) => {
    camaraActiva = camara;
    for (const v of vuelos) grupo.remove(v.mesh);
    vuelos = [];

    cartas.forEach((p, idx) => {
      const hex = mapa.hexes.find((h) => h.r + ',' + h.c === p.hex);
      if (!hex) return;
      const [x0, z0] = aMundo(hex.x, hex.y);

      const mat = new T.MeshStandardMaterial({ map: texturaCarta(T, p.recurso), roughness: 0.6, side: T.DoubleSide });
      const mesh = new T.Group();
      const carta = new T.Mesh(new T.PlaneGeometry(0.22, 0.32), mat);
      carta.castShadow = true;
      mesh.add(carta);

      mesh.position.set(x0, Y_TOPE + 0.1, z0);
      grupo.add(mesh);

      vuelos.push({
        mesh,
        x0,
        z0,
        ndcX: p.destino[0],
        ndcY: p.destino[1],
        t: -idx * 0.15,
        dur: 0.9,
      });
    });
  };

  const animar = (dt: number) => {
    if (vuelos.length === 0) return false;
    let activas = false;

    for (const v of vuelos) {
      if (v.t < 0) {
        v.t += dt;
        activas = true;
        v.mesh.visible = false;
        continue;
      }
      if (v.t >= v.dur) {
        v.mesh.visible = false;
        continue;
      }

      v.mesh.visible = true;
      activas = true;
      v.t = Math.min(v.dur, v.t + dt);
      const p = v.t / v.dur;

      // Destino en mundo a partir del NDC, a distancia fija frente a la cámara
      let targetX = 0, targetY = 0, targetZ = 0;
      if (camaraActiva) {
        const vector = new T.Vector3(v.ndcX, v.ndcY, 0.5);
        vector.unproject(camaraActiva);
        const dir = vector.sub(camaraActiva.position).normalize();
        const pt = camaraActiva.position.clone().add(dir.multiplyScalar(6));
        targetX = pt.x;
        targetY = pt.y;
        targetZ = pt.z;
      }

      const x = v.x0 + (targetX - v.x0) * p;
      const z = v.z0 + (targetZ - v.z0) * p;
      const y = (Y_TOPE + 0.1) + Math.sin(p * Math.PI) * 1.6;

      v.mesh.position.set(x, y, z);
      v.mesh.lookAt(targetX, targetY, targetZ);
      v.mesh.rotateY(Math.PI);

      const s = Math.max(0.15, Math.sin(p * Math.PI) * 1.1 + 0.4);
      v.mesh.scale.setScalar(s);
    }

    if (!activas) {
      for (const v of vuelos) grupo.remove(v.mesh);
      vuelos = [];
    }
    return activas;
  };

  return { grupo, lanzar, animar };
}
