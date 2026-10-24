// Música y efectos de Islote Cachalote.
// Todo se genera con el navegador (Web Audio), así que no hay archivos ni derechos de autor.
// Si quieres tu propia música, copia un mp3 a la carpeta "public" y escribe aquí su nombre, por ejemplo 'musica.mp3'.
const ARCHIVO_MUSICA = '';

export type ModoSonido = 0 | 1 | 2; // 0 = música y efectos, 1 = solo efectos, 2 = silencio

type CtxClase = typeof AudioContext;

let ctx: AudioContext | null = null;
let salida: GainNode | null = null;
let musicaG: GainNode | null = null;
let efectosG: GainNode | null = null;
let ruidoBuf: AudioBuffer | null = null;
let modo: ModoSonido = leerModo();
let reloj: number | null = null;
let proxTiempo = 0;
let paso = 0;
let audioArchivo: HTMLAudioElement | null = null;

function leerModo(): ModoSonido {
  try {
    const v = Number(window.localStorage.getItem('sonido'));
    return v === 1 || v === 2 ? v : 0;
  } catch {
    return 0;
  }
}

export function obtenerModo(): ModoSonido {
  return modo;
}

function asegurar(): AudioContext | null {
  if (ctx) return ctx;
  const Clase: CtxClase | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: CtxClase }).webkitAudioContext;
  if (!Clase) return null;
  ctx = new Clase();
  salida = ctx.createGain();
  salida.gain.value = 0.9;
  salida.connect(ctx.destination);
  musicaG = ctx.createGain();
  musicaG.gain.value = modo === 0 ? 0.3 : 0;
  musicaG.connect(salida);
  efectosG = ctx.createGain();
  efectosG.gain.value = modo === 2 ? 0 : 1;
  efectosG.connect(salida);
  const n = Math.floor(ctx.sampleRate * 1.5);
  ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = ruidoBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// ---------- ayudas ----------
function frecuencia(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function tono(destino: GainNode, tipo: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, ataque = 0.01, filtro = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  if (filtro > 0) {
    const bq = ctx.createBiquadFilter();
    bq.type = 'lowpass';
    bq.frequency.value = filtro;
    g.connect(bq);
    bq.connect(destino);
  } else {
    g.connect(destino);
  }
  o.start(t);
  o.stop(t + dur + 0.05);
}

function rafaga(destino: GainNode, t: number, dur: number, tipo: BiquadFilterType, f: number, vol: number, q = 1) {
  if (!ctx || !ruidoBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = ruidoBuf;
  const bq = ctx.createBiquadFilter();
  bq.type = tipo;
  bq.frequency.value = f;
  bq.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bq);
  bq.connect(g);
  g.connect(destino);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

// ---------- música: marinera en 6/8, tonalidad de Re menor ----------
// Cada compás tiene 6 corcheas. Los números son semitonos desde el Re4; "." sigue la nota; "-" es silencio.
const MELODIA = [
  '7 . 7 8 7 5', '3 . 5 . 7 .', '8 . 8 10 8 7', '5 . 7 . 10 .',
  '12 . 10 8 7 5', '8 . 7 5 3 5', '7 . 3 . 2 3', '0 . . . - -',
  '0 3 7 . 7 .', '12 . 10 . 7 .', '8 10 12 . 10 8', '10 . 7 . 5 .',
  '7 . 8 7 5 3', '5 . 7 8 7 5', '3 . 2 3 7 .', '0 . . . . .',
].map((c) => c.split(' '));
// Acordes de cada compás: nota del bajo (semitonos desde Re4) y triada.
const ACORDES: { bajo: number; triada: number[] }[] = [
  { bajo: -24, triada: [-12, -9, -5] }, { bajo: -24, triada: [-12, -9, -5] },
  { bajo: -28, triada: [-16, -12, -9] }, { bajo: -26, triada: [-14, -10, -7] },
  { bajo: -24, triada: [-12, -9, -5] }, { bajo: -19, triada: [-7, -4, 0] },
  { bajo: -17, triada: [-5, -1, 2] }, { bajo: -24, triada: [-12, -9, -5] },
];
const CORCHEA = 0.2;
const RE4 = 62;

function duracionNota(compas: number, k: number) {
  let n = 1;
  for (let i = k + 1; i < 6 && MELODIA[compas][i] === '.'; i++) n++;
  return n * CORCHEA;
}

function programarPaso(i: number, t: number) {
  if (!ctx || !musicaG) return;
  const compas = Math.floor(i / 6) % 16;
  const k = i % 6;
  const ac = ACORDES[compas % 8];
  const tok = MELODIA[compas][k];
  if (tok !== '.' && tok !== '-') {
    const f = frecuencia(RE4 + Number(tok));
    const dur = duracionNota(compas, k);
    tono(musicaG, 'triangle', f, f, t, dur * 0.95, 0.5, 0.015, 2600);
    tono(musicaG, 'square', f * 1.004, f * 1.004, t, dur * 0.9, 0.07, 0.02, 1800);
  }
  if (k === 0) {
    ac.triada.forEach((s) => {
      const f = frecuencia(RE4 + s);
      tono(musicaG as GainNode, 'sawtooth', f, f, t, CORCHEA * 5.6, 0.07, 0.08, 900);
    });
  }
  if (k === 0 || k === 3) {
    const f = frecuencia(RE4 + ac.bajo + (k === 3 ? 7 : 0));
    tono(musicaG, 'sine', f, f, t, CORCHEA * 2.6, 0.6, 0.01);
    tono(musicaG, 'sine', 130, 48, t, 0.14, k === 0 ? 0.7 : 0.45, 0.005);
  }
  if (k === 3) rafaga(musicaG, t, 0.09, 'bandpass', 1500, 0.22, 0.8);
  if (k === 1 || k === 2 || k === 4 || k === 5) rafaga(musicaG, t, 0.05, 'highpass', 6000, 0.05);
}

function programador() {
  if (!ctx) return;
  while (proxTiempo < ctx.currentTime + 0.6) {
    programarPaso(paso, proxTiempo);
    proxTiempo += CORCHEA;
    paso = (paso + 1) % (16 * 6);
  }
}

function iniciarMusica() {
  if (ARCHIVO_MUSICA) {
    if (!audioArchivo) {
      audioArchivo = new Audio(import.meta.env.BASE_URL + ARCHIVO_MUSICA);
      audioArchivo.loop = true;
      audioArchivo.volume = 0.35;
    }
    void audioArchivo.play().catch(() => undefined);
    return;
  }
  if (!ctx || reloj !== null) return;
  proxTiempo = ctx.currentTime + 0.1;
  paso = 0;
  reloj = window.setInterval(programador, 100);
  programador();
}

function pararMusica() {
  if (audioArchivo) audioArchivo.pause();
  if (reloj !== null) {
    window.clearInterval(reloj);
    reloj = null;
  }
}

// ---------- control ----------
export function iniciar() {
  const c = asegurar();
  if (!c) return;
  void c.resume();
  if (modo === 0) iniciarMusica();
}

export function detener() {
  pararMusica();
}

export function ponerModo(m: ModoSonido) {
  modo = m;
  try {
    window.localStorage.setItem('sonido', String(m));
  } catch {
    // sin almacenamiento, no pasa nada
  }
  if (musicaG) musicaG.gain.value = m === 0 ? 0.3 : 0;
  if (efectosG) efectosG.gain.value = m === 2 ? 0 : 1;
  if (m === 0) iniciar();
  else pararMusica();
}

// ---------- efectos ----------
function listo(): { c: AudioContext; e: GainNode; t: number } | null {
  if (modo === 2) return null;
  const c = asegurar();
  if (!c || !efectosG) return null;
  if (c.state === 'suspended') void c.resume();
  return { c, e: efectosG, t: c.currentTime + 0.02 };
}

export function dados() {
  const x = listo();
  if (!x) return;
  for (let i = 0; i < 14; i++) {
    const t = x.t + i * 0.058 + Math.random() * 0.02;
    rafaga(x.e, t, 0.045, 'bandpass', 1600 + Math.random() * 2400, 0.5, 2);
    tono(x.e, 'square', 240 + Math.random() * 200, 160, t, 0.03, 0.05);
  }
  tono(x.e, 'triangle', 950, 520, x.t + 0.95, 0.07, 0.35);
  tono(x.e, 'triangle', 820, 470, x.t + 1.06, 0.07, 0.3);
}

export function ladron() {
  const x = listo();
  if (!x) return;
  const { c, e, t } = x;
  const o = c.createOscillator();
  const g = c.createGain();
  const vib = c.createOscillator();
  const vg = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.7);
  o.frequency.exponentialRampToValueAtTime(95, t + 1.9);
  vib.frequency.value = 6;
  vg.gain.value = 10;
  vib.connect(vg);
  vg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.7, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
  o.connect(g);
  g.connect(e);
  vib.start(t);
  o.start(t);
  vib.stop(t + 2.1);
  o.stop(t + 2.1);
  tono(e, 'sine', 220, 600, t + 0.1, 1.2, 0.15, 0.2);
  rafaga(e, t + 1.5, 0.7, 'lowpass', 700, 0.5);
}

export function chapoteo() {
  const x = listo();
  if (!x) return;
  rafaga(x.e, x.t, 0.7, 'lowpass', 900, 0.7);
  for (let i = 0; i < 5; i++) tono(x.e, 'sine', 500 + Math.random() * 500, 900 + Math.random() * 600, x.t + 0.1 + i * 0.09, 0.08, 0.15);
}

export function caminoLargo() {
  const x = listo();
  if (!x) return;
  [60, 64, 67, 72].forEach((m, i) => tono(x.e, 'triangle', frecuencia(m + 12), frecuencia(m + 12), x.t + i * 0.12, 0.35, 0.35, 0.01, 3000));
  [60, 64, 67].forEach((m) => tono(x.e, 'sawtooth', frecuencia(m), frecuencia(m), x.t + 0.5, 0.9, 0.12, 0.02, 1400));
  for (let i = 0; i < 3; i++) rafaga(x.e, x.t + 0.5 + i * 0.12, 0.05, 'bandpass', 900, 0.4, 3);
}

export function mayorEjercito() {
  const x = listo();
  if (!x) return;
  for (let i = 0; i < 12; i++) rafaga(x.e, x.t + i * 0.055, 0.07, 'lowpass', 500 + i * 80, 0.25 + i * 0.03);
  [50, 57, 62, 65].forEach((m) => tono(x.e, 'sawtooth', frecuencia(m), frecuencia(m), x.t + 0.7, 1.0, 0.18, 0.02, 1700));
  tono(x.e, 'sine', 120, 45, x.t + 0.7, 0.3, 0.8);
}

export function victoria() {
  const x = listo();
  if (!x) return;
  [62, 66, 69, 74].forEach((m, i) => tono(x.e, 'triangle', frecuencia(m + 12), frecuencia(m + 12), x.t + i * 0.16, 0.5, 0.4, 0.01, 3200));
  [50, 57, 62, 66, 69].forEach((m) => tono(x.e, 'sawtooth', frecuencia(m), frecuencia(m), x.t + 0.7, 2.0, 0.14, 0.03, 1800));
  [74, 78, 81, 86].forEach((m, i) => tono(x.e, 'triangle', frecuencia(m), frecuencia(m), x.t + 1.0 + i * 0.12, 0.7, 0.3, 0.01, 4000));
  for (let i = 0; i < 40; i++) rafaga(x.e, x.t + 1.2 + Math.random() * 2.4, 0.05 + Math.random() * 0.05, 'bandpass', 1500 + Math.random() * 3000, 0.25, 1);
}

export function construir() {
  const x = listo();
  if (!x) return;
  rafaga(x.e, x.t, 0.05, 'bandpass', 1100, 0.6, 4);
  tono(x.e, 'square', 380, 200, x.t, 0.06, 0.15);
  rafaga(x.e, x.t + 0.13, 0.06, 'bandpass', 1300, 0.7, 4);
  tono(x.e, 'square', 420, 220, x.t + 0.13, 0.06, 0.15);
}

export function cambio() {
  const x = listo();
  if (!x) return;
  tono(x.e, 'sine', 1320, 1320, x.t, 0.25, 0.3);
  tono(x.e, 'sine', 1760, 1760, x.t + 0.1, 0.35, 0.3);
}

export function tuTurno() {
  const x = listo();
  if (!x) return;
  tono(x.e, 'sine', 880, 880, x.t, 0.8, 0.35);
  tono(x.e, 'sine', 1320, 1320, x.t, 0.6, 0.18);
  tono(x.e, 'sine', 2200, 2200, x.t, 0.3, 0.08);
}
