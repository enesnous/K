// Mağaza stüdyosu: aydınlık gri fon, döner platform, yumuşak ışıklar; ürün küçük resimleri.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from './character.js';
import { createWeapon } from './guns.js';
import { loadoutAppearance } from './shop.js';
import { disposeTree, mat, boxGeo, rbox, cyl, plane, M, G } from './kit.js';
import { CHAPTERS } from './story.js';
import { LOCATION_NAMES } from './locations.js';
import * as TX from './textures.js';

const BG = '#c3c6cb';
// Hikâye operasyon haritası: şehir planı, 14 bölümün yerleri, tamamlananlar işaretli
function storyMap(ch) {
  const W = 1536, H = 960, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#eef0ea'; g.fillRect(0, 0, W, H);
  const mx = 40, my = 96, mw = 1060, mh = 820; // harita alanı
  g.fillStyle = '#e4e7df'; g.fillRect(mx, my, mw, mh);
  // bloklar
  for (let y = my + 10; y < my + mh - 30; y += 66) for (let x = mx + 10; x < mx + mw - 40; x += 92) { if (rnd() < 0.08) continue; const p = rnd(); g.fillStyle = p < 0.12 ? '#cfe3c4' : p < 0.2 ? '#d9d4c8' : '#d6d9de'; g.fillRect(x, y, 78 - rnd() * 18, 52 - rnd() * 14); }
  // nehir ve park
  g.strokeStyle = '#b7d3ea'; g.lineWidth = 34; g.beginPath(); g.moveTo(mx, my + mh * 0.7); g.bezierCurveTo(mx + mw * 0.3, my + mh * 0.55, mx + mw * 0.55, my + mh * 0.95, mx + mw, my + mh * 0.78); g.stroke();
  g.fillStyle = '#c4dcb6'; g.beginPath(); g.ellipse(mx + mw * 0.72, my + mh * 0.22, 120, 70, 0.2, 0, 7); g.fill();
  // ana yollar
  g.strokeStyle = '#ffffff'; g.lineWidth = 16; g.lineCap = 'round';
  for (const [a, b, c2, d] of [[0.0, 0.32, 1, 0.28], [0.0, 0.55, 1, 0.6], [0.24, 0, 0.3, 1], [0.62, 0, 0.58, 1], [0.0, 0.92, 1, 0.12]]) { g.beginPath(); g.moveTo(mx + mw * a, my + mh * b); g.lineTo(mx + mw * c2, my + mh * d); g.stroke(); }
  g.strokeStyle = '#f4c95d'; g.lineWidth = 4; g.beginPath(); g.moveTo(mx, my + mh * 0.32); g.lineTo(mx + mw, my + mh * 0.28); g.stroke();
  g.strokeStyle = '#9aa1aa'; g.lineWidth = 3; g.strokeRect(mx, my, mw, mh);
  // başlık
  g.fillStyle = '#16181c'; g.font = `800 46px ${TX.FONT}`; g.textBaseline = 'middle'; g.fillText('OPERASYON HARİTASI', mx, 50);
  g.fillStyle = '#6b717b'; g.font = `600 24px ${TX.FONT}`; g.fillText('Hikâye modu · 14 bölüm', mx + 520, 52);
  // iğneler + rota
  sd = 77; const pts = CHAPTERS.map(() => [mx + 70 + rnd() * (mw - 140), my + 60 + rnd() * (mh - 120)]);
  g.strokeStyle = 'rgba(200,40,40,.55)'; g.lineWidth = 4; g.setLineDash([12, 10]); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
  CHAPTERS.forEach((C, i) => {
    const [x, y] = pts[i], done = C.n < ch, cur = C.n === ch;
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x + 3, y + 26, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = done ? '#2f9e5b' : cur ? '#e0322f' : '#5d636c'; g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#fff'; g.font = `800 22px ${TX.FONT}`; g.textAlign = 'center'; g.fillText(String(C.n), x, y + 1); g.textAlign = 'left';
  });
  // lejant
  const lx = mx + mw + 36; g.fillStyle = '#16181c'; g.font = `700 26px ${TX.FONT}`; g.fillText('Bölümler', lx, my + 14);
  CHAPTERS.forEach((C, i) => {
    const y = my + 64 + i * 56, done = C.n < ch, cur = C.n === ch;
    g.fillStyle = done ? '#2f9e5b' : cur ? '#e0322f' : '#8a9099'; g.beginPath(); g.arc(lx + 14, y, 14, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = `800 15px ${TX.FONT}`; g.textAlign = 'center'; g.fillText(String(C.n), lx + 14, y + 1); g.textAlign = 'left';
    g.fillStyle = '#16181c'; g.font = `700 19px ${TX.FONT}`; g.fillText(C.name.length > 27 ? C.name.slice(0, 26) + '…' : C.name, lx + 38, y - 8);
    g.fillStyle = '#6b717b'; g.font = `500 15px ${TX.FONT}`; g.fillText(LOCATION_NAMES[C.loc] || '', lx + 38, y + 13);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// Karakol brifing odası arka planı (az parça, gölgesiz)
function backdrop(s, ch) {
  const R = G(s), wall = mat('#d7dade', { r: 0.9 }), dark = mat('#2a2e35', { r: 0.6, m: 0.3 }), steel = mat('#9ea4ac', { r: 0.45, m: 0.6 });
  M(boxGeo(16, 5, 0.2), wall, 0, 2.5, -3.6, 0, 0, 0, R);
  for (let i = -7; i <= 7; i++) M(boxGeo(0.02, 5, 0.02), mat('#c7cace', { r: 0.9 }), i * 1.1, 2.5, -3.49, 0, 0, 0, R, false);
  M(boxGeo(16, 0.14, 0.04), mat('#9097a0', { r: 0.6 }), 0, 0.07, -3.48, 0, 0, 0, R, false);
  M(boxGeo(16, 0.5, 0.03), mat('#1f3f7a', { r: 0.7 }), 0, 3.3, -3.48, 0, 0, 0, R, false); // lacivert şerit
  // harita panosu
  const mp = G(R, 1.55, 1.75, -3.45);
  M(boxGeo(3.35, 2.15, 0.06), dark, 0, 0, 0, 0, 0, 0, mp);
  M(plane(3.2, 2.0), new THREE.MeshStandardMaterial({ map: storyMap(ch), roughness: 0.75 }), 0, 0, 0.035, 0, 0, 0, mp, false);
  M(boxGeo(3.35, 0.06, 0.12), steel, 0, -1.1, 0.05, 0, 0, 0, mp, false);
  // POLİS ışıklı tabela
  const sg = M(plane(1.6, 0.42), new THREE.MeshStandardMaterial({ map: TX.sign('POLİS', { bg: '#1f3f7a', fg: '#ffffff', w: 512, h: 128 }), emissive: '#ffffff', emissiveIntensity: 0.25, emissiveMap: TX.sign('POLİS', { bg: '#1f3f7a', fg: '#ffffff', w: 512, h: 128 }) }), -1.9, 2.75, -3.47, 0, 0, 0, R, false);
  // dolaplar
  for (let i = 0; i < 3; i++) { const x = -4.3 + i * 0.62; M(rbox(0.6, 1.9, 0.5, 0.02), mat('#7d8691', { r: 0.5, m: 0.5 }), x, 0.95, -3.2, 0, 0, 0, R); for (let k = 0; k < 4; k++) M(boxGeo(0.4, 0.015, 0.01), dark, x, 1.6 - k * 0.04, -2.945, 0, 0, 0, R, false); M(boxGeo(0.03, 0.12, 0.02), steel, x + 0.22, 1.0, -2.94, 0, 0, 0, R, false); }
  // bank, bitki, saat
  M(boxGeo(1.6, 0.06, 0.4), mat('#8a6a48', { r: 0.6 }), -1.8, 0.45, -3.0, 0, 0, 0, R); for (const x of [-2.5, -1.1]) M(boxGeo(0.05, 0.45, 0.35), dark, x, 0.22, -3.0, 0, 0, 0, R, false);
  M(cyl(0.22, 0.18, 0.45, 16), mat('#f2f2f0', { r: 0.6 }), 3.9, 0.225, -3.1, 0, 0, 0, R);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; M(boxGeo(0.08, 0.9, 0.02), mat('#4f7d45', { r: 0.8 }), 3.9 + Math.cos(a) * 0.1, 0.85, -3.1 + Math.sin(a) * 0.1, Math.sin(a) * 0.35, a, Math.cos(a) * 0.35, R, false); }
  const ck = G(R, -0.2, 3.0, -3.46); M(cyl(0.24, 0.24, 0.04, 28), mat('#ffffff', { r: 0.5 }), 0, 0, 0, Math.PI / 2, 0, 0, ck, false); M(cyl(0.25, 0.25, 0.03, 28), dark, 0, 0, -0.01, Math.PI / 2, 0, 0, ck, false);
  M(boxGeo(0.015, 0.16, 0.01), dark, 0.0, 0.06, 0.03, 0, 0, -0.6, ck, false); M(boxGeo(0.012, 0.11, 0.01), dark, 0, 0.04, 0.035, 0, 0, 1.9, ck, false);
  return R;
}
function lights(scene, shadow) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9da3, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 6, 5);
  if (shadow) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const c = key.shadow.camera; c.left = c.bottom = -3; c.right = c.top = 3; c.near = 1; c.far = 20; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; }
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8eeff, 0.8); fill.position.set(4, 2, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(1, 4, -5); scene.add(rim);
}
// Bir nesnenin sınırlarına göre kamerayı yerleştir (yan / 3/4 görünüm)
function frame(cam, box, { dir = new THREE.Vector3(0.35, 0.12, 1), pad = 1.15, look = null } = {}) {
  const c = look || box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const r = Math.max(sz.x, sz.y, sz.z) * 0.5 * pad;
  const d = r / Math.sin(THREE.MathUtils.degToRad(cam.fov) / 2);
  cam.position.copy(c).addScaledVector(dir.clone().normalize(), d); cam.lookAt(c);
  cam.near = d / 50; cam.far = d * 10; cam.updateProjectionMatrix();
}
// Ürün nesnesi: tabanca tek başına, kıyafet karakter üstünde
export function buildItem(cat, eq) {
  if (cat === 'weapon') { const m = createWeapon(eq.weapon, { scale: 1 }); return { obj: m, kind: 'gun', shine: m.userData.shine || [] }; }
  const c = new Character(loadoutAppearance(cat === 'hair' || cat === 'hairColor' ? { ...eq, helmet: 'none' } : eq, 7)); c.setPose('idle'); for (let i = 0; i < 12; i++) c.update(0.05);
  return { obj: c.root, char: c, kind: cat, shine: c.shineMats || [] };
}

export class Studio {
  constructor(renderer, ch = 1) {
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(BG); s.fog = new THREE.Fog(BG, 14, 34);
    this.back = backdrop(s, ch); this.ch = ch;
    const pm = new THREE.PMREMGenerator(renderer); s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; s.environmentIntensity = 0.55; pm.dispose();
    lights(s, true);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    // döner platform
    const tt = this.table = new THREE.Group(); s.add(tt);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.88, 0.05, 64), new THREE.MeshStandardMaterial({ color: '#e4e6e9', roughness: 0.5 }));
    disc.position.y = 0.025; disc.receiveShadow = true; disc.castShadow = true; tt.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.865, 0.006, 6, 96), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.045; tt.add(ring);
    this.holder = new THREE.Group(); s.add(this.holder);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    this.yaw = 0.5; this.item = null; this.t = 0;
  }
  set(it) {
    this.clear(); this.item = it; if (!it) return;
    const o = it.obj; this.holder.add(o);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (it.kind === 'gun') { o.position.set(0, 0, 0); const bx = new THREE.Box3().setFromObject(o); const c = bx.getCenter(new THREE.Vector3()), sz = bx.getSize(new THREE.Vector3()); const k = 0.52 / Math.max(sz.x, sz.y, sz.z); o.scale.setScalar(k); o.position.set(-c.x * k, 0.85 - c.y * k, -c.z * k); }
    else { o.position.set(0, 0.05, 0); o.updateMatrixWorld(true); this.headY = new THREE.Box3().setFromObject(it.char.head).getCenter(new THREE.Vector3()).y; }
  }
  setChapter(ch) { if (ch === this.ch) return; this.ch = ch; this.scene.remove(this.back); disposeTree(this.back); this.back = backdrop(this.scene, ch); }
  clear() { if (this.item) { this.holder.remove(this.item.obj); disposeTree(this.item.obj); this.item = null; } }
  update(dt, aspect, panelFrac, panelFracY = 0) {
    this.t += dt; this.yaw += dt * 0.45;
    this.holder.rotation.y = this.yaw;
    const it = this.item, cam = this.cam;
    if (it) {
      if (it.char) it.char.update(dt);
      const gl = Math.pow(Math.max(0, Math.sin(this.t * 1.9)), 14); for (const m of it.shine) m.emissiveIntensity = gl * 0.05;
    }
    cam.aspect = aspect;
    const gun = it && it.kind === 'gun', head = it && (it.kind === 'helmet' || it.kind === 'hair' || it.kind === 'hairColor');
    const tgt = gun ? new THREE.Vector3(0, 0.65, 0) : head ? new THREE.Vector3(0, (this.headY || 1.8) - 0.5, 0) : new THREE.Vector3(0, 0.85, 0);
    const dist = gun ? 2.4 : head ? 5.0 : 6.4, h = gun ? 0.3 : head ? 0.12 : 0.3;
    cam.position.set(0, tgt.y + h, dist); cam.lookAt(tgt);
    // panel solda: konuyu sağdaki boş alana kaydır
    const w = 1000, vh = w / aspect, sx = panelFrac * w * 0.5, sy = panelFracY * vh * 0.5;
    if (sx > 0 || sy > 0) cam.setViewOffset(w, vh, -sx, sy, w, vh); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
}

// Küçük resimler: ayrı, şeffaf arka planlı küçük çizici; kuyruktan karede bir tane
export class Thumbs {
  constructor() {
    this.cache = new Map(); this.queue = []; this.ok = true;
    try {
      const r = this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(180, 180, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.setClearColor(0x000000, 0);
      const s = this.scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(r); s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; s.environmentIntensity = 0.6; pm.dispose();
      lights(s, false);
      this.cam = new THREE.PerspectiveCamera(24, 1, 0.01, 100);
    } catch (e) { this.ok = false; }
  }
  // anahtar: cat:id — hazırsa dataURL döner, değilse kuyruğa ekler
  get(cat, id, eq) {
    const k = cat + ':' + id;
    if (this.cache.has(k)) return this.cache.get(k);
    if (this.ok && !this.queue.some(q => q.k === k)) this.queue.push({ k, cat, eq: { ...eq, [cat]: id } });
    return '';
  }
  // hemen çiz (kasa şeridi için)
  now(cat, id, eq) {
    const k = cat + ':' + id; if (this.cache.has(k)) return this.cache.get(k);
    let url = ''; try { if (this.ok) url = this.render(cat, { ...eq, [cat]: id }); } catch (e) { console.warn('thumb', e); }
    this.cache.set(k, url); this.queue = this.queue.filter(q => q.k !== k); return url;
  }
  // karede en fazla bir küçük resim; PNG kodlama arka planda (toBlob), ana iş parçacığı takılmaz
  tick(onReady) {
    if (this.busy || !this.queue.length) return;
    const q = this.queue.shift(); this.busy = true;
    const fin = (url) => { this.cache.set(q.k, url); this.busy = false; onReady(q.k, url); };
    try { this.draw(q.cat, q.eq); this.r.domElement.toBlob(bl => fin(bl ? URL.createObjectURL(bl) : ''), 'image/png'); }
    catch (e) { console.warn('thumb', e); fin(''); }
  }
  render(cat, eq) { this.draw(cat, eq); return this.r.domElement.toDataURL('image/png'); }
  draw(cat, eq) {
    const it = buildItem(cat, eq), o = it.obj, cam = this.cam; this.scene.add(o);
    if (it.kind === 'gun') {
      o.rotation.y = -Math.PI / 2 + 0.0; // sol yan görünüm
      o.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(o);
      frame(cam, bx, { dir: new THREE.Vector3(0.18, 0.1, 1), pad: 1.02 });
    } else {
      o.rotation.y = 0.45; o.updateMatrixWorld(true);
      const bx = new THREE.Box3().setFromObject(o);
      if (cat === 'helmet' || cat === 'hair') frame(cam, new THREE.Box3().setFromObject(it.char.head), { dir: new THREE.Vector3(0.12, 0.1, 1), pad: 1.0 });
      else if (cat === 'vest') frame(cam, new THREE.Box3().setFromObject(it.char.torso), { dir: new THREE.Vector3(0.1, 0.08, 1), pad: 1.25 });
      else frame(cam, bx, { dir: new THREE.Vector3(0.1, 0.05, 1), pad: 0.78 });
    }
    for (const m of it.shine) m.emissiveIntensity = 0;
    this.r.render(this.scene, cam);
    this.scene.remove(o); disposeTree(o);
  }
}
