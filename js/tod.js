// Gün içi zaman dilimleri: gökyüzü, güneş/ay, sis, pozlama, sokak lambaları ve pencere ışıkları.
import * as THREE from 'three';

export const TODS = {
  sabah: {
    n: 'Sabah', hour: '07:40', sky: ['#5f93d6', '#a9c8ea', '#f4d9b0', '#7d8a8f'], sunC: '#fff3d6', sunR: 26, sunX: 0.18, sunY: 0.36, clouds: 0.55,
    light: { c: 0xffe6c4, i: 2.2, el: 16, az: -55 }, hemi: { s: 0xa8c8ff, g: 0x6b5f4a, i: 1.05 }, fog: { c: 0xc4d4e4, d: 0.0075 },
    exp: 0.95, env: 0.85, bg: 1.0, bloom: 0.16, street: 0, indoor: 0.55, win: 0.1, night: false,
  },
  ogle: {
    n: 'Öğle', hour: '12:50', sky: ['#2f6fd0', '#7fb2ec', '#d4e6f6', '#8a9196'], sunC: '#ffffff', sunR: 22, sunX: 0.55, sunY: 0.12, clouds: 0.4,
    light: { c: 0xfffaf0, i: 2.9, el: 62, az: 20 }, hemi: { s: 0xbfd8ff, g: 0x7a6e58, i: 1.2 }, fog: { c: 0xcfdcea, d: 0.0055 },
    exp: 0.9, env: 1.0, bg: 1.0, bloom: 0.12, street: 0, indoor: 0.5, win: 0.06, night: false,
  },
  gunbatimi: {
    n: 'Gün batımı', hour: '18:55', sky: ['#2b2f6b', '#c4577a', '#ffa24a', '#4a3a3a'], sunC: '#ffd27a', sunR: 34, sunX: 0.72, sunY: 0.47, clouds: 0.65,
    light: { c: 0xffa860, i: 2.0, el: 7, az: 75 }, hemi: { s: 0xff9e80, g: 0x3a2e3a, i: 0.85 }, fog: { c: 0xd88a6a, d: 0.0095 },
    exp: 1.0, env: 0.7, bg: 1.0, bloom: 0.3, street: 0.45, indoor: 0.8, win: 0.5, night: false,
  },
  aksam: {
    n: 'Akşam', hour: '20:15', sky: ['#0c1030', '#2b2a5e', '#7a4a6e', '#1a1622'], sunC: null, clouds: 0.35,
    light: { c: 0x8a7cff, i: 0.75, el: 12, az: 95 }, hemi: { s: 0x5a5aa0, g: 0x1a1420, i: 0.6 }, fog: { c: 0x2a2440, d: 0.013 },
    exp: 1.1, env: 0.55, bg: 0.9, bloom: 0.45, street: 1, indoor: 1, win: 1, night: true, stars: 0.4,
  },
  gece: { n: 'Gece', hour: '02:10', night: true, classic: true, street: 1, indoor: 1, win: 1 },
};
export const TOD_KEYS = Object.keys(TODS);
export function pickTod(rng) { return rng.weighted([['sabah', 2], ['ogle', 2], ['gunbatimi', 1.6], ['aksam', 1.2], ['gece', 3]]); }

const skyCache = {};
export function skyTexture(key) {
  if (skyCache[key]) return skyCache[key];
  const T = TODS[key], W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const [top, mid, hor, ground] = T.sky;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(0.32, mid); gr.addColorStop(0.49, hor); gr.addColorStop(0.53, ground); gr.addColorStop(1, ground);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (T.stars) for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * T.stars})`; g.fillRect(rnd() * W, rnd() * H * 0.35, 1, 1); }
  if (T.sunC) {
    const sx = T.sunX * W, sy = T.sunY * H;
    const hg = g.createRadialGradient(sx, sy, 0, sx, sy, T.sunR * 7); hg.addColorStop(0, T.sunC + 'aa'); hg.addColorStop(1, T.sunC + '00'); g.fillStyle = hg; g.fillRect(0, 0, W, H);
    g.fillStyle = T.sunC; g.beginPath(); g.arc(sx, sy, T.sunR * 0.5, 0, 7); g.fill();
  }
  // bulutlar
  for (let i = 0; i < 26 * T.clouds; i++) {
    const x = rnd() * W, y = H * (0.12 + rnd() * 0.3), w = 60 + rnd() * 160, h = 10 + rnd() * 22;
    const cg = g.createRadialGradient(x, y, 0, x, y, w); const a = 0.2 + rnd() * 0.3;
    const col = key === 'gunbatimi' ? `255,170,140` : key === 'aksam' ? `120,100,150` : `255,255,255`;
    cg.addColorStop(0, `rgba(${col},${a})`); cg.addColorStop(1, `rgba(${col},0)`); g.save(); g.scale(1, h / w); g.fillStyle = cg; g.beginPath(); g.arc(x, y * w / h, w, 0, 7); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
  return (skyCache[key] = t);
}

// Dünyadaki ışık ve parlamaları zaman dilimine göre ölçekle (tabanı saklar, tekrar uygulanabilir)
export function scaleWorldLights(root, lights, T) {
  for (const l of lights) {
    if (l.userData.base === undefined) l.userData.base = l.intensity;
    l.intensity = l.userData.base * (l.isSpotLight ? T.street : T.indoor);
  }
  root.traverse(o => {
    if (o.isSprite && o.material.blending === THREE.AdditiveBlending) { if (o.userData.baseOp === undefined) o.userData.baseOp = o.material.opacity; o.material.opacity = o.userData.baseOp * T.street; return; }
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.emissiveIntensity === undefined) continue;
      if (m.userData.baseEI === undefined) m.userData.baseEI = m.emissiveIntensity;
      if (m.userData.baseEI > 0 && !m.userData.keepGlow) m.emissiveIntensity = m.userData.baseEI * T.win;
    }
  });
}
