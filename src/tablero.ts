type Rng = () => number;
type Celda = [number, number];
export type Modo = 'p' | 'g';

const S = 40;
const W = Math.sqrt(3) * S;
const RH = 60;
const K = S / 46;

const TIERRAS: Record<Modo, Record<number, number[]>> = {
  g: { 0: [1, 8, 9], 1: [0, 1, 2, 3, 4, 7, 8], 2: [0, 1, 2, 3, 4, 5, 6, 7], 3: [0, 1, 2, 3, 4, 5], 4: [1, 2, 3, 4, 6], 5: [1] },
  p: { 0: [1, 5], 1: [0, 1, 2, 3, 4, 5], 2: [0, 1, 2, 3, 4, 5], 3: [0, 1, 2], 4: [1, 2] },
};
const COLOR: Record<string, string> = { wood: '#1f9d83', brick: '#e8607f', wool: '#a9d96a', grain: '#f2c23c', ore: '#8f7bdc', desert: '#ead9a3' };
const IN = 'M0 -42L36.4 -21V21L0 42L-36.4 21V-21Z';

const f = (n: number) => n.toFixed(1);
const mk = (s: number): Rng => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

function hp(x: number, y: number, R: number) {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    p.push((x + R * Math.cos(a)).toFixed(1) + ',' + (y + R * Math.sin(a)).toFixed(1));
  }
  return 'M' + p.join('L') + 'Z';
}
function sp(rn: Rng, c: string, n: number, op: number) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rn() * 6.283, r = Math.sqrt(rn()) * 34;
    s += '<circle cx="' + f(r * Math.cos(a)) + '" cy="' + f(r * Math.sin(a)) + '" r="' + f(0.7 + rn() * 1.3) + '"/>';
  }
  return '<g fill="' + c + '" opacity="' + op + '">' + s + '</g>';
}
function tri(x: number, y: number, w: number, h: number, c: string) {
  return '<path d="M' + f(x - w) + ' ' + f(y) + 'L' + f(x) + ' ' + f(y - h) + 'L' + f(x + w) + ' ' + f(y) + 'Z" fill="' + c + '"/>';
}

const D: Record<string, (rn: Rng) => string> = {
  wood: (rn) => {
    const P: Celda[] = [];
    let t = 0;
    while (P.length < 12 && t++ < 300) {
      const x = (rn() - 0.5) * 64;
      const y = -18 + rn() * 42;
      if (x * x + y * y > 900) continue;
      if (P.some((p) => Math.abs(p[0] - x) < 11 && Math.abs(p[1] - y) < 9)) continue;
      P.push([x, y]);
    }
    P.sort((a, b) => a[1] - b[1]);
    let s = '';
    P.forEach(([x, y]) => {
      s += '<ellipse cx="' + f(x + 3) + '" cy="' + f(y + 7) + '" rx="8" ry="3" fill="#06362a" opacity=".45"/><rect x="' + f(x - 1.3) + '" y="' + f(y + 3) + '" width="2.6" height="5" fill="#5a3b1e"/>' + tri(x, y + 5, 9, 13, '#0e5f4e') + tri(x, y - 1, 7, 13, '#178066') + tri(x, y - 6, 5, 13, '#35c4a3');
    });
    return s;
  },
  brick: () => {
    const pila = (x: number, y: number) => {
      let q = '';
      for (let r = 0; r < 3; r++) {
        const n = 3 - r, x0 = x - n * 6;
        for (let i = 0; i < n; i++) q += '<rect x="' + (x0 + i * 12) + '" y="' + (y - r * 6) + '" width="12" height="6" fill="#f08aa6" stroke="#8a2a48" stroke-width=".8"/><rect x="' + (x0 + i * 12) + '" y="' + (y - r * 6) + '" width="12" height="1.6" fill="#ffd0dc"/>';
      }
      return q;
    };
    return '<ellipse cx="0" cy="12" rx="30" ry="17" fill="#c24a6e"/><ellipse cx="0" cy="13" rx="23" ry="12" fill="#a53358"/><ellipse cx="0" cy="14" rx="15" ry="7" fill="#7d1f3e"/>' + pila(-16, -8) + pila(10, -14) + pila(14, 12);
  },
  wool: (rn) => {
    let s = '';
    for (let i = 0; i < 24; i++) {
      const a = rn() * 6.283, r = Math.sqrt(rn()) * 33;
      const x = f(r * Math.cos(a)), y = f(r * Math.sin(a));
      s += 'M' + x + ' ' + y + 'l-1.6 -4M' + x + ' ' + y + 'l0 -5M' + x + ' ' + y + 'l1.6 -4';
    }
    s = '<path d="' + s + '" stroke="#5f8a2a" stroke-width="1.1" fill="none"/>';
    const ovejas: Celda[] = [[-14, -10], [10, -16], [-4, 8], [18, 8], [-22, 12]];
    ovejas.forEach(([x, y]) => {
      s += '<ellipse cx="' + x + '" cy="' + (y + 7) + '" rx="10" ry="2.8" fill="#3d5a14" opacity=".4"/><path d="M' + (x - 4) + ' ' + (y + 3) + 'v5M' + (x + 4) + ' ' + (y + 3) + 'v5" stroke="#3b2a14" stroke-width="1.3"/><g fill="#fffdf4" stroke="#c9d2b0" stroke-width=".5"><circle cx="' + (x - 4) + '" cy="' + y + '" r="5.5"/><circle cx="' + (x + 3) + '" cy="' + (y - 1) + '" r="6"/><circle cx="' + x + '" cy="' + (y + 2) + '" r="5.5"/></g><ellipse cx="' + (x + 9) + '" cy="' + (y + 1) + '" rx="3.5" ry="3" fill="#3b2a14"/><circle cx="' + (x + 8) + '" cy="' + (y - 2) + '" r="1.6" fill="#3b2a14"/>';
    });
    return s;
  },
  grain: () => {
    let a = '', b = '';
    for (let y = -22; y <= 22; y += 11) {
      for (let x = -28; x <= 28; x += 7) {
        if (Math.abs(x) > 34 - Math.abs(y) * 0.5) continue;
        const xx = x + (y % 22 ? 3 : 0);
        a += 'M' + xx + ' ' + (y + 6) + 'V' + (y - 3);
        b += 'M' + (xx - 2) + ' ' + (y - 3) + 'q2 -10 4 0q-2 3 -4 0z';
      }
    }
    return '<path d="M-36 -12Q0 -24 36 -12M-36 4Q0 -8 36 4M-36 20Q0 8 36 20" stroke="#d9a21f" stroke-width="6" fill="none" opacity=".5"/><path d="' + a + '" stroke="#b98a14" stroke-width="1.2" fill="none"/><path d="' + b + '" fill="#f0a91d" stroke="#a87a0c" stroke-width=".4"/>';
  },
  ore: () => '<path d="M-10 -22L-34 18L-8 18Z" fill="#8b79da"/><path d="M-10 -22L-8 18L16 18Z" fill="#4d3f95"/><path d="M-10 -22L-17 -9L-12 -12L-9 -6L-6 -12L-2 -9Z" fill="#fff7e0"/><path d="M18 -10L2 18H20Z" fill="#9a88e6"/><path d="M18 -10L20 18H36Z" fill="#5a4aa6"/><path d="M18 -10L13 -1L17 -3L20 1L22 -4Z" fill="#fff7e0"/><path d="M-4 18V10Q0 3 4 10V18Z" fill="#1b1330"/><path d="M-26 -6L-24 -22L-21 -6Z" fill="#efe8ff"/><path d="M-21 -6L-18 -16L-15 -6Z" fill="#c5b7f5"/><path d="M-26 -6L-22 -6L-24 -22Z" fill="#a898ec"/><path d="M24 24L26 14L29 24Z" fill="#efe8ff"/>',
  desert: () => '<path d="M-34 12Q-14 -10 10 6Q-10 2 -34 12Z" fill="#d3bd82"/><path d="M-12 28Q10 8 36 16Q16 16 -12 28Z" fill="#d3bd82"/><path d="M-30 -8Q-15 -20 0 -8T30 -8" stroke="#c9b278" stroke-width="1.6" fill="none"/><ellipse cx="-20" cy="16" rx="6" ry="3.5" fill="#a58f5a"/><ellipse cx="22" cy="20" rx="4" ry="2.5" fill="#a58f5a"/><rect x="18" y="-26" width="5" height="17" rx="2.5" fill="#3a8a55"/><rect x="12" y="-21" width="7" height="3" rx="1.5" fill="#3a8a55"/><rect x="22" y="-19" width="6" height="3" rx="1.5" fill="#3a8a55"/>',
};

function ficha(t: string, rn: Rng) {
  return '<path d="M0 -34L39.8 -11V35L0 58L-39.8 35V-11Z" fill="#000" opacity=".35"/><path d="M0 -41L39.8 -18V28L0 51L-39.8 28V-18Z" fill="#9c8858"/><path d="M0 -46L39.8 -23V23L0 46L-39.8 23V-23Z" fill="#f3e6c4"/><path d="' + IN + '" fill="' + COLOR[t] + '"/>' + sp(rn, '#000', 40, 0.12) + sp(rn, '#fff', 30, 0.15) + D[t](rn) + '<path d="' + IN + '" fill="url(#sh)"/>';
}

export function dibujarTablero(modo: Modo, semilla: number = 11): string {
  const grande = modo === 'g';
  const tierra = TIERRAS[modo];
  const OX = grande ? 110 : 255;
  const OY = grande ? 108 : 135;
  const esT = (r: number, c: number) => (tierra[r] ?? []).includes(c);
  const pos = (r: number, c: number): Celda => [OX + c * W + (r & 1 ? W / 2 : 0), OY + r * RH];
  const vec = (r: number, c: number): Celda[] =>
    r & 1
      ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
      : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];

  let o = '<defs><linearGradient id="sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11567a"/><stop offset="1" stop-color="#06202e"/></linearGradient></defs>';
  o += '<rect width="860" height="670" rx="18" fill="url(#bg)"/>';

  const mar = new Map<string, Celda>();
  const lista: Celda[] = [];
  for (let r = 0; r < 6; r++) {
    (tierra[r] ?? []).forEach((c) => {
      lista.push([r, c]);
      vec(r, c).forEach((n) => { if (!esT(n[0], n[1])) mar.set(n[0] + ',' + n[1], n); });
    });
  }
  const claves = [...mar.keys()];
  const wr = mk(5);
  claves.forEach((k2) => {
    const n = mar.get(k2)!;
    const [x, y] = pos(n[0], n[1]);
    const a = (wr() - 0.5) * 10;
    o += '<path d="' + hp(x, y, S) + '" fill="#1a6e8e" stroke="#0b3a52" stroke-width="2"/><path d="M' + f(x - 22 + a) + ' ' + f(y - 10) + 'q7 -6 14 0t14 0t14 0M' + f(x - 18 - a) + ' ' + f(y + 10) + 'q7 -6 14 0t14 0" stroke="#8fd3e8" stroke-width="2" fill="none" opacity=".55"/><path d="M' + f(x + 4 + a) + ' ' + f(y + 22) + 'h10" stroke="#fff" stroke-width="2" opacity=".5"/>';
  });
  lista.forEach(([r, c]) => {
    const [x, y] = pos(r, c);
    o += '<path d="' + hp(x, y, S + 4) + '" fill="none" stroke="#d8f4ff" stroke-width="5" opacity=".35"/>';
  });

  let seed = semilla;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const candidatas = [...lista];
  for (let i = candidatas.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [candidatas[i], candidatas[j]] = [candidatas[j], candidatas[i]];
  }
  const desiertos: Celda[] = [candidatas[0]];
  if (grande) {
    const vecinos = vec(candidatas[0][0], candidatas[0][1]).map(([vr, vc]) => vr + ',' + vc);
    const segundo = candidatas.slice(1).find(([r, c]) => !vecinos.includes(r + ',' + c));
    if (segundo) desiertos.push(segundo);
  }

  const cuentas: [string, number][] = grande
    ? [['wood', 6], ['wool', 6], ['grain', 6], ['brick', 5], ['ore', 5]]
    : [['wood', 4], ['wool', 4], ['grain', 4], ['brick', 3], ['ore', 3]];
  const tipos: string[] = [];
  cuentas.forEach(([t, n]) => { for (let i = 0; i < n; i++) tipos.push(t); });
  for (let i = tipos.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [tipos[i], tipos[j]] = [tipos[j], tipos[i]];
  }

  const fichasNum = grande
    ? [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12]
    : [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  const celdasRec = lista.filter(([r, c]) => !desiertos.some(([dr, dc]) => dr === r && dc === c));
  const indice = new Map<string, number>(celdasRec.map(([r, c], i) => [r + ',' + c, i] as [string, number]));
  const esRojo = (n: number) => n === 6 || n === 8;
  let nums = [...fichasNum];
  for (let intento = 0; intento < 300; intento++) {
    nums = [...fichasNum];
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    const mal = celdasRec.some(([r, c], i) =>
      esRojo(nums[i]) && vec(r, c).some(([vr, vc]) => {
        const j = indice.get(vr + ',' + vc);
        return j !== undefined && esRojo(nums[j]);
      })
    );
    if (!mal) break;
  }

  const txt = 'font-family:system-ui,sans-serif;font-weight:600;text-anchor:middle;';
  let k = 0, ti = 0, fichas = '';
  lista.forEach(([r, c]) => {
    const [x, y] = pos(r, c);
    const rn = mk(100 + ti++ * 7 + (semilla % 1000));
    const iDes = desiertos.findIndex(([dr, dc]) => dr === r && dc === c);
    if (iDes >= 0) {
      o += '<g transform="translate(' + f(x) + ',' + f(y) + ') scale(' + f(K) + ')">' + ficha('desert', rn) + (iDes === 0 ? '<g transform="translate(0,2)"><ellipse cx="2" cy="18" rx="36" ry="7" fill="#6b5a2f" opacity=".5"/><path d="M-36 6Q-38 -12 -14 -14Q10 -16 24 -4L35 -18L34 4L40 14L24 9Q8 22 -14 20Q-32 18 -36 6Z" fill="#06222f"/><path d="M-30 -4Q-10 -14 18 -6" stroke="#3b6b82" stroke-width="2" fill="none" opacity=".7"/><path d="M-32 10Q-12 18 12 12" stroke="#7fb0c4" stroke-width="2" fill="none"/><path d="M-27 -2q3 5 0 10M-22 -4q3 6 0 12" stroke="#14455c" stroke-width="1.2" fill="none"/><circle cx="-24" cy="-2" r="2.6" fill="#fff7e0"/><circle cx="-24" cy="-2" r="1.2" fill="#06222f"/><path d="M-20 -14Q-24 -28 -33 -26M-20 -14Q-16 -28 -7 -26M-20 -14V-32" stroke="#5cc8e8" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="-34" cy="-30" r="1.8" fill="#bfefff"/><circle cx="-6" cy="-30" r="1.8" fill="#bfefff"/><circle cx="-20" cy="-36" r="1.8" fill="#bfefff"/></g>' : '') + '</g>';
    } else {
      const tp = tipos[k], n = nums[k];
      const rojo = esRojo(n);
      k++;
      o += '<g transform="translate(' + f(x) + ',' + f(y) + ') scale(' + f(K) + ')">' + ficha(tp, rn) + '</g>';
      fichas += '<circle cx="' + f(x + 1) + '" cy="' + f(y + 3) + '" r="17" fill="#000" opacity=".3"/><circle cx="' + f(x) + '" cy="' + f(y) + '" r="17" fill="#fff3d6" stroke="#8a5a2b" stroke-width="1.6"/><circle cx="' + f(x) + '" cy="' + f(y) + '" r="14" fill="none" stroke="#d9c08a" stroke-width=".8"/><text x="' + f(x) + '" y="' + f(y + 3) + '" style="' + txt + 'font-size:18px;fill:' + (rojo ? '#c0392b' : '#3b2a14') + '">' + n + '</text>';
      const d = 6 - Math.abs(7 - n);
      for (let q = 0; q < d; q++) fichas += '<circle cx="' + f(x + (q - (d - 1) / 2) * 4.4) + '" cy="' + f(y + 11) + '" r="1.5" fill="' + (rojo ? '#c0392b' : '#3b2a14') + '"/>';
    }
  });
  o += fichas;

  let cx = 0, cy = 0;
  lista.forEach(([r, c]) => { const p = pos(r, c); cx += p[0]; cy += p[1]; });
  cx /= lista.length; cy /= lista.length;
  const arr = claves
    .map((q) => { const n = mar.get(q)!; const p = pos(n[0], n[1]); return { n, x: p[0], y: p[1], a: Math.atan2(p[1] - cy, p[0] - cx) }; })
    .sort((a, b) => a.a - b.a);
  const tiposPuerto = grande
    ? ['3', 'wood', '3', 'brick', '3', 'wool', '3', 'grain', 'ore', '3', 'wool']
    : ['3', 'wood', '3', 'brick', '3', 'wool', '3', 'grain', 'ore'];
  for (let i = tiposPuerto.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [tiposPuerto[i], tiposPuerto[j]] = [tiposPuerto[j], tiposPuerto[i]];
  }
  let etiquetas = '';
  tiposPuerto.forEach((kd, i) => {
    const q = arr[Math.floor(((i + 0.5) * arr.length) / tiposPuerto.length)];
    const lt = vec(q.n[0], q.n[1]).find((m) => esT(m[0], m[1]));
    if (!lt) return;
    const lp = pos(lt[0], lt[1]);
    const dx = lp[0] - q.x, dy = lp[1] - q.y;
    const L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    let px = -uy, py = ux;
    if (py < 0) { px = -px; py = -py; }
    let tablas = '';
    for (let xx = 6; xx < L * 0.8; xx += 8) tablas += 'M' + xx + ' -7V7';
    o += '<g transform="translate(' + f(q.x) + ',' + f(q.y) + ') rotate(' + f(ang) + ')"><rect x="-4" y="-7" width="' + f(L * 0.8) + '" height="14" fill="#c8995a" stroke="#6b4423" stroke-width="1.2"/><path d="' + tablas + '" stroke="#8a5a2b" stroke-width="1.2"/><circle cx="-2" cy="-8" r="3" fill="#6b4423"/><circle cx="-2" cy="8" r="3" fill="#6b4423"/></g>';
    const bx = q.x + px * 22 - ux * 4, by = q.y + py * 22 - uy * 4;
    o += '<ellipse cx="' + f(bx) + '" cy="' + f(by + 9) + '" rx="14" ry="3" fill="#06202e" opacity=".4"/><path d="M' + f(bx - 13) + ' ' + f(by) + 'L' + f(bx + 13) + ' ' + f(by) + 'L' + f(bx + 9) + ' ' + f(by + 8) + 'L' + f(bx - 9) + ' ' + f(by + 8) + 'Z" fill="#e8607f"/><path d="M' + f(bx) + ' ' + f(by - 20) + 'V' + f(by) + '" stroke="#6b4423" stroke-width="1.6"/><path d="M' + f(bx + 1.5) + ' ' + f(by - 19) + 'L' + f(bx + 12) + ' ' + f(by - 3) + 'L' + f(bx + 1.5) + ' ' + f(by - 3) + 'Z" fill="#fff7e0"/>';
    const sc = kd === '3' ? '#8a5a2b' : COLOR[kd];
    const tx = q.x - ux * 24, ty = q.y - uy * 24, dos = kd !== '3';
    etiquetas += '<rect x="' + f(tx - 24) + '" y="' + f(ty - 13) + '" width="48" height="26" rx="8" fill="#fff7e0" stroke="' + sc + '" stroke-width="3"/>' + (dos ? '<circle cx="' + f(tx - 12) + '" cy="' + f(ty) + '" r="5.5" fill="' + sc + '"/>' : '') + '<text x="' + f(tx + (dos ? 7 : 0)) + '" y="' + f(ty + 6) + '" style="' + txt + 'font-size:16px;fill:#3b2a14">' + (dos ? '2:1' : '3:1') + '</text>';
  });
  o += etiquetas;

  const s0 = pos(0, 1);
  o += '<g transform="translate(' + f(s0[0] + 9) + ',' + f(s0[1] - 38) + ') scale(2.2)"><path d="M0 0q-2 -9 -9 -8M0 0q2 -9 9 -8M0 0v-10" stroke="#d8f4ff" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>';
  o += '<text x="430" y="552" style="font-family:Georgia,serif;font-weight:600;text-anchor:middle;font-size:34px;fill:#f3e6c4">Islote Cachalote</text>';
  const leyenda: [string, string][] = [['wood', 'Madera'], ['brick', 'Ladrillo'], ['wool', 'Lana'], ['grain', 'Trigo'], ['ore', 'Mineral']];
  leyenda.forEach(([t, nombre], i) => {
    const x = 110 + i * 130;
    o += '<rect x="' + x + '" y="582" width="18" height="18" rx="4" fill="' + COLOR[t] + '"/><text x="' + (x + 26) + '" y="597" style="font-family:system-ui,sans-serif;font-size:18px;fill:#f3e6c4">' + nombre + '</text>';
  });
  ['#ff6b6b', '#2ec4b6', '#9b5de5', '#ffbe0b', '#8ac926', '#f1f1f1'].forEach((col, i) => {
    o += '<circle cx="' + (310 + i * 48) + '" cy="635" r="14" fill="' + col + '" stroke="#06202e" stroke-width="2"/>';
  });
  return o;
}