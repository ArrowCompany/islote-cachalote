/**
 * DADOS 3D (Etapa 3)
 *
 * Dos dados con caras procedurales (del 1 al 6 con puntos pips) que ruedan,
 * rebotan y se detienen mostrando el resultado de la tirada.
 */
import type { Group } from 'three';
import type { Three } from './cargar';

export type Dados3D = {
  grupo: Group;
  /** Lanza los dados hacia un resultado [a, b]. onFin se llama cuando terminan de rodar. Si animar=false solo los muestra. */
  lanzar: (dados: [number, number] | null, onFin?: () => void, animar?: boolean) => void;
  /** Avanza la animación de los dados. Devuelve true mientras rueden. */
  animar: (dt: number) => boolean;
};

// Rotaciones en radianes (Euler XYZ) para que cada cara quede mirando hacia ARRIBA (+Y)
// Dependiendo del orden de caras en BoxGeometry:
// caras en three.js BoxGeometry: [ +X, -X, +Y, -Y, +Z, -Z ]
// En materialCara asignamos:
// 0: +X = 1
// 1: -X = 6
// 2: +Y = 2
// 3: -Y = 5
// 4: +Z = 3
// 5: -Z = 4
function rotacionParaValor(n: number): [number, number, number] {
  const PI = Math.PI;
  const HPI = Math.PI / 2;
  switch (n) {
    case 1: return [0, 0, HPI];       // +X gira a +Y
    case 6: return [0, 0, -HPI];      // -X gira a +Y
    case 2: return [0, 0, 0];         // +Y ya está arriba
    case 5: return [PI, 0, 0];        // -Y gira a +Y
    case 3: return [-HPI, 0, 0];      // +Z gira a +Y
    case 4: return [HPI, 0, 0];       // -Z gira a +Y
    default: return [0, 0, 0];
  }
}

export function crearDados(T: Three): Dados3D {
  const grupo = new T.Group();
  grupo.position.set(0, 0.04, 2.0); // Delante de la isla, sobre el agua

  const geoDado = new T.BoxGeometry(0.38, 0.38, 0.38);
  const materiales = [
    materialCara(T, 1),
    materialCara(T, 6),
    materialCara(T, 2),
    materialCara(T, 5),
    materialCara(T, 3),
    materialCara(T, 4),
  ];

  const dado1 = new T.Mesh(geoDado, materiales);
  const dado2 = new T.Mesh(geoDado, materiales);
  dado1.castShadow = true;
  dado2.castShadow = true;
  dado1.position.set(-0.28, 0.19, 0);
  dado2.position.set(0.28, 0.19, 0);

  grupo.add(dado1);
  grupo.add(dado2);
  grupo.visible = false;

  let animando = false;
  let t = 0;
  const dur = 2.0; // 2.0 segundos rodando (mas lento)
  let val1 = 1, val2 = 1;
  let finCallback: (() => void) | null = null;

  let rotFinal1: [number, number, number] = [0, 0, 0];
  let rotFinal2: [number, number, number] = [0, 0, 0];

  const lanzar = (valores: [number, number] | null, onFin?: () => void, conAnimacion?: boolean) => {
    if (!valores) {
      grupo.visible = false;
      animando = false;
      finCallback = null;
      return;
    }
    val1 = valores[0];
    val2 = valores[1];
    finCallback = onFin ?? null;
    grupo.visible = true;

    rotFinal1 = rotacionParaValor(val1);
    rotFinal2 = rotacionParaValor(val2);

    if (conAnimacion === false) {
      dado1.rotation.set(...rotFinal1);
      dado2.rotation.set(...rotFinal2);
      dado1.position.set(-0.28, 0.19, 0);
      dado2.position.set(0.28, 0.19, 0);
      animando = false;
      return;
    }

    dado1.position.set(-0.35, 2.6, -0.6);
    dado2.position.set(0.35, 2.9, -0.4);

    dado1.rotation.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    dado2.rotation.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);

    animando = true;
    t = 0;
  };

  const animar = (dt: number) => {
    if (!animando) return false;
    t = Math.min(dur, t + dt);
    const p = t / dur;

    // Rebotes parabólicos
    const h1 = Math.max(0.19, 2.4 * Math.abs(Math.cos(p * Math.PI * 2.5)) * (1 - p) + 0.19);
    const h2 = Math.max(0.19, 2.7 * Math.abs(Math.cos((p + 0.1) * Math.PI * 2.5)) * (1 - p) + 0.19);

    dado1.position.y = h1;
    dado2.position.y = h2;
    dado1.position.x = -0.28 - (1 - p) * 0.1;
    dado2.position.x = 0.28 + (1 - p) * 0.1;

    if (p < 0.8) {
      // Rotación rápida libre
      dado1.rotation.x += dt * 14 * (1 - p);
      dado1.rotation.y += dt * 18 * (1 - p);
      dado2.rotation.x += dt * 16 * (1 - p);
      dado2.rotation.z += dt * 20 * (1 - p);
    } else {
      // Suavizado hacia la cara objetivo en el 20% final
      const blend = (p - 0.8) / 0.2;
      dado1.rotation.x = dado1.rotation.x * (1 - blend) + rotFinal1[0] * blend;
      dado1.rotation.y = dado1.rotation.y * (1 - blend) + rotFinal1[1] * blend;
      dado1.rotation.z = dado1.rotation.z * (1 - blend) + rotFinal1[2] * blend;

      dado2.rotation.x = dado2.rotation.x * (1 - blend) + rotFinal2[0] * blend;
      dado2.rotation.y = dado2.rotation.y * (1 - blend) + rotFinal2[1] * blend;
      dado2.rotation.z = dado2.rotation.z * (1 - blend) + rotFinal2[2] * blend;
    }

    if (t >= dur) {
      animando = false;
      dado1.rotation.set(...rotFinal1);
      dado2.rotation.set(...rotFinal2);
      dado1.position.y = 0.19;
      dado2.position.y = 0.19;
      dado1.position.x = -0.28;
      dado2.position.x = 0.28;

      if (finCallback) {
        const cb = finCallback;
        finCallback = null;
        cb();
      }
    }
    return animando;
  };

  return { grupo, lanzar, animar };
}

function materialCara(T: Three, n: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Fondo marfil suave con borde biselado dibujado
  ctx.fillStyle = '#f8f4e6';
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = '#dfd6c0';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 122);

  // Pips oscuros con sombra tenue
  ctx.fillStyle = '#1c1b18';
  const dot = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  };

  if (n === 1) {
    // El 1 tradicionalmente es rojo o más grande
    ctx.fillStyle = '#c92a2a';
    ctx.beginPath();
    ctx.arc(64, 64, 16, 0, Math.PI * 2);
    ctx.fill();
  } else if (n === 2) {
    dot(36, 36);
    dot(92, 92);
  } else if (n === 3) {
    dot(36, 36);
    dot(64, 64);
    dot(92, 92);
  } else if (n === 4) {
    dot(36, 36);
    dot(92, 36);
    dot(36, 92);
    dot(92, 92);
  } else if (n === 5) {
    dot(36, 36);
    dot(92, 36);
    dot(64, 64);
    dot(36, 92);
    dot(92, 92);
  } else if (n === 6) {
    dot(36, 32);
    dot(92, 32);
    dot(36, 64);
    dot(92, 64);
    dot(36, 96);
    dot(92, 96);
  }

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return new T.MeshStandardMaterial({ map: tex, roughness: 0.28, metalness: 0.05 });
}
