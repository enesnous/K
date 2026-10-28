// Birinci şahıs: kameraya bağlı eller ve silahlar.
import * as THREE from 'three';
import { createGlock, createTaser, createCuffs, createWeapon } from './items.js';
import { mat, boxGeo, rbox, cyl, torus, ownMat, M, G } from './kit.js';
import { damp } from './util.js';

export class ViewModel {
  constructor(camera) {
    this.cam = camera;
    this.root = new THREE.Group(); camera.add(this.root);
    this.sway = new THREE.Group(); this.root.add(this.sway);
    const glove = mat('#111214', { r: 0.6 });
    this.sleeve = new THREE.MeshStandardMaterial({ color: '#1b2640', roughness: 0.85 });
    const sleeve = this.sleeve;
    const mkArm = () => {
      const g = new THREE.Group();
      M(rbox(0.075, 0.085, 0.09, 0.02), glove, 0, 0, 0, 0, 0, 0, g, false);
      M(boxGeo(0.085, 0.09, 0.34), sleeve, 0, -0.01, 0.2, 0, 0, 0, g, false);
      M(boxGeo(0.088, 0.093, 0.03), mat('#0d1220', {}), 0, -0.01, 0.045, 0, 0, 0, g, false);
      return g;
    };
    // silahlar (kamera -z yönüne bakar => modeli 180° çevir)
    const wrap = (obj, s) => { const g = new THREE.Group(); obj.rotation.y = Math.PI; obj.scale.setScalar(s); g.add(obj); return g; };
    this.glock = createGlock({ scale: 1.0 }); this.taser = createTaser(); this.cuffs = createCuffs();
    this.wrap = wrap;
    this.items = [null, wrap(this.glock, 1), wrap(this.taser, 0.72), wrap(this.cuffs, 0.7)];
    this.armR = mkArm(); this.armL = mkArm();
    this.holder = new THREE.Group(); this.sway.add(this.holder);
    for (const it of this.items) if (it) { it.visible = false; this.holder.add(it); }
    this.holder.add(this.armR); this.sway.add(this.armL);
    this.armR.rotation.set(0.1, 0.25, 0); this.armR.position.set(0.012, -0.045, 0.03);
    this.slot = 0; this.k = 0; this.bob = 0; this.recoil = 0; this.lower = 1; this.equipT = 0; this.pushT = 0;
    // gece görüş dürbünü: başlıktan gözlerin önüne iner
    const ng = this.nvgG = new THREE.Group(); this.root.add(ng); ng.visible = false;
    const rub = new THREE.MeshBasicMaterial({ color: '#070808' }), nb = new THREE.MeshBasicMaterial({ color: '#14170f' });
    for (const sx of [-0.031, 0.031]) {
      M(cyl(0.0255, 0.028, 0.05, 24, true), nb, sx, 0, -0.07, Math.PI / 2, 0, 0, ng, false);
      M(torus(0.0245, 0.0035, 8, 28), rub, sx, 0, -0.045, 0, 0, 0, ng, false);
      M(cyl(0.024, 0.024, 0.002, 24), ownMat('#021306', { e: '#2bff6a', ei: 0.5 }), sx, 0, -0.092, Math.PI / 2, 0, 0, ng, false);
    }
    M(boxGeo(0.026, 0.03, 0.045), nb, 0, 0.012, -0.07, 0, 0, 0, ng, false);
    M(boxGeo(0.016, 0.07, 0.016), nb, 0, 0.05, -0.075, 0, 0, 0, ng, false);
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.renderOrder = 10; } });
    this.light = new THREE.PointLight(0xc8d8ff, 0.5, 1.4, 2); this.light.position.set(0.25, 0.15, -0.1); this.root.add(this.light);
    this.root.visible = false;
  }
  set(slot) {
    if (slot === this.slot) return;
    this.slot = slot; this.equipT = 0.25;
    this.items.forEach((it, i) => { if (it) it.visible = i === [0, 1, 3, 2][slot]; });
  }
  // Mağaza: tabanca modeli, üniforma kolu
  applyLoadout({ weapon, sleeve, oneHand }) {
    const swap = (idx, obj, s) => {
      const old = this.items[idx]; const w = this.wrap(obj, s); w.visible = old.visible;
      this.holder.remove(old); this.holder.add(w); this.items[idx] = w;
      w.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.renderOrder = 10; } });
    };
    this.glock = createWeapon(weapon || 'glock19', { scale: 1.0 }); swap(1, this.glock, 1);
    this.gunKind = this.glock.userData.kind; this.oneHand = !!oneHand;
    this.shine = this.glock.userData.shine || [];
    if (sleeve) this.sleeve.color.set(sleeve);
  }
  // atış animasyonu: sürgü / horoz + silindir / mekanizma
  fire() {
    const u = this.glock.userData; this.fireT = 0.08;
    if (u.slide) { u.slide.position.z = this.gunKind === 'deagle' ? -0.045 : -0.03; }
    if (u.hammer) { u.hammer.rotation.x = -0.9; }
    if (u.cyl) { this.cylTarget = (this.cylTarget || 0) + Math.PI / 3; }
    if (u.bolt) { u.bolt.position.z = -0.022; }
  }
  kick(a = 1) { this.recoil = Math.min(1.5, this.recoil + a); }
  push() { this.pushT = 0.3; }
  muzzleWorld() {
    const g = this.slot === 1 ? this.glock : this.taser;
    return g.localToWorld(g.userData.muzzle.clone());
  }
  update(dt, { aiming, speed, reloading, reloadF = 0, mx = 0, my = 0 }) {
    this.root.visible = true;
    // mekanizma geri dönüşleri
    const u = this.glock.userData;
    if (u.slide) u.slide.position.z = damp(u.slide.position.z, 0, 22, dt);
    if (u.hammer) u.hammer.rotation.x = damp(u.hammer.rotation.x, 0, 14, dt);
    if (u.cyl) u.cyl.rotation.z = damp(u.cyl.rotation.z, this.cylTarget || 0, 16, dt);
    if (u.bolt) u.bolt.position.z = damp(u.bolt.position.z, 0, 30, dt);
    // doldurma: şarjör çıkar/girer, kırma tabanca açılır
    const rf = reloading ? reloadF : 0, rIn = Math.sin(Math.min(1, rf) * Math.PI);
    if (u.mag) u.mag.position.y = (u.mag.userData.y0 ?? (u.mag.userData.y0 = u.mag.position.y)) - (rf > 0.15 && rf < 0.75 ? Math.min(1, (rf - 0.15) / 0.12) * Math.min(1, (0.75 - rf) / 0.12) * 0.2 : 0);
    if (u.handle) u.handle.position.z = damp(u.handle.position.z, rf > 0.76 && rf < 0.9 ? -0.055 : 0, rf > 0.76 && rf < 0.9 ? 18 : 40, dt); // MP5 kurma kolu
    if (u.rear) { const v = this.k > 0.55 && this.slot === 1; u.rear.visible = !v; u.ap.visible = v; } // MP5 diyopter
    if (u.brk) u.brk.rotation.x = damp(u.brk.rotation.x, rf > 0.1 && rf < 0.82 ? 0.75 : 0, 12, dt);
    // altın/gümüş parıltı
    if (this.shine && this.shine.length) { this.tGl = (this.tGl || 0) + dt; const gl = Math.pow(Math.max(0, Math.sin(this.tGl * 1.9)), 14); for (const m of this.shine) m.emissiveIntensity = gl * 0.05; }
    const has = this.slot !== 0;
    this.k = damp(this.k, aiming ? 1 : 0, 14, dt);
    this.lower = damp(this.lower, (reloading ? 0.25 : 0) + (this.equipT > 0 ? 1 : 0), 10, dt);
    this.tilt = damp(this.tilt || 0, reloading ? 0.55 * rIn + 0.15 : 0, 10, dt);
    if (this.equipT > 0) this.equipT -= dt;
    this.recoil = damp(this.recoil, 0, 12, dt);
    this.bob += dt * speed * 2.1;
    const bobA = Math.min(1, speed / 4) * (1 - this.k * 0.8);
    const bx = Math.sin(this.bob) * 0.012 * bobA, by = -Math.abs(Math.cos(this.bob)) * 0.014 * bobA;
    // sallanma (fare hareketine gecikmeli)
    this.sway.position.x = damp(this.sway.position.x, -mx * 0.00045 * (1 - this.k * 0.7), 8, dt);
    this.sway.position.y = damp(this.sway.position.y, my * 0.00045 * (1 - this.k * 0.7), 8, dt);
    // kalça / nişan pozisyonları
    const hip = this.slot === 2 ? [0.16, -0.2, -0.36] : this.slot === 3 ? [0.14, -0.2, -0.4] : [0.17, -0.17, -0.38];
    const ads = this.slot === 1 ? [0, -((u.sightY || 0.073) + 0.001), this.gunKind === 'mp5k' ? -0.34 : -0.3] : this.slot === 3 ? [0, -0.055, -0.3] : hip;
    const k = this.slot === 2 ? 0 : this.k;
    const h = this.holder;
    h.position.set(hip[0] + (ads[0] - hip[0]) * k + bx, hip[1] + (ads[1] - hip[1]) * k + by - this.lower * 0.25, hip[2] + (ads[2] - hip[2]) * k + this.recoil * 0.05);
    h.rotation.set(this.recoil * 0.18 + this.lower * 0.6, (1 - k) * 0.06, (1 - k) * -0.04 + (this.slot === 1 ? this.tilt : 0));
    h.visible = has;
    // sol el: nişanda kabzayı destekler, itmede öne çıkar
    if (this.pushT > 0) this.pushT -= dt;
    const push = this.pushT > 0 ? Math.sin((0.3 - this.pushT) / 0.3 * Math.PI) : 0;
    const supp = has && this.slot !== 2 && !(this.slot === 1 && this.oneHand) ? 1 : 0;
    this.armL.visible = supp > 0 || push > 0;
    if (push > 0) { this.armL.position.set(-0.08, -0.16, -0.32 - push * 0.15); this.armL.rotation.set(0, -0.2, 0); }
    else { this.armL.position.set(h.position.x - 0.025, h.position.y - 0.03, h.position.z + 0.05); this.armL.rotation.set(0.15, -0.35, 0.2); }
    if (!has && push > 0) { this.armR.visible = false; }
  }
  // a: iniş (0 yukarıda, 1 gözde), pw: görüntü açıklığı — tam açılınca dürbün modeli gizlenir
  nvgAnim(a, pw) {
    const g = this.nvgG, e = 1 - Math.pow(1 - a, 3);
    g.visible = false; // birinci şahısta model yok: geçiş ekran efektiyle yapılır
    g.position.set(0, (1 - e) * 0.085, 0); g.rotation.x = (1 - e) * 1.0;
  }
  hide() { this.root.visible = false; }
}
