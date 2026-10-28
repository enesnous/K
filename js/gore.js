// Kan ve uzuv kopması: vurulan uzuv belirli hasarda kopar, güdükten kan fışkırır, yere kan göleti yayılır.
import * as THREE from 'three';
import { boxGeo, cyl, M } from './kit.js';

const LIMB_HP = 140; // kol / bacak: tek mermide kopmaz — Deagle ~4 atış, MP5K ile tarama ~11 mermi
const HEAD_HP = 620; // kafa: her isabette parça koparır, bu kadar birikince tamamen parçalanır (Deagle ~4-5 atış)
const BODY_GIB = 180; // ölü bedene bu kadar hasar: tamamen parçalanır
const JOINT = { neck: [0, 0.02, 0], shL: [0, 0, 0], shR: [0, 0, 0], hipL: [0, 0, 0], hipR: [0, 0, 0] };
let blobTex = null;
function blob() { // düzensiz kenarlı kan lekesi dokusu
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 44 + Math.sin(a * 3) * 8 + Math.sin(a * 7 + 1) * 5 + Math.random() * 4; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill();
  for (let i = 0; i < 9; i++) { const a = Math.random() * 7, r = 50 + Math.random() * 10; g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 3 + Math.random() * 6, 0, 7); g.fill(); }
  blobTex = new THREE.CanvasTexture(c); return blobTex;
}

export class Gore {
  constructor(game) {
    this.g = game; this.scene = game.scene;
    this.poolMat = new THREE.MeshStandardMaterial({ color: '#4a0405', roughness: 0.18, metalness: 0.1, alphaMap: blob(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.woundMat = new THREE.MeshStandardMaterial({ color: '#5a0606', roughness: 0.3 });
    this.stumpMat = new THREE.MeshStandardMaterial({ color: '#7a0d0d', roughness: 0.4 });
    this.boneMat = new THREE.MeshStandardMaterial({ color: '#e8e0cc', roughness: 0.6 });
    this.disc = new THREE.CircleGeometry(0.5, 20); this.disc.rotateX(-Math.PI / 2);
    this.pools = []; this.debris = []; this.spurts = []; this.gibs = []; this.n = 0;
    this.gibGeo = boxGeo(1, 1, 1);
  }
  clear() {
    for (const p of this.pools) this.scene.remove(p.m);
    for (const d of this.debris) this.scene.remove(d.o);
    for (const d of this.gibs) this.scene.remove(d.o);
    this.pools = []; this.debris = []; this.spurts = []; this.gibs = [];
  }
  ground(x, z, y) { const w = this.g.world; return w ? w.heightAt(x, z, y + 0.3) : 0; }
  // yere kan: r büyüyerek hedef boyuta ulaşır
  pool(p, maxR, grow = 8) {
    if (this.pools.length > 60) { const o = this.pools.shift(); this.scene.remove(o.m); }
    const m = new THREE.Mesh(this.disc, this.poolMat); m.renderOrder = 2;
    m.position.set(p.x, this.ground(p.x, p.z, p.y) + 0.012 + (this.n++ % 20) * 0.0004, p.z); m.rotation.y = Math.random() * 6.28;
    m.scale.setScalar(0.01); this.scene.add(m);
    this.pools.push({ m, r: 0.05, max: maxR, grow }); return m;
  }
  // isabet: yara izi, uzuv hasarı, gerekirse kopma
  hit(npc, limb, point, dmg, dir) {
    const c = npc.char; if (!c || npc.gibbed) return null;
    if (!limb) { // gövde: yalnız merminin değdiği yer — yara izi, kopan küçük parçalar ve kan (beden patlamaz)
      if (point) { const lp = c.body.worldToLocal(point.clone()); const w = M(boxGeo(0.09, 0.09, 0.09), this.woundMat, lp.x, lp.y, lp.z * 0.95, 0, 0, 0, c.body, false); w.castShadow = false; this.shatter(c.torso, dir, 3, point, 0.55); }
      return null;
    }
    const grp = c[limb === 'neck' ? 'neck' : limb]; if (!grp || !grp.visible) return null;
    if (point) { // yara izi (uzva yapışık) + isabet noktasından kopan küçük parçalar ve kan
      const lp = grp.worldToLocal(point.clone()); const w = M(boxGeo(0.08, 0.08, 0.08), this.woundMat, lp.x * 0.92, lp.y, lp.z * 0.92, 0, 0, 0, grp, false); w.castShadow = false;
      this.shatter(grp, dir, limb === 'neck' ? 4 : 3, point, 0.6);
    }
    npc.limbDmg = npc.limbDmg || {}; npc.limbDmg[limb] = (npc.limbDmg[limb] || 0) + dmg;
    const cut = npc.limbDmg[limb] >= (limb === 'neck' ? HEAD_HP : LIMB_HP);
    if (cut) { const sh = limb === 'neck'; this.sever(npc, limb, dir, sh); return sh ? limb + '!' : limb; } // kafa tamamen parçalanır, kol/bacak kopup düşer
    return null;
  }
  // bir grubun malzemelerinden (kıyafet, ten) etrafa saçılan parçalar
  shatter(grp, dir, n = 10, at = null, size = 1) {
    grp.updateMatrixWorld(true);
    const mats = []; grp.traverse(m => { if (m.isMesh && m.visible) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { if (x && !x.transparent) mats.push(x); }); });
    if (!mats.length) mats.push(this.stumpMat);
    const box = new THREE.Box3().setFromObject(grp), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    for (let i = 0; i < n; i++) {
      if (this.gibs.length > 90) { const d0 = this.gibs.shift(); this.scene.remove(d0.o); }
      const k = (0.06 + Math.random() * 0.11) * size, m = new THREE.Mesh(this.gibGeo, i % 4 === 0 ? this.stumpMat : mats[Math.floor(Math.random() * mats.length)]);
      m.scale.set(k * (0.7 + Math.random() * 0.6), k * (0.6 + Math.random() * 0.6), k); m.castShadow = true;
      if (at) m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1));
      else m.position.set(c.x + (Math.random() - 0.5) * sz.x, c.y + (Math.random() - 0.5) * sz.y, c.z + (Math.random() - 0.5) * sz.z);
      this.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 4, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 4); if (dir) v.addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 2 + Math.random() * 2);
      this.gibs.push({ o: m, v, w: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20), rest: false, t: 0, small: true });
    }
    const bc = at || c; for (let i = 0; i < (at ? 2 : 3); i++) this.g.fx.blood(bc.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)), false);
    return c;
  }
  // bütün beden parçalanır
  explode(npc, dir) {
    const c = npc.char; if (npc.gibbed) return; npc.gibbed = true;
    const tp = c.torso.getWorldPosition(new THREE.Vector3());
    for (const k of ['neck', 'shL', 'shR', 'hipL', 'hipR']) if (c[k].visible) { this.shatter(c[k], dir, 7); c[k].visible = false; }
    this.shatter(c.body, dir, 14);
    c.root.visible = false; npc.hiddenByGore = true;
    this.pool(tp, 1.4, 6); this.pool(tp.clone().add(new THREE.Vector3(0.6, 0, -0.3)), 0.7, 4);
  }
  sever(npc, limb, dir, shatter = false) {
    const c = npc.char, grp = c[limb]; if (!grp || !grp.visible) return;
    grp.updateMatrixWorld(true);
    let o = null;
    if (shatter) this.shatter(grp, dir, 16);
    else { this.shatter(grp, dir, 5, null, 0.8); o = grp.clone(true); grp.matrixWorld.decompose(o.position, o.quaternion, o.scale); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); this.scene.add(o); }
    grp.visible = false; (npc.severed ||= {})[limb] = true;
    // güdük: kanlı kesit + kemik
    const j = JOINT[limb], par = grp.parent, s = limb === 'neck';
    const st = M(s ? cyl(0.1, 0.1, 0.05, 10) : boxGeo(limb.startsWith('hip') ? 0.31 : 0.3, 0.05, 0.33), this.stumpMat, grp.position.x + j[0], grp.position.y + j[1] + (s ? 0.02 : limb.startsWith('hip') ? -0.03 : -0.02), grp.position.z + j[2], 0, 0, 0, par, false);
    M(cyl(0.035, 0.035, 0.06, 8), this.boneMat, 0, 0.01, 0, 0, 0, 0, st, false);
    // uçan uzuv
    const v = new THREE.Vector3(dir ? dir.x : 0, 0, dir ? dir.z : 0).normalize().multiplyScalar(2.4 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5), 2.2 + Math.random(), (Math.random() - 0.5)));
    if (o && this.debris.length > 14) { const d0 = this.debris.shift(); this.scene.remove(d0.o); }
    if (o) this.debris.push({ o, v, w: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14), rest: false, t: 0 });
    this.spurts.push({ npc, joint: st, t: 3.2, e: 0 });
    const wp = st.getWorldPosition(new THREE.Vector3());
    this.g.fx.blood(wp, false); this.g.fx.blood(wp, false);
    this.pool(wp, 0.35, 3);
    // sonuçlar
    if (!this.g.isClient && limb.startsWith('sh') && npc.weaponMesh && npc.weaponShown && npc.dropWeapon) npc.dropWeapon(); // kolu kopan silahını düşürür
  }
  update(dt) {
    // büyüyen göletler
    for (const p of this.pools) if (p.r < p.max) { p.r = Math.min(p.max, p.r + dt * p.max / p.grow); p.m.scale.setScalar(p.r * 2); }
    // kopan uzuvlar: yerçekimi, sekme, durunca altında küçük gölet
    for (const d of this.debris.concat(this.gibs)) {
      if (d.rest) continue;
      d.t += dt; d.v.y -= 14 * dt; d.o.position.addScaledVector(d.v, dt);
      d.o.rotation.x += d.w.x * dt; d.o.rotation.y += d.w.y * dt; d.o.rotation.z += d.w.z * dt;
      const gy = this.ground(d.o.position.x, d.o.position.z, d.o.position.y) + (d.small ? d.o.scale.y / 2 : 0.12);
      if (d.o.position.y < gy) { d.o.position.y = gy; d.v.y = Math.abs(d.v.y) * 0.3; d.v.x *= 0.5; d.v.z *= 0.5; d.w.multiplyScalar(0.45);
        if (d.v.length() < 0.6 || d.t > 3) { d.rest = true; if (d.small) { d.o.rotation.x = 0; d.o.rotation.z = 0; if (Math.random() < 0.3) this.pool(d.o.position, 0.12, 2); } else { d.o.rotation.x = Math.round(d.o.rotation.x / (Math.PI / 2)) * Math.PI / 2; d.o.rotation.z = Math.PI / 2; this.pool(d.o.position, 0.4, 5); } } }
    }
    // güdükten fışkıran kan
    for (let i = this.spurts.length - 1; i >= 0; i--) {
      const s = this.spurts[i]; s.t -= dt; s.e -= dt; if (s.t <= 0) { this.spurts.splice(i, 1); continue; }
      if (s.e <= 0) { s.e = 0.14; const wp = s.joint.getWorldPosition(new THREE.Vector3()); this.g.fx.blood(wp, false); if (Math.random() < 0.4) this.pool(wp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), 0.12 + Math.random() * 0.1, 1); }
    }
    // yerde yatanların altında kan göleti, yaralı yürüyenlerden damla izi
    for (const n of this.g.npcs) {
      if (n.removed || !n.char) continue;
      const lying = n.state === 'dead' || n.state === 'injured' || n.state === 'stable';
      if (lying && n.hitByBullet && !n.poolMade) { n.poolT = (n.poolT || 0) + dt; if (n.poolT > 1.2) { n.poolMade = true; const tp = n.char.torso.getWorldPosition(new THREE.Vector3()); this.pool(tp, n.state === 'dead' ? 1.15 : 0.8, n.state === 'dead' ? 14 : 22); } }
      if (!lying && n.hitByBullet && n.alive) {
        const last = n._drip || (n._drip = n.pos.clone());
        if (n.pos.distanceTo(last) > 0.7 && (n.dripLeft = (n.dripLeft ?? 25)) > 0) { n.dripLeft--; last.copy(n.pos); this.pool(n.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)), 0.06 + Math.random() * 0.06, 0.3); }
      }
    }
  }
}
