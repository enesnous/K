// Mağaza tabancaları — ayrıntılı modeller: Glock 19, Desert Eagle Mark XIX, S&W Schofield No.3, HK MP5K.
// Ortak düzen: namlu +z, üst +y, sağ taraf -x; el kabzada (~z -0.03, y -0.045).
// userData: slide / hammer / cyl / brk / bolt / handle / mag (animasyon), muzzle, sightY, shine (parlayan malzemeler), kind
import * as THREE from 'three';
import { mat, boxGeo, cyl, sph, torus, plane, M, G, ownMat, shineMat } from './kit.js';

// ---------- yardımcılar ----------
const geo = new Map();
function shapeOf(pts, P = THREE.Shape) {
  const s = new P();
  pts.forEach((p, i) => (i === 0 ? s.moveTo(p[0], p[1]) : p.length === 4 ? s.quadraticCurveTo(p[0], p[1], p[2], p[3]) : s.lineTo(p[0], p[1])));
  return s;
}
// Yan profilden (z, y) x yönünde w kalınlığında, kenarları pahlı parça
function X(key, pts, w, bv = 0.0012, holes = []) {
  const k = key + '|' + w + '|' + bv; if (geo.has(k)) return geo.get(k);
  const s = shapeOf(pts); for (const h of holes) s.holes.push(shapeOf(h, THREE.Path));
  const d = Math.max(0.0004, w - bv * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv * 0.7, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -d / 2); g.rotateY(-Math.PI / 2);
  geo.set(k, g); return g;
}
// İki yana simetrik küçük parça
const both = (fn) => { fn(1); fn(-1); };
// Ön kabza parmak yuvaları: a→b doğrusu üzerinde n tümsek
function grooves(a, b, n, out = 0.0035) {
  const dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy), nz = -dy / L, ny = dz / L; const pts = [];
  for (let i = 1; i <= n; i++) { const t0 = (i - 1) / n, t1 = i / n, tm = (t0 + t1) / 2; pts.push([a[0] + dz * tm + nz * out, a[1] + dy * tm + ny * out, a[0] + dz * t1, a[1] + dy * t1]); }
  return pts;
}

// Dokular: polimer pütür (bump), ceviz damarı, yazı
let stipT = null, woodT = null; const decT = new Map();
function stipple() {
  if (stipT) return stipT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) { const v = Math.random() * 255 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  stipT = new THREE.CanvasTexture(c); stipT.wrapS = stipT.wrapT = THREE.RepeatWrapping; stipT.repeat.set(40, 40);
  return stipT;
}
function wood() {
  if (woodT) return woodT;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#6a3a1c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { const y = Math.random() * 256, a = 0.08 + Math.random() * 0.18; g.strokeStyle = Math.random() < 0.5 ? `rgba(40,18,6,${a})` : `rgba(150,90,45,${a})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 6); g.stroke(); }
  woodT = new THREE.CanvasTexture(c); woodT.colorSpace = THREE.SRGBColorSpace; woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; woodT.repeat.set(30, 30);
  return woodT;
}
// Kazıma yazı (yan yüzeye yapışık şeffaf düzlem)
function decal(parent, text, w, h, x, y, z, side, col = 'rgba(205,210,216,0.85)') {
  const key = text + col;
  if (!decT.has(key)) {
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(32, Math.round(512 * h / w)); const g = c.getContext('2d');
    g.fillStyle = col; g.font = `700 ${Math.round(c.height * 0.78)}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, c.height / 2 + 1, 500);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    decT.set(key, m);
  }
  const p = M(plane(w, h), decT.get(key), x, y, z, 0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0, parent, false);
  p.receiveShadow = false; return p;
}
// Malzeme takımı (altın / gümüş parlak kaplama dahil)
function kit(shine) {
  const list = [];
  const S = shine ? shineMat(shine) : null;
  if (S) list.push(S);
  const bump = (c, r = 0.95) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, bumpMap: stipple(), bumpScale: 0.6 }); return m; };
  return {
    list, S,
    blue: S || mat('#1e2024', { m: 0.85, r: 0.3 }), // çelik yüzey (karartılmış)
    steel: S || mat('#5b5f66', { m: 0.95, r: 0.26 }),
    dark: mat('#0b0c0e', { m: 0.4, r: 0.55 }),
    hole: mat('#000000', { r: 1 }),
    poly: S || mat('#191a1d', { r: 0.72 }),
    grip: bump('#141517'),
    rubber: bump('#101112', 1),
    brass: mat('#c99a45', { m: 1, r: 0.3 }),
    white: mat('#f2f2ee', { r: 0.5, e: '#ffffff', ei: 0.15 }),
    wood: new THREE.MeshStandardMaterial({ color: '#ffffff', map: wood(), roughness: 0.42, metalness: 0 }),
  };
}
function finish(g, s, ud) {
  g.userData = ud;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- Glock 19 (Gen 5) ----------
export function createGlock19({ scale = 1.45, shine = null } = {}) {
  const g = new THREE.Group(), s = G(g); s.scale.setScalar(scale);
  const b = G(s, 0, 0, 0.016); // el konumuna hizalama
  const K = kit(shine), frameM = shine ? K.S : K.poly;
  // gövde (polimer): toz kapağı + tetik korkuluğu + kabza + kuyruk
  const front = grooves([0.004, -0.012], [-0.030, -0.096], 4, 0.0032);
  const frame = [[-0.036, 0.035], [0.128, 0.035], [0.131, 0.031], [0.131, 0.019], [0.124, 0.016], [0.068, 0.016], [0.066, 0.012], [0.067, -0.006], [0.064, -0.013], [0.058, -0.016], [0.022, -0.016], [0.012, -0.016, 0.004, -0.012], ...front,
    [-0.032, -0.101], [-0.074, -0.101], [-0.058, -0.06, -0.041, -0.012], [-0.040, 0.004, -0.050, 0.024], [-0.047, 0.030], [-0.036, 0.035]];
  const guard = [[0.013, -0.0105], [0.056, -0.0105], [0.061, -0.0105, 0.061, -0.004], [0.060, 0.0115], [0.016, 0.0115], [0.007, 0.005, 0.013, -0.0105]];
  M(X('g19f', frame, 0.0255, 0.0016, [guard]), frameM, 0, 0, 0, 0, 0, 0, b);
  // kabza pütürü (iki yan) ve sırt
  M(X('g19p', [[0.000, -0.018], [-0.027, -0.088], [-0.066, -0.088], [-0.042, -0.018]], 0.0268, 0.0006), K.grip, 0, 0, 0, 0, 0, 0, b, false);
  // ray yuvaları, sökme kolu, pimler, şarjör düğmesi
  for (let i = 0; i < 3; i++) M(boxGeo(0.0262, 0.0032, 0.004), K.dark, 0, 0.0172, 0.092 + i * 0.012, 0, 0, 0, b, false);
  M(boxGeo(0.0266, 0.0036, 0.009), K.dark, 0, 0.0305, 0.056, 0, 0, 0, b, false);
  for (const [z, y] of [[0.012, 0.026], [0.040, 0.026], [-0.022, 0.024]]) M(cyl(0.0014, 0.0014, 0.0262, 8), K.steel, 0, y, z, 0, 0, Math.PI / 2, b, false);
  M(boxGeo(0.0268, 0.0062, 0.0065), K.dark, 0, 0.0065, -0.002, 0, 0, 0, b, false);
  // sürgü stoperi (sol)
  M(X('g19ss', [[0.008, 0.029], [0.036, 0.031], [0.040, 0.0345], [0.006, 0.0345]], 0.0016, 0.0003), K.dark, 0.0134, 0, 0, 0, 0, 0, b, false);
  // tetik + emniyet dili
  M(X('g19t', [[0.030, 0.012], [0.035, 0.0, 0.029, -0.0095], [0.0255, -0.0095], [0.0305, 0.0, 0.026, 0.012]], 0.0062, 0.0008), K.poly, 0, 0, 0, 0, 0, 0, b, false);
  M(boxGeo(0.0018, 0.012, 0.0024), mat('#2a2b2e', { r: 0.6 }), 0, 0.0005, 0.0305, -0.25, 0, 0, b, false);
  // şarjör (taban + gövde)
  const mag = G(b, 0, 0, 0);
  M(X('g19mb', [[-0.031, -0.1005], [-0.0755, -0.1005], [-0.0765, -0.1065], [-0.034, -0.109, -0.030, -0.105]], 0.0236, 0.0012), K.poly, 0, 0, 0, 0, 0, 0, mag);
  M(boxGeo(0.019, 0.088, 0.03), K.dark, 0, -0.056, -0.04, 0.39, 0, 0, mag, false);
  // sürgü
  const slide = G(b, 0, 0, 0);
  M(X('g19s', [[-0.040, 0.0355], [0.136, 0.0355], [0.136, 0.056], [0.136, 0.0625, 0.130, 0.0625], [-0.036, 0.0625], [-0.040, 0.0625, -0.040, 0.058]], 0.0255, 0.0022), K.blue, 0, 0, 0, 0, 0, 0, slide);
  for (let i = 0; i < 8; i++) M(boxGeo(0.0263, 0.019, 0.0013), K.dark, 0, 0.047, -0.0345 + i * 0.0036, 0, 0, 0, slide, false);
  for (let i = 0; i < 6; i++) M(boxGeo(0.0263, 0.017, 0.0013), K.dark, 0, 0.046, 0.106 + i * 0.0036, 0, 0, 0, slide, false);
  // atım penceresi + namlu yatağı + tırnak
  M(boxGeo(0.0018, 0.0105, 0.035), K.dark, -0.0123, 0.0565, 0.035, 0, 0, 0, slide, false);
  M(boxGeo(0.0128, 0.0032, 0.0355), K.dark, -0.0035, 0.0612, 0.035, 0, 0, 0, slide, false);
  M(boxGeo(0.0102, 0.0074, 0.032), mat('#7a7f86', { m: 1, r: 0.28 }), -0.0035, 0.0592, 0.035, 0, 0, 0, slide, false);
  M(boxGeo(0.0014, 0.004, 0.015), K.steel, -0.0131, 0.0535, 0.009, 0, 0, 0, slide, false);
  // arka kapak, nişangâhlar (beyaz U ve nokta)
  M(boxGeo(0.0165, 0.022, 0.0012), mat('#26272a', { r: 0.6 }), 0, 0.048, -0.0404, 0, 0, 0, slide, false);
  M(boxGeo(0.017, 0.004, 0.0075), K.dark, 0, 0.0645, -0.031, 0, 0, 0, slide);
  both(sd => { M(boxGeo(0.0056, 0.004, 0.0075), K.dark, sd * 0.0056, 0.0675, -0.031, 0, 0, 0, slide, false); M(boxGeo(0.0011, 0.0036, 0.0006), K.white, sd * 0.0034, 0.0673, -0.0349, 0, 0, 0, slide, false); });
  M(boxGeo(0.0056, 0.0011, 0.0006), K.white, 0, 0.0658, -0.0349, 0, 0, 0, slide, false);
  M(boxGeo(0.0034, 0.0062, 0.0055), K.dark, 0, 0.0656, 0.128, 0, 0, 0, slide);
  M(cyl(0.0011, 0.0011, 0.0006, 10), K.white, 0, 0.0668, 0.1251, Math.PI / 2, 0, 0, slide, false);
  // namlu ağzı ve yay kılavuzu
  M(cyl(0.0068, 0.0068, 0.003, 16), mat('#3b3e43', { m: 1, r: 0.3 }), 0, 0.0485, 0.1365, Math.PI / 2, 0, 0, slide, false);
  M(cyl(0.0047, 0.0047, 0.004, 14), K.hole, 0, 0.0485, 0.1372, Math.PI / 2, 0, 0, slide, false);
  M(cyl(0.0032, 0.0032, 0.003, 10), K.dark, 0, 0.0395, 0.1362, Math.PI / 2, 0, 0, slide, false);
  // ray altı fener + lazer modülü (L: fener, K: lazer)
  const tl = G(b, 0, 0, 0);
  M(X('g19tl', [[0.071, 0.0165], [0.131, 0.0165], [0.134, 0.012], [0.134, -0.006], [0.130, -0.009], [0.080, -0.009], [0.071, 0.002]], 0.0265, 0.0025), mat('#121315', { m: 0.3, r: 0.55 }), 0, 0, 0, 0, 0, 0, tl);
  M(cyl(0.0098, 0.0098, 0.006, 22), mat('#1b1c1f', { m: 0.6, r: 0.35 }), 0, 0.0055, 0.1355, Math.PI / 2, 0, 0, tl);
  const lens = M(cyl(0.0080, 0.0080, 0.0012, 22), ownMat('#ffffff', { e: '#fff6e0', ei: 0.2, r: 0.1 }), 0, 0.0055, 0.1388, Math.PI / 2, 0, 0, tl, false);
  const laser = M(cyl(0.0021, 0.0021, 0.0012, 12), ownMat('#3a0505', { e: '#ff2020', ei: 0.3, r: 0.2 }), 0, -0.0052, 0.1352, Math.PI / 2, 0, 0, tl, false);
  M(cyl(0.0032, 0.0032, 0.001, 12), K.dark, 0, -0.0052, 0.1346, Math.PI / 2, 0, 0, tl, false);
  both(sd => { M(boxGeo(0.0018, 0.008, 0.012), K.dark, sd * 0.0138, 0.002, 0.076, -0.3, 0, 0, tl, false); M(cyl(0.0018, 0.0018, 0.0275, 8), K.steel, 0, 0.012, 0.102, 0, 0, Math.PI / 2, tl, false); });
  decal(tl, 'TLR · LASER', 0.03, 0.004, 0.0134, 0.0035, 0.104, 1, 'rgba(150,150,150,0.8)');
  // yazılar
  decal(slide, 'GLOCK', 0.026, 0.0062, 0.01285, 0.0495, 0.088, 1);
  decal(slide, '19  AUSTRIA  9x19', 0.034, 0.0042, -0.01285, 0.0445, 0.092, -1);
  decal(b, 'GLOCK', 0.012, 0.003, 0.01285, 0.008, 0.05, 1, 'rgba(140,140,140,0.8)');
  return finish(g, s, { slide, mag, lens, laser, muzzle: new THREE.Vector3(0, 0.0485 * scale, 0.155 * scale), sightY: 0.0695, shine: K.list, kind: 'glock' });
}

// ---------- Desert Eagle Mark XIX ----------
export function createDeagle({ scale = 1.45, shine = null } = {}) {
  const g = new THREE.Group(), s = G(g); s.scale.setScalar(scale);
  const b = G(s, 0, 0, 0.012);
  const K = kit(shine);
  const metal = K.blue, frameM = shine ? K.S : mat('#25272b', { m: 0.8, r: 0.38 });
  // gövde
  const frame = [[-0.040, 0.038], [0.218, 0.038], [0.222, 0.034], [0.222, 0.027], [0.205, 0.022], [0.092, 0.022], [0.087, 0.017], [0.089, -0.009], [0.095, -0.012], [0.094, -0.017], [0.086, -0.017], [0.080, -0.022], [0.028, -0.022], [0.014, -0.022, 0.008, -0.012],
    [-0.022, -0.104], [-0.026, -0.110], [-0.080, -0.110], [-0.070, -0.06, -0.050, -0.012], [-0.050, 0.012], [-0.052, 0.030, -0.062, 0.034], [-0.058, 0.038], [-0.040, 0.038]];
  const guard = [[0.020, -0.0155], [0.078, -0.0155], [0.082, -0.0155, 0.082, -0.010], [0.081, 0.016], [0.022, 0.016], [0.012, 0.008, 0.020, -0.0155]];
  M(X('dgf', frame, 0.030, 0.002, [guard]), frameM, 0, 0, 0, 0, 0, 0, b);
  // lastik kabza (parmak yuvalı, öne sarılan)
  const gp = [[0.0095, -0.012], ...grooves([0.0095, -0.012], [-0.0205, -0.104], 4, 0.004), [-0.024, -0.106], [-0.078, -0.106], [-0.069, -0.06, -0.0515, -0.012], [-0.050, 0.004], [-0.004, 0.004]];
  M(X('dgg', gp, 0.0338, 0.002), K.rubber, 0, 0, 0, 0, 0, 0, b);
  // sabit namlu (üst ray + arpacık)
  M(X('dgb', [[0.080, 0.040], [0.236, 0.040], [0.236, 0.068], [0.236, 0.073, 0.231, 0.0735], [0.085, 0.0735], [0.080, 0.069]], 0.025, 0.0025), metal, 0, 0, 0, 0, 0, 0, b);
  M(boxGeo(0.0135, 0.004, 0.138), metal, 0, 0.0755, 0.160, 0, 0, 0, b);
  for (let i = 0; i < 11; i++) M(boxGeo(0.0158, 0.003, 0.0062), metal, 0, 0.0786, 0.097 + i * 0.0125, 0, 0, 0, b);
  M(X('dgfs', [[0.218, 0.0795], [0.232, 0.0795], [0.232, 0.093], [0.224, 0.093]], 0.0042, 0.0006), metal, 0, 0, 0, 0, 0, 0, b);
  M(cyl(0.0012, 0.0012, 0.0006, 10), K.white, 0, 0.0895, 0.2235, Math.PI / 2, 0, 0, b, false);
  M(cyl(0.0068, 0.0068, 0.004, 18), K.hole, 0, 0.0545, 0.2362, Math.PI / 2, 0, 0, b, false);
  M(cyl(0.0085, 0.0085, 0.0012, 18), mat('#3b3e43', { m: 1, r: 0.3 }), 0, 0.0545, 0.2356, Math.PI / 2, 0, 0, b, false);
  decal(b, 'DESERT EAGLE  PISTOL', 0.105, 0.0075, 0.0128, 0.056, 0.160, 1);
  decal(b, '.50 A.E.   MAGNUM RESEARCH', 0.105, 0.0055, -0.0128, 0.056, 0.160, -1);
  // sökme kolu, sürgü stoperi, şarjör düğmesi, pimler
  M(boxGeo(0.0312, 0.005, 0.014), K.dark, 0, 0.031, 0.150, 0, 0, 0, b, false);
  M(X('dgss', [[0.010, 0.030], [0.052, 0.032], [0.056, 0.037], [0.008, 0.037]], 0.0018, 0.0003), K.steel, 0.0157, 0, 0, 0, 0, 0, b, false);
  M(cyl(0.0042, 0.0042, 0.0315, 14), K.steel, 0, 0.004, 0.003, 0, 0, Math.PI / 2, b, false);
  for (const [z, y] of [[0.030, 0.029], [0.070, 0.030], [-0.030, 0.026]]) M(cyl(0.0017, 0.0017, 0.0308, 8), K.steel, 0, y, z, 0, 0, Math.PI / 2, b, false);
  // tetik
  M(X('dgt', [[0.050, 0.016], [0.056, 0.002, 0.048, -0.0145], [0.0445, -0.0145], [0.0505, 0.002, 0.046, 0.016]], 0.007, 0.0009), K.steel, 0, 0, 0, 0, 0, 0, b, false);
  // horoz (halkalı)
  const hammer = G(b, 0, 0.050, -0.046);
  M(X('dgh', [[0.002, -0.006], [0.004, 0.008], [0.002, 0.022, -0.010, 0.024], [-0.020, 0.020, -0.016, 0.010], [-0.006, 0.000]], 0.0085, 0.001, [[[-0.0075, 0.012], [-0.0115, 0.010], [-0.0135, 0.0145], [-0.0095, 0.0175]]]), K.steel, 0, 0, 0, 0, 0, 0, hammer);
  for (let i = 0; i < 4; i++) M(boxGeo(0.009, 0.0008, 0.0016), K.dark, 0, 0.019 + i * 0.0014, -0.011 - i * 0.0022, -0.6, 0, 0, hammer, false);
  // şarjör
  const mag = G(b, 0, 0, 0);
  M(X('dgmb', [[-0.0255, -0.1095], [-0.0805, -0.1095], [-0.0815, -0.1165], [-0.025, -0.1165]], 0.026, 0.0015), K.dark, 0, 0, 0, 0, 0, 0, mag);
  M(boxGeo(0.022, 0.09, 0.044), K.dark, 0, -0.062, -0.05, 0.31, 0, 0, mag, false);
  // sürgü
  const slide = G(b, 0, 0, 0);
  M(X('dgs', [[-0.042, 0.038], [0.086, 0.038], [0.086, 0.072], [0.084, 0.080, 0.076, 0.081], [-0.034, 0.081], [-0.042, 0.081, -0.042, 0.074]], 0.034, 0.003), metal, 0, 0, 0, 0, 0, 0, slide);
  for (let i = 0; i < 9; i++) M(boxGeo(0.0346, 0.026, 0.0016), K.dark, 0, 0.058, -0.035 + i * 0.0045, 0.14, 0, 0, slide, false);
  M(boxGeo(0.0016, 0.0125, 0.040), K.dark, -0.0172, 0.064, 0.040, 0, 0, 0, slide, false);
  M(boxGeo(0.012, 0.0085, 0.036), mat('#7a7f86', { m: 1, r: 0.28 }), -0.0118, 0.0645, 0.040, 0, 0, 0, slide, false);
  // emniyet / horoz indirme kolları
  M(cyl(0.0048, 0.0048, 0.038, 16), K.steel, 0, 0.069, -0.030, 0, 0, Math.PI / 2, slide, false);
  both(sd => M(X('dgsf', [[-0.030, 0.066], [-0.016, 0.074], [-0.014, 0.078], [-0.030, 0.073]], 0.0024, 0.0004), K.steel, sd * 0.0188, 0, 0, 0, 0, 0, slide, false));
  // gez (beyaz noktalı)
  M(boxGeo(0.024, 0.006, 0.010), K.dark, 0, 0.084, -0.028, 0, 0, 0, slide);
  both(sd => { M(boxGeo(0.0078, 0.0062, 0.010), K.dark, sd * 0.0076, 0.0901, -0.028, 0, 0, 0, slide, false); M(cyl(0.0011, 0.0011, 0.0006, 10), K.white, sd * 0.0076, 0.0898, -0.0333, Math.PI / 2, 0, 0, slide, false); });
  decal(slide, 'MARK XIX', 0.040, 0.0055, 0.0172, 0.050, 0.030, 1);
  decal(slide, 'IMI  ISRAEL', 0.040, 0.0055, -0.0172, 0.050, 0.010, -1);
  return finish(g, s, { slide, hammer, mag, muzzle: new THREE.Vector3(0, 0.0545 * scale, 0.25 * scale), sightY: 0.093, shine: K.list, kind: 'deagle' });
}

// ---------- Smith & Wesson Schofield No.3 (kırma) ----------
export function createSchofield({ scale = 1.45, shine = null } = {}) {
  const g = new THREE.Group(), s = G(g); s.scale.setScalar(scale);
  const b = G(s, 0, 0, 0.004);
  const K = kit(shine);
  const blue = shine ? K.S : mat('#22262d', { m: 0.9, r: 0.24 }), cc = shine ? K.S : mat('#6d6a66', { m: 1, r: 0.3 }); // gövde ve horoz renk-sertleştirilmiş
  // alt gövde: arka kalkan + silindir altı + menteşe + yuvarlak korkuluk + saban kabza
  const frame = [[-0.008, 0.064], [0.001, 0.064], [0.001, 0.013], [0.049, 0.013], [0.050, 0.030], [0.060, 0.030], [0.066, 0.026, 0.064, 0.016], [0.060, 0.010], [0.048, 0.004], [0.040, 0.004], [0.038, 0.002],
    [0.042, -0.026, 0.016, -0.026], [0.000, -0.026, -0.006, -0.012], [-0.012, -0.040, -0.030, -0.090], [-0.034, -0.099], [-0.050, -0.107, -0.066, -0.096], [-0.060, -0.050, -0.040, -0.012], [-0.030, 0.006, -0.024, 0.030], [-0.022, 0.040], [-0.014, 0.056], [-0.008, 0.064]];
  const guard = [[0.033, 0.000], [0.036, -0.0205, 0.016, -0.0205], [0.004, -0.0205, 0.001, -0.007], [0.005, 0.001], [0.031, 0.001]];
  M(X('scf', frame, 0.028, 0.0016, [guard]), blue, 0, 0, 0, 0, 0, 0, b);
  // ceviz kabza plakaları + vida + madalyon, kayış halkası
  M(X('scg', [[-0.011, -0.014], [-0.015, -0.040, -0.030, -0.085], [-0.046, -0.097, -0.059, -0.088], [-0.055, -0.050, -0.038, -0.014], [-0.030, -0.002, -0.020, -0.002]], 0.032, 0.0018), K.wood, 0, 0, 0, 0, 0, 0, b);
  both(sd => { M(cyl(0.0028, 0.0028, 0.0012, 14), cc, sd * 0.0162, -0.048, -0.034, 0, 0, Math.PI / 2, b, false); M(boxGeo(0.0006, 0.0045, 0.0008), K.dark, sd * 0.0169, -0.048, -0.034, 0.6, 0, 0, b, false); });
  M(cyl(0.0022, 0.0022, 0.003, 10), cc, 0, -0.103, -0.052, 0, 0, 0, b, false);
  M(torus(0.0062, 0.0012, 8, 20), cc, 0, -0.111, -0.053, 0, Math.PI / 2, 0, b, false);
  // vidalar ve menteşe pimi
  for (const [z, y, r] of [[0.030, 0.008, 0.0022], [-0.016, 0.022, 0.0022], [0.010, -0.006, 0.0018], [0.058, 0.022, 0.0034]]) M(cyl(r, r, 0.0288, 12), cc, 0, y, z, 0, 0, Math.PI / 2, b, false);
  decal(b, 'SMITH & WESSON', 0.040, 0.0042, 0.0142, 0.0088, 0.025, 1);
  decal(b, 'U.S.', 0.010, 0.0042, -0.0142, 0.0088, 0.025, -1);
  // tetik
  M(X('sct', [[0.020, 0.004], [0.024, -0.008, 0.016, -0.018], [0.0135, -0.016], [0.019, -0.006, 0.0155, 0.004]], 0.005, 0.0007), cc, 0, 0, 0, 0, 0, 0, b, false);
  // kilit (üzengi) — horozun önünde
  both(sd => M(boxGeo(0.003, 0.012, 0.007), cc, sd * 0.0128, 0.068, -0.003, 0, 0, 0, b, false));
  M(boxGeo(0.0285, 0.0032, 0.0062), cc, 0, 0.0745, -0.003, 0, 0, 0, b, false);
  for (let i = 0; i < 5; i++) M(boxGeo(0.0005, 0.0034, 0.0064), K.dark, -0.01 + i * 0.005, 0.0746, -0.003, 0, 0, 0, b, false);
  // horoz (pütürlü mahmuz)
  const hammer = G(b, 0, 0.050, -0.012);
  M(X('sch', [[0.004, -0.008], [0.006, 0.012], [0.004, 0.022, -0.008, 0.026], [-0.020, 0.031], [-0.023, 0.027], [-0.009, 0.018, -0.004, 0.004], [-0.002, -0.008]], 0.0072, 0.0009), cc, 0, 0, 0, 0, 0, 0, hammer);
  for (let i = 0; i < 5; i++) M(boxGeo(0.0074, 0.0007, 0.0014), K.dark, 0, 0.0262 + i * 0.0009, -0.008 - i * 0.0026, -0.35, 0, 0, hammer, false);
  // kırma grup (menteşe etrafında aşağı döner): üst köprü, namlu, kaburga, arpacık, ejektör, silindir
  const hz = 0.058, hy = 0.022, brk = G(b, 0, hy, hz);
  const R = G(brk, 0, -hy, -hz);
  M(X('sctop', [[0.000, 0.062], [0.060, 0.062], [0.060, 0.066], [0.060, 0.069, 0.056, 0.069], [0.004, 0.069], [0.000, 0.067]], 0.020, 0.0012), blue, 0, 0, 0, 0, 0, 0, R);
  M(boxGeo(0.0028, 0.0012, 0.012), K.dark, 0, 0.0692, 0.006, 0, 0, 0, R, false);
  M(X('sclug', [[0.047, 0.069], [0.066, 0.066], [0.068, 0.030], [0.060, 0.016], [0.050, 0.016], [0.047, 0.030]], 0.024, 0.0015), blue, 0, 0, 0, 0, 0, 0, R);
  M(cyl(0.0088, 0.0088, 0.170, 20), blue, 0, 0.0505, 0.151, Math.PI / 2, 0, 0, R);
  M(X('scrib', [[0.062, 0.0565], [0.236, 0.0565], [0.236, 0.0605], [0.062, 0.0635]], 0.0095, 0.0012), blue, 0, 0, 0, 0, 0, 0, R);
  M(X('scfs', [[0.222, 0.060], [0.228, 0.080, 0.234, 0.060]], 0.0028, 0.0005), cc, 0, 0, 0, 0, 0, 0, R, false);
  M(cyl(0.0091, 0.0091, 0.004, 20), mat('#3b3e43', { m: 1, r: 0.3 }), 0, 0.0505, 0.2355, Math.PI / 2, 0, 0, R, false);
  M(cyl(0.0058, 0.0058, 0.006, 16), K.hole, 0, 0.0505, 0.2365, Math.PI / 2, 0, 0, R, false);
  M(cyl(0.0058, 0.0058, 0.130, 14), blue, 0, 0.0352, 0.126, Math.PI / 2, 0, 0, R);
  M(boxGeo(0.0055, 0.010, 0.128), blue, 0, 0.0425, 0.127, 0, 0, 0, R);
  M(cyl(0.0046, 0.0046, 0.006, 14), cc, 0, 0.0352, 0.1935, Math.PI / 2, 0, 0, R, false);
  decal(R, 'SCHOFIELD  .45', 0.040, 0.0035, 0.0049, 0.0588, 0.120, 1);
  // silindir (oluklu, 6 yuva, pirinç kovan dipleri)
  const cylG = G(R, 0, 0.036, 0.025);
  M(cyl(0.0222, 0.0222, 0.042, 32), blue, 0, 0, 0, Math.PI / 2, 0, 0, cylG);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, f = G(cylG); f.rotation.z = a + Math.PI / 6;
    M(boxGeo(0.0045, 0.0034, 0.028), K.dark, 0, 0.0212, 0.002, 0, 0, 0, f, false);
    const c = G(cylG); c.rotation.z = a;
    M(cyl(0.0048, 0.0048, 0.0425, 14), K.hole, 0, 0.0145, 0, Math.PI / 2, 0, 0, c, false);
    M(cyl(0.0056, 0.0056, 0.0012, 14), K.brass, 0, 0.0145, -0.0214, Math.PI / 2, 0, 0, c, false);
    M(cyl(0.0016, 0.0016, 0.0014, 10), mat('#d8c8a0', { m: 1, r: 0.25 }), 0, 0.0145, -0.0216, Math.PI / 2, 0, 0, c, false);
    M(boxGeo(0.0028, 0.0016, 0.004), K.dark, 0, 0.0218, 0.0175, 0, 0, 0, c, false);
  }
  M(cyl(0.003, 0.003, 0.008, 10), cc, 0, 0, 0.024, Math.PI / 2, 0, 0, cylG, false);
  return finish(g, s, { hammer, cyl: cylG, brk, muzzle: new THREE.Vector3(0, 0.0505 * scale, 0.245 * scale), sightY: 0.0705, shine: K.list, kind: 'schofield' });
}

// ---------- HK MP5K ----------
export function createMP5K({ scale = 1.45, shine = null } = {}) {
  const g = new THREE.Group(), s = G(g); s.scale.setScalar(scale);
  const b = G(s, 0, 0, 0.02);
  const K = kit(shine);
  const rec = shine ? K.S : mat('#1b1d21', { m: 0.7, r: 0.42 }), poly = shine ? K.S : mat('#161719', { r: 0.8 });
  // gövde: alt kutu + yuvarlak üst + presleme çıkıntıları
  M(X('mpr', [[-0.062, 0.030], [0.150, 0.030], [0.182, 0.042], [0.182, 0.068], [-0.062, 0.068]], 0.040, 0.003), rec, 0, 0, 0, 0, 0, 0, b);
  M(cyl(0.0198, 0.0198, 0.244, 28), rec, 0, 0.068, 0.060, Math.PI / 2, 0, 0, b);
  both(sd => { M(boxGeo(0.0016, 0.0035, 0.19), rec, sd * 0.0204, 0.050, 0.055, 0, 0, 0, b, false); M(boxGeo(0.0016, 0.006, 0.05), rec, sd * 0.0204, 0.062, 0.135, 0, 0, 0, b, false); });
  // arka kapak + kayış halkası
  M(boxGeo(0.041, 0.044, 0.008), mat('#111214', { m: 0.5, r: 0.5 }), 0, 0.056, -0.066, 0, 0, 0, b);
  M(torus(0.008, 0.0018, 8, 20), K.steel, 0, 0.042, -0.074, 0, Math.PI / 2, 0, b, false);
  // kurma tüpü + sol kurma kolu (doldururken geri çekilir)
  M(cyl(0.0102, 0.0102, 0.068, 18), rec, 0, 0.078, 0.182, Math.PI / 2, 0, 0, b);
  M(boxGeo(0.0022, 0.004, 0.060), K.dark, 0.0102, 0.078, 0.18, 0, 0, 0, b, false);
  const handle = G(b, 0, 0, 0); handle.userData.z0 = 0;
  M(boxGeo(0.014, 0.006, 0.008), K.dark, 0.016, 0.078, 0.205, 0, 0, 0, handle, false);
  M(cyl(0.0046, 0.0046, 0.010, 14), K.dark, 0.026, 0.078, 0.205, 0, 0, Math.PI / 2, handle, false);
  // arpacık (halka korumalı)
  M(boxGeo(0.016, 0.012, 0.012), rec, 0, 0.086, 0.212, 0, 0, 0, b);
  M(torus(0.0086, 0.0019, 8, 24), rec, 0, 0.097, 0.212, 0, 0, 0, b);
  M(boxGeo(0.0022, 0.0085, 0.003), K.dark, 0, 0.09355, 0.212, 0, 0, 0, b, false);
  // döner gez (diyopter) — nişan alınca içinden bakılan halka gösterilir
  M(boxGeo(0.024, 0.01, 0.020), rec, 0, 0.087, -0.036, 0, 0, 0, b);
  const rear = G(b, 0, 0, 0), ap = G(b, 0, 0, 0); ap.visible = false;
  M(cyl(0.011, 0.011, 0.024, 20), rec, 0, 0.098, -0.036, 0, 0, Math.PI / 2, rear);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; M(cyl(0.0024, 0.0024, 0.0245, 10), K.hole, 0, 0.098 + Math.sin(a) * 0.0105, -0.036 + Math.cos(a) * 0.0105, 0, 0, Math.PI / 2, rear, false); }
  M(cyl(0.0021, 0.0021, 0.022, 10), K.hole, 0, 0.098, -0.036, Math.PI / 2, 0, 0, rear, false);
  M(torus(0.0042, 0.0022, 10, 28), K.dark, 0, 0.098, -0.04, 0, 0, 0, ap, false);
  both(sd => M(boxGeo(0.004, 0.014, 0.01), rec, sd * 0.0092, 0.094, -0.04, 0, 0, 0, ap, false));
  // namlu, somun, üç tırnak, ağız
  M(cyl(0.0106, 0.0106, 0.010, 20), K.steel, 0, 0.052, 0.187, Math.PI / 2, 0, 0, b, false);
  M(cyl(0.0072, 0.0072, 0.084, 18), K.blue, 0, 0.052, 0.222, Math.PI / 2, 0, 0, b);
  for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * Math.PI * 2 / 3, l = G(b, Math.cos(a) * 0.0082, 0.052 + Math.sin(a) * 0.0082, 0.25); l.rotation.z = a - Math.PI / 2; M(boxGeo(0.004, 0.0028, 0.010), K.blue, 0, 0, 0, 0, 0, 0, l, false); }
  M(cyl(0.0045, 0.0045, 0.004, 14), K.hole, 0, 0.052, 0.2635, Math.PI / 2, 0, 0, b, false);
  // atım penceresi + sürgü (ateşte geri gelir)
  M(boxGeo(0.0016, 0.014, 0.040), K.dark, -0.0202, 0.060, 0.105, 0, 0, 0, b, false);
  const bolt = G(b, 0, 0, 0); bolt.userData.z0 = 0;
  M(boxGeo(0.0014, 0.009, 0.030), mat('#7a7f86', { m: 1, r: 0.3 }), -0.0206, 0.060, 0.104, 0, 0, 0, bolt, false);
  // tetik grubu (polimer) + kabza
  const front = grooves([0.000, -0.014], [-0.022, -0.098], 4, 0.003);
  const lower = [[-0.054, 0.031], [0.052, 0.031], [0.052, 0.018], [0.046, 0.012], [0.046, -0.012], [0.046, -0.020, 0.038, -0.020], [0.012, -0.020], [0.004, -0.020, 0.000, -0.014], ...front,
    [-0.026, -0.104], [-0.066, -0.104], [-0.060, -0.060, -0.050, -0.014], [-0.054, 0.010], [-0.054, 0.031]];
  const tg = [[0.010, -0.0135], [0.036, -0.0135], [0.040, -0.0135, 0.040, -0.008], [0.040, 0.008], [0.012, 0.008], [0.004, 0.004, 0.010, -0.0135]];
  M(X('mpl', lower, 0.034, 0.0022, [tg]), poly, 0, 0, 0, 0, 0, 0, b);
  M(X('mplg', [[-0.004, -0.020], [-0.022, -0.090], [-0.060, -0.090], [-0.050, -0.020]], 0.0352, 0.0006), K.grip, 0, 0, 0, 0, 0, 0, b, false);
  M(X('mpt', [[0.026, 0.008], [0.031, -0.002, 0.025, -0.012], [0.0215, -0.012], [0.0265, -0.002, 0.022, 0.008]], 0.006, 0.0008), K.steel, 0, 0, 0, 0, 0, 0, b, false);
  for (const z of [-0.046, 0.044]) M(cyl(0.0026, 0.0026, 0.0418, 12), K.steel, 0, 0.034, z, 0, 0, Math.PI / 2, b, false);
  // seçici kol (sol) + işaretler
  M(cyl(0.0052, 0.0052, 0.003, 16), K.steel, 0.0181, 0.019, -0.030, 0, 0, Math.PI / 2, b, false);
  M(X('mpsel', [[-0.030, 0.0175], [-0.014, 0.0185], [-0.013, 0.0215], [-0.030, 0.0205]], 0.0024, 0.0004), K.steel, 0.0196, 0, 0, 0, 0, 0, b, false);
  [['#ffffff', 0.4], ['#e03030', 0], ['#e03030', -0.4]].forEach(([c, a], i) => M(sph(0.0011, 8, 6), mat(c, { r: 0.5, e: c, ei: 0.2 }), 0.0172, 0.019 + Math.sin(Math.PI / 2 + a) * 0.009, -0.030 + Math.cos(Math.PI / 2 + a) * 0.009 + 0.004, 0, 0, 0, b, false));
  // şarjör yuvası + düğme
  M(boxGeo(0.030, 0.014, 0.042), rec, 0, 0.024, 0.075, 0, 0, 0, b);
  M(boxGeo(0.012, 0.010, 0.004), K.dark, 0, 0.018, 0.052, 0.3, 0, 0, b, false);
  decal(b, 'MP5K', 0.022, 0.006, 0.0151, 0.024, 0.075, 1);
  decal(b, 'HK  Kal. 9mm x19', 0.040, 0.0042, 0.0201, 0.044, 0.030, 1);
  decal(b, 'HECKLER & KOCH GmbH', 0.050, 0.0042, -0.0201, 0.044, 0.020, -1);
  // ön dikey kabza (el durdurmalı)
  M(X('mpfg', [[0.122, 0.031], [0.162, 0.031], [0.170, 0.022], [0.176, 0.014, 0.166, 0.012], [0.160, 0.008], [0.156, -0.060], [0.156, -0.068, 0.146, -0.068], [0.134, -0.068], [0.126, -0.068, 0.126, -0.060], [0.130, 0.008], [0.122, 0.016]], 0.030, 0.002), poly, 0, 0, 0, 0, 0, 0, b);
  for (let i = 0; i < 5; i++) M(boxGeo(0.024, 0.0026, 0.004), K.dark, 0, -0.008 - i * 0.011, 0.1295 + i * 0.0003, 0, 0, 0, b, false);
  M(torus(0.006, 0.0015, 8, 18), K.steel, 0, 0.030, 0.176, 0, Math.PI / 2, 0, b, false);
  // kavisli şarjör (yan kaburgalı)
  const mag = G(b, 0, 0, 0);
  M(X('mpm', [[0.058, 0.022], [0.090, 0.022], [0.090, -0.004], [0.092, -0.060, 0.110, -0.098], [0.106, -0.106], [0.078, -0.110], [0.060, -0.064, 0.058, -0.004]], 0.022, 0.0016), K.dark, 0, 0, 0, 0, 0, 0, mag);
  M(X('mpmr', [[0.066, 0.010], [0.071, 0.010], [0.074, -0.058, 0.092, -0.096], [0.087, -0.098], [0.068, -0.058, 0.066, 0.010]], 0.0236, 0.0006), mat('#1c1d20', { m: 0.6, r: 0.4 }), 0, 0, 0, 0, 0, 0, mag, false);
  M(X('mpmb', [[0.076, -0.108], [0.108, -0.104], [0.110, -0.110], [0.076, -0.115]], 0.025, 0.0012), K.dark, 0, 0, 0, 0, 0, 0, mag, false);
  return finish(g, s, { bolt, handle, mag, rear, ap, muzzle: new THREE.Vector3(0, 0.052 * scale, 0.286 * scale), sightY: 0.098, shine: K.list, kind: 'mp5k' });
}

// Mağaza kimliğinden model
export function createWeapon(id, { scale = 1.45 } = {}) {
  if (id === 'deagle' || id === 'golddeagle') return createDeagle({ scale, shine: id === 'golddeagle' ? 'gold' : null });
  if (id === 'schofield') return createSchofield({ scale });
  if (id === 'mp5k') return createMP5K({ scale });
  return createGlock19({ scale, shine: id === 'silverglock' ? 'silver' : null });
}
