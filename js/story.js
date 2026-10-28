// HİKÂYE MODU — "Son Vardiya": 14 bölümlük iki kişilik ekip hikâyesi.
// Yönetmen (Director) lider tarafında sinematik adımları sırayla oynatır, her adımı ağ üzerinden
// ekip arkadaşına da gönderir; böylece iki oyuncu da her sahneyi aynı anda, aynı sırada görür.
import * as THREE from 'three';
import { Character } from './character.js';
import { loadoutAppearance, DEFAULT } from './shop.js';
import { createGlock, createShotgun, createPhone, createBag, createWeapon } from './items.js';
import { createSUV, createCivilianCar } from './vehicles.js';
import { registerCrime } from './scenarios.js';
import { mat, boxGeo, rbox, plane, M, G, ownMat, cyl, disposeTree } from './kit.js';
import * as TX from './textures.js';
import { RNG, clamp, dampAngle } from './util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SEAT_POS = [[0.42, 0.0, 0.0], [-0.42, 0.0, 0.0]];

// ---------- adım kısayolları ----------
const say = (who, text, dur) => ({ t: 'say', who, text, dur });
const radio = (text) => ({ t: 'say', who: 'radio', text });
const cap = (text, dur) => ({ t: 'cap', text, dur });
const shot = (kind, a, b) => ({ t: 'shot', kind, a, b });
const wait = (dur) => ({ t: 'wait', dur });
const act = (fn, both = false) => ({ t: 'act', fn, both, dur: 0 });
const title = (n, name) => ({ t: 'title', n, name, dur: 3.2 });
const fade = (on, dur = 0.8) => ({ t: 'fade', on, dur });
const sfx = (name, vol = 1) => ({ t: 'sfx', name, vol, dur: 0 });

export const STORY_NAME = 'Son Vardiya';

// =====================================================================
export class Director {
  constructor(g, ch, spec) {
    this.g = g; this.ch = ch; this.n = ch.n;
    this.choices = { ...(spec.choices || {}) };
    this.seqs = {}; this.runner = null; this.cast = {}; this.fx = {}; this.flags = {};
    this.shotFn = null; this.shotT = 0; this.cine = false;
    this.votes = null; this.partner = null; this.qte = null;
    this.tied = null; // bağlı oyuncu: 'P2'
  }
  get host() { return !this.g.isClient; }
  // ---- oyuncu rolleri ----
  p2Remote() { return [...this.g.remotes.values()][0] || null; }
  isLocal(who) { return who === 'P1' ? this.g.role !== 'client' : this.g.role === 'client'; }
  actor(who) { // P1/P2 için oyun içi aktör (yerel oyuncu, uzak oyuncu ya da yapay zekâ ortak)
    if (this.isLocal(who)) return this.g.player;
    if (who === 'P2' && this.partner) return this.partner;
    return this.p2Remote(); // diğer insan oyuncu (istemci için lider = P1, lider için istemci = P2)
  }
  nameOf(who) {
    if (who === 'radio') return 'Merkez (telsiz)';
    if (who === 'phone') return 'Telefon';
    if (who === 'P1' || who === 'P2') {
      if (this.isLocal(who)) return this.g.nick || 'Memur';
      if (who === 'P2' && this.partner) return 'Kerem';
      const a = this.actor(who); return (a && a.nick) || 'Ortağın';
    }
    const c = this.cast[who]; return c ? (c.storyName || c.name) : who;
  }
  names(t) { return String(t).replace(/Player 1/g, this.nameOf('P1')).replace(/Player 2/g, this.nameOf('P2')); }
  head(who) {
    const a = this.castObj(who); if (!a) return null;
    if (a.headWorld) return a.headWorld();
    const ch = a.char; if (ch && ch.head) { const v = V(); ch.head.getWorldPosition(v); return v; }
    return a.pos ? a.pos.clone().add(V(0, 1.7, 0)) : null;
  }
  castObj(who) { if (who === 'P1' || who === 'P2') return this.actor(who); return this.cast[who] || null; }
  // ---- sahne efektleri (herkeste çalışır) ----
  def(id, fn) { this.fx[id] = fn; }
  run(id, arg) { if (this.fx[id]) this.fx[id](arg); if (this.host) this.g.netEvt({ k: 'sfx2', id, arg }); }
  onFx(d) { if (this.fx[d.id]) this.fx[d.id](d.arg); }
  // ---- sekanslar ----
  seq(name) { const s = this.seqs[name] || this.ch[name]; return typeof s === 'function' ? s(this) : (s || []); }
  play(name, done, o = {}) {
    if (!this.host) return;
    const steps = this.seq(name);
    this.runner = { name, steps, i: -1, t: 0, dur: 0, done, cine: o.cine !== false };
    this.g.netEvt({ k: 'cineStart', name, cine: this.runner.cine });
    this.begin(this.runner.cine);
    this.next();
  }
  // oynanış sırasında kısa sahne (kamera ile)
  beat(name, steps, done, o = {}) { this.seqs[name] = steps; this.play(name, done, o); }
  begin(cine) {
    this.cine = cine; this.g.ui.cine(cine); this.g.cineLock = cine;
    const car = this.g.policeCar;
    if (car && !this.carLight) { this.carLight = new THREE.PointLight(0xffe6c8, 0, 2.6, 2); this.carLight.position.set(0, 1.62, 0.25); car.add(this.carLight); }
    if (this.carLight) this.carLight.intensity = cine ? 0.9 : 0;
    const mdt = car && car.userData.mdt; if (mdt) { if (mdt.userData.ei0 === undefined) mdt.userData.ei0 = mdt.emissiveIntensity; mdt.emissiveIntensity = cine ? mdt.userData.ei0 * 0.12 : mdt.userData.ei0; }
    if (cine) { if (this.g.dialog) this.g.closeDialog(); if (this.g.radioOpen) this.g.toggleRadio(false); }
  }
  end() {
    const r = this.runner; this.runner = null; this.shotFn = null; this.cine = false; this.g.cineLock = false; this.ff = false;
    if (r && r.name === 'intro') this.introDone = true;
    if (this.carLight) this.carLight.intensity = 0;
    { const mdt = this.g.policeCar && this.g.policeCar.userData.mdt; if (mdt && mdt.userData.ei0 !== undefined) mdt.emissiveIntensity = mdt.userData.ei0; }
    this.g.ui.cine(false); this.g.ui.caption(null); this.g.ui.phone(null);
    this.restoreCast();
    if (this.host) this.g.netEvt({ k: 'cineEnd', name: r && r.name });
    if (r && r.done) r.done();
    if (this.pendingFinish && this.host && !this.runner) { this.pendingFinish = false; this.g.later(0.3, () => this.g.finishMission()); }
  }
  next() {
    const r = this.runner; if (!r) return;
    r.i++; r.t = 0;
    if (r.i >= r.steps.length) { this.end(); return; }
    const st = r.steps[r.i];
    if (this.host) this.g.netEvt({ k: 'cine', name: r.name, i: r.i });
    r.dur = this.exec(st);
  }
  // istemci: liderden gelen adımlar
  onNet(d) {
    if (d.k === 'cineStart') { this.runner = { name: d.name, steps: this.seq(d.name), i: -1, t: 0, dur: 0, cine: d.cine }; this.begin(d.cine); return; }
    if (d.k === 'cineEnd') { if (this.runner) this.end(); return; }
    if (d.k === 'cine') {
      if (!this.runner || this.runner.name !== d.name) { this.runner = { name: d.name, steps: this.seq(d.name), i: -1, t: 0, dur: 0, cine: true }; this.begin(true); }
      this.runner.i = d.i; this.runner.t = 0; const st = this.runner.steps[d.i]; if (st) this.runner.dur = this.exec(st, true);
    }
    if (d.k === 'choice') { this.choices[d.id] = d.v; }
    if (d.k === 'voteOpen') this.openVoteUI(d.id, d.q, d.opts, d.round);
    if (d.k === 'voteState') this.g.ui.voteState(d.who);
    if (d.k === 'voteClose') this.g.ui.vote(null);
    if (d.k === 'qte') this.startQTE(d.key, d.dur);
    if (d.k === 'tie') this.setTied(d.on);
    if (d.k === 'captured') this.setCaptured(d.on);
  }
  exec(st, remote = false) {
    const g = this.g;
    switch (st.t) {
      case 'say': {
        const cls = st.who === 'radio' ? 'radio' : st.who === 'phone' ? 'phone' : (this.isLocal(st.who) ? 'me' : '');
        if (st.who === 'radio') { g.audio.sfx('radio'); }
        g.ui.sub(this.nameOf(st.who), this.names(st.text), cls);
        const ob = this.castObj(st.who); if (ob && ob.char && st.who !== 'radio') { ob.char.setExpression && ob.char.setExpression(st.text.includes('!') ? 'angry' : 'neutral'); }
        return st.dur || clamp(1.4 + st.text.length * 0.052, 2.2, 7.5);
      }
      case 'cap': g.ui.caption(this.names(st.text)); return st.dur || clamp(1.6 + st.text.length * 0.05, 2.6, 7);
      case 'title': g.ui.titleCard(`BÖLÜM ${st.n}`, st.name); g.audio.sfx('objective'); return st.dur;
      case 'shot': this.setShot(st); return st.dur || 0;
      case 'wait': return st.dur;
      case 'fade': g.ui.fade(st.on, st.dur * 1000); return st.dur;
      case 'sfx': g.audio.sfx(st.name, null, st.vol); return 0;
      case 'phone': g.ui.phone(st.on ? st.text || 'GİZLİ NUMARA' : null, st.state); if (st.ring) this.ring(st.ring); return st.dur || 0;
      case 'act': if (!remote || st.both) { try { st.fn(this); } catch (e) { console.error(e); } } return st.dur || 0;
      case 'vote': if (!remote) this.hostVote(st); return 1e9; // oy bitince devam
    }
    return 0;
  }
  ring(n) { for (let i = 0; i < n; i++) { this.g.later(i * 1.1, () => { this.g.audio.sfx('uiback', null, 0.9); }); this.g.later(i * 1.1 + 0.22, () => this.g.audio.sfx('uiback', null, 0.9)); } }
  update(dt) {
    const r = this.runner;
    if (r && this.host && r.dur < 1e8) { r.t += dt * (this.ff ? 6 : 1); if (r.t >= r.dur) this.next(); }
    if (this.partner) this.partner.update(dt);
    if (this.kerem) this.kerem.update(dt);
    if (this.keremGhost) this.keremGhost.update(dt);
    if (this.qte) this.updateQTE(dt);
    this.shotT += dt;
    if (this.cine) this.poseCast();
    return this.cine && !!this.shotFn;
  }
  // ---- kamera ----
  setShot(st) {
    const g = this.g, car = g.policeCar; this.shotT = 0;
    const L = (x, y, z) => car.localToWorld(V(x, y, z));
    const k = st.kind;
    if (k === 'none') { this.shotFn = null; return; }
    this.shotFn = (cam, t) => {
      let pos, look;
      if (k === 'car') { pos = L(0.6 + Math.sin(t * 0.1) * 0.3, 1.7, 5.2); look = L(0, 1.15, 0); }
      else if (k === 'carIn') { pos = L(0.04 + Math.sin(t * 0.2) * 0.06, 1.36, 2.7 - Math.min(0.2, t * 0.02)); look = L(0, 1.28, -0.1); }
      else if (k === 'carSide') { pos = L(2.9, 1.55, 0.8 - t * 0.05); look = L(0, 1.2, 0); }
      else if (k === 'carTop') { const a = t * 0.12; pos = car.position.clone().add(V(Math.sin(a) * 9, 6.5, Math.cos(a) * 9)); look = car.position.clone().add(V(0, 0.8, 0)); }
      else if (k === 'mirror') { pos = L(-0.3, 1.36, 2.5); look = L(0.42, 1.3, -0.15); }
      else if (k === 'close' && (this.castObj(st.a) || {})._seated) { const h = this.head(st.a), seat = st.a === 'P1' ? 0 : 1, sx = seat === 0 ? 1 : -1; if (!h) return; pos = L(-sx * 0.1, 1.36, 2.45 - Math.min(0.15, t * 0.02)); look = h; }
      else if (k === 'close') { const h = this.head(st.a); const ob = this.castObj(st.a); if (!h || !ob) return; const yaw = ob.root ? ob.root.rotation.y : (ob.yaw || 0); const f = V(Math.sin(yaw), 0, Math.cos(yaw)); const dd = ob._seated ? 0.62 : 1.15; pos = h.clone().addScaledVector(f, dd - Math.min(0.12, t * 0.02)).add(ob._seated ? V(0, 0.04, 0) : V(0.12, 0.02, 0)); look = h; }
      else if (k === 'over') { const a = this.head(st.a), b = this.head(st.b); if (!a || !b) return; const d = b.clone().sub(a).setY(0).normalize(); const side = V(-d.z, 0, d.x); pos = a.clone().addScaledVector(d, -1.1).addScaledVector(side, 0.45).add(V(0, 0.22, 0)); look = b; }
      else if (k === 'wide') { pos = st.a.clone(); look = st.b.clone(); pos.x += Math.sin(t * 0.15) * 0.4; }
      else if (k === 'orbit') { const h = this.head(st.a); if (!h) return; const r = st.b || 3, a = t * 0.25; pos = h.clone().add(V(Math.sin(a) * r, 0.4, Math.cos(a) * r)); look = h; }
      cam.position.copy(pos); cam.lookAt(look); cam.fov = k === 'carIn' ? 40 : k === 'mirror' ? 26 : k === 'close' ? ((this.castObj(st.a) || {})._seated ? 24 : 38) : 48; cam.updateProjectionMatrix();
    };
  }
  applyCamera(cam) { if (this.shotFn) this.shotFn(cam, this.shotT); }
  // sinematikte oyuncu karakterlerini göster; araçtaysa koltuğa oturt
  poseCast() {
    const g = this.g, car = g.policeCar;
    for (const [who, seat] of [['P1', 0], ['P2', 1]]) {
      const a = this.actor(who); if (!a || !a.root) continue;
      if (this.tied === who || (this.captured && who === 'P2')) continue;
      if ((who === 'P1' && this.flags.escort) || (who === 'P2' && this.flags.p2stand)) continue;
      if (a === g.player && !this.shotFn) { a.root.visible = false; continue; }
      a.root.visible = !(this.captured && who === 'P2');
      if (a.inCar && car) {
        const s = SEAT_POS[seat], p = car.localToWorld(V(s[0], -0.13, s[2] - 0.12));
        a.root.position.copy(p); a.root.rotation.y = car.rotation.y; a.root.scale.setScalar(0.78); a._seated = true;
        if (a.char) { a.char.setPose('sit'); a.char.speed = 0; }
        if (a === g.player && a.char) a.char.update(0.016);
      } else if (a === g.player && a.char) { if (a._seated) { a.root.scale.setScalar(1); a._seated = false; } a.root.rotation.y = g.cam.yaw; a.char.setPose(g.player.slot === 1 ? 'holdLow' : 'idle'); a.char.update(0.016); }
    }
    if (this.partner && this.partner.root && this.flags.partnerHidden) this.partner.root.visible = false;
  }
  restoreCast() {
    const p = this.g.player; if (p.root && this.tied !== (this.isLocal('P1') ? 'P1' : 'P2')) p.root.visible = false;
    for (const who of ['P1', 'P2']) { const a = this.actor(who); if (a && a.root && a._seated) { a.root.scale.setScalar(1); a._seated = false; } }
  }
  // ---- ortak oylama ----
  humans() { return 1 + (this.p2Remote() ? 1 : 0); }
  hostVote(st) {
    this.votes = { id: st.id, q: st.q, opts: st.opts, got: {}, round: 1, t: 0, st };
    this.g.netEvt({ k: 'voteOpen', id: st.id, q: st.q, opts: st.opts, round: 1 });
    this.openVoteUI(st.id, st.q, st.opts, 1);
  }
  openVoteUI(id, q, opts, round) { this.g.ui.vote({ q, opts, round, solo: this.humans() === 1 }, (v) => this.castVote(id, v)); }
  castVote(id, v) {
    if (this.host) this.receiveVote(this.isLocal('P1') ? 'P1' : 'P2', id, v);
    else this.g.netAct({ k: 'svote', id, v });
  }
  receiveVote(who, id, v) {
    const V_ = this.votes; if (!V_ || V_.id !== id) return;
    V_.got[who] = v; this.g.netEvt({ k: 'voteState', who }); this.g.ui.voteState(who);
    const need = this.humans();
    if (Object.keys(V_.got).length < need) return;
    const vals = Object.values(V_.got);
    if (vals.every(x => x === vals[0])) this.resolveVote(vals[0]);
    else if (V_.round === 1) { V_.round = 2; V_.got = {}; this.g.netEvt({ k: 'voteOpen', id, q: V_.q + ' — Ortağınla aynı kararı vermelisiniz!', opts: V_.opts, round: 2 }); this.openVoteUI(id, V_.q + ' — Ortağınla aynı kararı vermelisiniz!', V_.opts, 2); }
    else this.resolveVote((V_.opts.find(o => o.fallback) || V_.opts[0]).id);
  }
  resolveVote(v) {
    const V_ = this.votes; this.votes = null;
    this.choices[V_.id] = v; this.g.netEvt({ k: 'choice', id: V_.id, v }); this.g.netEvt({ k: 'voteClose' }); this.g.ui.vote(null);
    const opt = V_.opts.find(o => o.id === v); this.g.ui.toast(`Karar: ${opt ? opt.label : v}`, 'info');
    if (V_.st.then) V_.st.then(this, v);
    if (this.runner) { this.runner.dur = 0.4; this.runner.t = 0; }
  }
  // ---- QTE (refleks) ----
  hostQTE(dur = 1.2) {
    const key = ['KeyQ', 'KeyE', 'KeyF', 'Space'][Math.floor(Math.random() * 4)];
    this.g.netEvt({ k: 'qte', key, dur }); this.startQTE(key, dur);
  }
  startQTE(key, dur) { this.qte = { key, dur, t: 0, done: false }; this.g.ui.qte(key, 1); this.g.audio.sfx('tick'); }
  updateQTE(dt) {
    const q = this.qte; q.t += dt; this.g.ui.qte(q.key, 1 - q.t / q.dur);
    if (!q.done && q.t >= q.dur) this.finishQTE(false);
  }
  qteKey(code) { const q = this.qte; if (!q || q.done) return false; this.finishQTE(code === q.key); return true; }
  finishQTE(ok) {
    const q = this.qte; if (!q || q.done) return; q.done = true; this.qte = null; this.g.ui.qte(null);
    this.g.ui.toast(ok ? 'Refleks başarılı! Önce sen davrandın.' : 'Geç kaldın!', ok ? 'ok' : 'bad');
    if (this.host) this.onQTE(this.isLocal('P1') ? this.g.player : this.g.player, ok);
    else this.g.netAct({ k: 'sqte', ok });
  }
  onQTE(actor, ok) { if (this.qteHandler) this.qteHandler(actor, ok); }
  // ---- bağlı / esir ortak ----
  setTied(on) {
    this.tied = on ? 'P2' : null;
    if (this.isLocal('P2')) { this.g.playerTied = on; this.g.ui.overlayNote(on ? 'Sandalyeye bağlısın. Ortağın seni çözene kadar hareket edemezsin.' : null); }
  }
  setCaptured(on) {
    this.captured = on;
    if (this.isLocal('P2')) { this.g.playerCaptured = on; this.g.ui.blackout(on ? 'Pusuya düştün…' : null, on ? 'Başına sert bir darbe aldın. Ortağın tek başına devam ediyor — bir sonraki bölümde seni bulacak.' : ''); }
  }
  dispose() { if (this.partner) this.partner.dispose(); this.partner = null; if (this.kerem) this.kerem.dispose(); this.kerem = null; if (this.keremGhost) this.keremGhost.dispose(); this.keremGhost = null; this.g.ui.cine(false); this.g.ui.vote(null); this.g.ui.qte(null); this.g.ui.caption(null); this.g.ui.phone(null); this.g.ui.overlayNote(null); this.g.ui.blackout(null); this.g.playerTied = false; this.g.playerCaptured = false; this.g.cineLock = false; }
}

// =====================================================================
// Tek başına oynarken: yapay zekâ ortak (Kerem). Takip eder, tehdit edenlere ateş eder.
export class Partner {
  constructor(g) {
    this.g = g; this.local = false; this.nick = 'Kerem'; this.peer = 'partner';
    const eq = { ...DEFAULT, helmet: 'cap', uniform: 'standard', vest: 'civil', hair: 'Kısa saç', hairColor: 'Kahverengi' };
    this.app = loadoutAppearance(eq, 31); this.app.face = 'Hafif kirli sakal';
    this.char = new Character(this.app); this.root = this.char.root; g.scene.add(this.root);
    this.pos = this.root.position; this.yaw = 0; this.inCar = true; this.mode = 'follow'; this.shootT = 1; this.holdFire = 0;
    this.gun = createWeapon('glock19'); this.char.hold(this.gun); this.hp = 100; this.dead = false; this.slot = 1; this.aiming = false; this.speedNow = 0;
    this.goal = null;
  }
  headWorld() { const v = V(); this.char.head.getWorldPosition(v); return v; }
  update(dt) {
    const g = this.g, p = g.player, w = g.world;
    if (this.mode === 'tied' || this.mode === 'gone') { this.root.visible = this.mode === 'tied'; if (this.mode === 'tied') { this.char.setPose('sit'); this.char.update(dt); } return; }
    this.inCar = p.inCar && this.mode === 'follow';
    if (this.inCar) { if (!g.director || !g.director.cine) this.root.visible = false; return; }
    this.root.visible = true;
    let target = null;
    if (this.mode === 'goto' && this.goal) target = this.goal;
    else { const back = V(Math.sin(p.yaw + 2.5), 0, Math.cos(p.yaw + 2.5)); target = p.pos.clone().addScaledVector(back, 1.7); }
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 12 && this.mode === 'follow') { this.pos.copy(target); }
    const spd = d > 4 ? 5.2 : 3.0;
    if (d > 0.5 && !this.aimT) { this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt); this.pos.x += dx / d * Math.min(d, spd * dt); this.pos.z += dz / d * Math.min(d, spd * dt); this.speedNow = spd; } else this.speedNow = 0;
    w.collide(this.pos, 0.33); this.pos.y = w.heightAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.mode === 'goto') { this.gotoT = (this.gotoT || 0) + dt; if (this.gotoT > 12 && d > 0.8) { this.pos.copy(target); } }
    if (this.mode === 'goto' && d < 0.8 && this.onArrive) { const f = this.onArrive; this.onArrive = null; this.gotoT = 0; f(); }
    // tehdit edenlere ateş
    if (this.holdFire > 0) this.holdFire -= dt;
    this.shootT -= dt; this.aimT = 0;
    let threat = null, bd = 18;
    for (const n of g.npcs) { if (!n.alive || !n.guilty || !n.isThreat) continue; const dd = n.distTo(this.pos); if (dd < bd && w.los(this.pos.clone().add(V(0, 1.5, 0)), n.pos.clone().add(V(0, 1.4, 0)))) { bd = dd; threat = n; } }
    if (threat && this.holdFire <= 0) {
      this.aimT = 1; this.yaw = dampAngle(this.yaw, Math.atan2(threat.pos.x - this.pos.x, threat.pos.z - this.pos.z), 10, dt);
      if (this.shootT <= 0) {
        this.shootT = 0.9 + Math.random() * 0.6;
        const m = this.gun.userData.muzzle ? this.gun.localToWorld(this.gun.userData.muzzle.clone()) : this.pos.clone().add(V(0, 1.4, 0));
        g.fx.muzzle(m); g.audio.sfx('gunshot', this.pos, 0.9); if (g.net.active) g.netEvt({ k: 'sfx', n: 'gunshot', p: [this.pos.x, this.pos.y, this.pos.z], v: 0.9 });
        const hit = Math.random() < 0.42; const end = threat.pos.clone().add(V((Math.random() - 0.5) * (hit ? 0.2 : 1.2), 1.2, 0)); g.fx.tracer(m, end);
        if (hit && !g.isClient) { threat.lastHitBy = 'partner'; threat.takeHit('body', 34, 'partner', end.clone().sub(m)); g.fx.blood(end); }
      }
    }
    this.root.rotation.y = this.yaw;
    this.char.setPose(this.aimT ? 'aim' : 'holdLow'); this.char.speed = this.speedNow; this.char.update(dt);
  }
  damage() { }
  dispose() { this.g.scene.remove(this.root); disposeTree(this.root); }
}

// Ortak oyunda Kerem: liderdeki yapay zekânın istemcideki görüntüsü (anlık görüntüden)
export class KeremGhost {
  constructor(g) {
    this.g = g; const eq = { ...DEFAULT, helmet: 'cap', uniform: 'standard', vest: 'civil', hair: 'Kısa saç', hairColor: 'Kahverengi' };
    const app = loadoutAppearance(eq, 31); app.face = 'Hafif kirli sakal';
    this.char = new Character(app); this.root = this.char.root; g.scene.add(this.root); this.root.visible = false;
    this.char.hold(createWeapon('glock19')); this.tgt = new THREE.Vector3(); this.yaw = 0; this.aim = false; this.spd = 0; this.first = true;
  }
  apply(a) { this.tgt.set(a[0], a[1], a[2]); this.yaw = a[3]; this.root.visible = !!a[4]; this.aim = !!a[5]; this.spd = a[6] || 0; if (this.first) { this.root.position.copy(this.tgt); this.first = false; } }
  update(dt) {
    const p = this.root.position; if (p.distanceTo(this.tgt) > 4) p.copy(this.tgt); else p.lerp(this.tgt, 1 - Math.exp(-12 * dt));
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.yaw, 12, dt);
    this.char.setPose(this.aim ? 'aim' : 'holdLow'); this.char.speed = this.spd; this.char.update(dt);
  }
  dispose() { this.g.scene.remove(this.root); disposeTree(this.root); }
}

// =====================================================================
// Ortak yardımcılar
function prop(s, geo, m, x, y, z, ry = 0) { const o = M(geo, m, x, y, z, 0, ry, 0, s.w.dynamic, true); return o; }
function interact(s, pos, label, fn, o = {}) { const it = { pos, label, radius: o.r || 1.6, enabled: () => !it.used && (!o.when || o.when()), action: () => { if (!o.repeat) it.used = true; fn(); } }; s.w.interact(it); return it; }
function zone(s, pos, r, fn, who = 'any') {
  let fired = false;
  s.tick(() => {
    if (fired) return;
    const pls = s.g.allPlayers().filter(p => !p.inCar && !p.dead);
    if (pls.some(p => Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < r)) { fired = true; fn(); }
  });
}
function gunmen(s, anchors, o = {}) {
  const out = [];
  anchors.forEach((p, i) => {
    const n = s.npc('suspect', p, s.personality({ plan: 'shoot', armed: 'gun', compliance: 0.15, aggression: 0.9, state: o.state || 'idle', look: { hair: s.rng.pick(['Kapüşonlu', 'Bereli', 'Kısa saç', '3 numara kazıtılmış']), top: s.rng.pick(['Deri ceket', 'Kapüşonlu sweatshirt', 'Şişme mont']), topColor: 'Siyah' } }));
    if (o.shotgun) n.weaponMesh = createShotgun();
    n.triggerDist = o.trigger || 9; n.triggered = true; out.push(n); // senaryo tetikleyene kadar pasif
  });
  return out;
}
const ignite = (ns) => ns.forEach((n, i) => { if (n.alive && !n.cuffed && !n.down) { n.triggered = true; n.setState('shoot'); n.shootT = 1.2 + i * 0.5; } });
function clearObj(s, ns, id, text, pts = 30) {
  const ob = s.m.obj(id, text, pts);
  s.tick(() => { if (!ob.done && ns.every(n => !n.alive || n.cuffed || n.down || n.removed)) s.m.done(id); });
  return ob;
}
function womanApp(s) { return s.app({ gender: 'f', hair: 'Uzun saç', hairColor: 'Siyah', face: 'Gözlüklü', top: 'Kaban', topColor: 'Kırmızı', bottom: 'Kumaş pantolon', bottomColor: 'Siyah', skin: 'Beyaz', age: 34 }); }
function noteMesh(s, color = '#f4f1ea') { return M(boxGeo(0.18, 0.005, 0.12), mat(color, { r: 0.8 }), 0, 0, 0, 0, 0, 0, s.w.dynamic, false); }

// =====================================================================
// BÖLÜMLER
export const CHAPTERS = [];
function chapter(o) { o.id = 'st' + o.n; CHAPTERS.push(o); registerCrime(o.id, `Bölüm ${o.n}: ${o.name}`, [o.loc], (s) => o.setup ? o.setup(s, s.g.director) : null, { hidden: true }); }

const introCar = (n, name) => [title(n, name), shot('car'), wait(2.0)];

// ---------------- 1 ----------------
chapter({
  n: 1, name: 'İlk Kıvılcım', loc: 'ikiKatli', tod: 'gece', rain: true, variant: 12,
  intro: [
    ...introCar(1, 'İlk Kıvılcım'),
    cap('Yağmurlu bir gece yarısı. Polis otosu rölantide çalışıyor.'),
    shot('carIn'),
    say('P2', 'Sakin bir gece olacak gibi.'),
    { t: 'phone', on: true, text: 'GİZLİ NUMARA', state: 'Arıyor…', ring: 3, dur: 3.3 },
    shot('mirror'),
    say('P1', '(Kişisel telefonu çalıyor. Ekranda gizli numara yazıyor.)'),
    { t: 'phone', on: true, text: 'GİZLİ NUMARA', state: 'Bağlandı', dur: 0.3 }, sfx('static', 0.8),
    say('phone', '(Cızırtı… derin, ağır bir nefes…)', 3.4), sfx('breath_m', 0.9),
    { t: 'phone', on: false, dur: 0.6 }, sfx('uiback'),
    shot('close', 'P2'), say('P2', 'Kim o?'),
    shot('close', 'P1'), say('P1', 'Kimse. Yanlış numara herhalde.'),
    shot('close', 'P2'), say('P2', 'Gece üçte yanlış numara… Tabii.'),
    shot('carIn'), radio('Merkezden 34-155 ekibine. Gül Sokak\'taki iki katlı müstakil evde gürültü ihbarı. Komşular bağırış ve cam kırılması duymuş.'),
    say('P1', 'Anlaşıldı Merkez, intikal ediyoruz.'),
  ],
  setup(s, D) {
    const m = s.m, h = s.info.house, rng = s.rng;
    m.title = 'Bölüm 1: İlk Kıvılcım';
    s.brief('Gürültü ihbarı — iki katlı müstakil ev.');
    h.doors.front.locked = false; h.doors.front.target = 1; h.doors.front.open = 1; h.doors.back.locked = false; h.doors.back.target = 1; h.doors.back.open = 1;
    // dağınıklık
    const S = h.rooms.salon;
    for (let i = 0; i < 18; i++) prop(s, boxGeo(0.22, 0.01, 0.3), mat('#f4f1ea', { r: 0.8 }), S.x0 + rng.range(0.6, S.x1 - S.x0 - 0.6), h.base + 0.01, S.z0 + rng.range(0.6, S.z1 - S.z0 - 0.6), rng.next() * 3);
    for (let i = 0; i < 3; i++) { const c = prop(s, boxGeo(0.45, 0.45, 0.45), mat('#7a4f2c', { r: 0.7 }), S.x0 + 1.2 + i * 1.3, h.base + 0.22, S.z1 - 1.0, rng.next() * 3); c.rotation.z = 1.4; }
    // delil masası
    const tx = (S.x0 + S.x1) / 2 + 0.6, tz = S.z0 + 1.4;
    s.w.box(1.3, 0.75, 0.8, tx, h.base, tz, mat('#5a3b22', { r: 0.6 }), { small: true, parent: s.w.dynamic });
    const map = prop(s, boxGeo(0.62, 0.006, 0.44), mat(0xffffff, { map: TX.sign('GİZLİ SUÇ HARİTASI', { bg: '#e8dcc0', fg: '#8a1d1d', w: 256, h: 180, glow: false }) }), tx - 0.25, h.base + 0.76, tz, 0.2);
    for (let i = 0; i < 4; i++) prop(s, boxGeo(0.16, 0.03, 0.08), mat('#3a7a4f', { r: 0.6 }), tx + 0.3 + (i % 2) * 0.18, h.base + 0.77 + Math.floor(i / 2) * 0.03, tz - 0.1 + (i % 2) * 0.1, rng.next());
    D.def('takeMap', () => { map.visible = false; });
    // kaçan şüpheli
    const runner = s.npc('suspect', s.a('backyard', 0), s.personality({ plan: 'flee', state: 'idle', look: { hair: 'Kapüşonlu', topColor: 'Siyah' } }));
    runner.fleePath = s.w.escapePath; runner.triggerDist = 30;
    m.obj('enter', 'Eve gir', 10);
    zone(s, V((h.x0 + h.x1) / 2, 0, h.z0 + 1.5), 3.2, () => { m.done('enter'); s.g.toast('Ev darmadağın! Arka kapı açık — biri kaçmış.', 'warn'); if (runner.alive) { runner.triggered = true; runner.startFlee(); } });
    m.obj('money', 'Masadaki sahte paraları incele', 10);
    m.obj('map', 'Şehrin gizli suç haritasını al', 20);
    interact(s, V(tx + 0.3, 0, tz - 0.6), 'Sahte paraları incele', () => { m.done('money'); s.g.toast('Sahte banknotlar — seri numaraları aynı.', 'warn'); });
    interact(s, V(tx - 0.25, 0, tz - 0.6), 'Haritayı al', () => { D.run('takeMap'); m.done('map'); s.g.toast('Harita alındı: şehirdeki sevkiyat noktaları işaretli.', 'info'); });
    m.focus = V((h.x0 + h.x1) / 2, 0, h.z0); m.parTime = 200;
  },
  outro: [
    shot('carIn'), cap('Araca dönülür. Harita katlanıp bir cebe girer.'),
    shot('close', 'P1'), say('P1', '(Haritayı katlayıp sessizce cebine koyar.)'),
    shot('close', 'P2'), say('P2', 'Dur. Ne yapıyorsun? Haritayı neden cebine koydun?'),
    shot('close', 'P1'), say('P1', 'Delil torbası bagajda. Merkeze ben teslim ederim.'),
    shot('close', 'P2'), say('P2', 'Tutanağa geçmeden cebe giren delil… Hiç hoşuma gitmedi.'),
    say('P1', 'Bana güven.'),
    shot('car'), cap('Güvensizliğin ilk tohumu atıldı.', 3.5),
  ],
});

// ---------------- 2 ----------------
chapter({
  n: 2, name: 'Mahalle Baskısı', loc: 'bakkal', tod: 'sabah', rain: false,
  intro: [
    ...introCar(2, 'Mahalle Baskısı'), shot('carIn'),
    cap('Araç hareket halinde. Aradaki gerginlik tırmanıyor.'),
    say('P2', 'O haritayı hâlâ teslim etmedin.'),
    say('P1', 'Fırsat olmadı.'),
    shot('close', 'P2'), say('P2', 'Neden haritayı herkesten gizliyorsun? Yoksa bu işin içinde sen mi varsın?'),
    shot('close', 'P1'), say('P1', 'Saçmalama! Bir daha böyle konuşma benimle.'),
    shot('carIn'), radio('34-155, mahalle bakkalını haraca kesen saldırgan bir şahıs var. Dükkân sahibi tehdit ediliyor.'),
    say('P2', 'Konuşmamız bitmedi.'),
  ],
  setup(s, D) {
    const m = s.m; m.title = 'Bölüm 2: Mahalle Baskısı';
    s.brief('Haraç — mahalle bakkalı.');
    const shop = s.npc('victim', s.a('counter', 0), { state: 'cower', mood: 'scared', look: { age: 58, face: 'Kalın bıyık' } }); shop.flags.cowerT = 999;
    shop.lines.statement = ['Her hafta gelip para istiyor memur bey!', 'Vermezsem dükkânı yakarmış!'];
    const thug = s.npc('suspect', s.a('scene', 0, 0.5), s.personality({ plan: 'fight', armed: 'bat', aggression: 0.85, compliance: 0.3, state: 'argue', look: { hair: '3 numara kazıtılmış', top: 'Deri ceket', topColor: 'Siyah', face: 'Yara izli' } }));
    thug.partner = shop; thug.lookAt = shop.pos; thug.lines.argue = ['Paranı hazırla dedim sana!', 'Bu mahallede benim sözüm geçer!'];
    D.cast.thug = thug; thug.storyName = 'Haraççı';
    s.arrest([thug], 'arrest', 'Haraççıyı etkisiz hale getir ve kelepçele', 40);
    s.statement(shop, 'st', 'Bakkalın ifadesini al', 10, true);
    s.crowd(3);
    let said = false;
    s.tick(() => {
      if (said || !thug.cuffed) return;
      if (thug.distTo(s.g.carPos()) < 7) {
        said = true;
        D.beat('grin', [shot('close', 'thug'), say('thug', '(Sırıtarak) Senin ne mal olduğun dosyada yazıyor zaten, patron.'), shot('close', 'P2'), say('P2', '…Ne dosyası? Ne diyor bu adam?'), shot('close', 'P1'), say('P1', 'Laf atıyor. Takma.')]);
      }
    });
    m.obj('car', 'Şüpheliyi araca götür', 10); s.tick(() => { if (said && !m.getObj('car').done) m.done('car'); });
    m.focus = thug.pos.clone(); m.parTime = 200;
  },
  outro: [
    shot('carIn'), say('P2', 'O adam seni tanıyordu.'),
    say('P1', 'Bu mahallede herkes beni tanır.'),
    shot('close', 'P2'), say('P2', '"Patron" dedi sana. Patron!'),
    shot('close', 'P1'), say('P1', 'Yeter!'),
    shot('car'), cap('Şüphe katlanıyor.'),
  ],
});

// ---------------- 3 ----------------
chapter({
  n: 3, name: 'Çevirme ve İlk Sınav', loc: 'yolCevirmesi', tod: 'ogle', rain: false,
  intro: [
    ...introCar(3, 'Çevirme ve İlk Sınav'), shot('carIn'),
    radio('34-155, otoyol çıkışındaki çevirme noktasına destek verin. Siyah bir SUV\'nin yasadışı sevkiyat taşıdığı ihbar edildi.'),
    say('P2', 'Haritada işaretli yol buydu, değil mi?'),
    say('P1', 'Evet. Sevkiyat rotası.'),
    shot('close', 'P2'), say('P2', 'Bakalım bu sefer neyi cebine atacaksın.'),
  ],
  setup(s, D) {
    const m = s.m; m.title = 'Bölüm 3: Çevirme ve İlk Sınav';
    s.brief('Yol çevirmesi — şüpheli lüks SUV.');
    const p = s.a('vehicle', 0) || s.a('scene', 0);
    const suv = createSUV(); suv.position.set(p.x, 0, p.z); suv.rotation.y = Math.PI / 2; s.w.dynamic.add(suv); s.w.carCollider(p.x, p.z, Math.PI / 2, suv, 5.2, 2.1, 1.9);
    const drv = s.driverFor(suv, { look: { top: 'Takım elbise ceketi', topColor: 'Lacivert', face: 'Temiz tıraşlı', hair: 'Kısa saç', age: 46 }, mood: 'scared', guilty: true, plan: 'comply', compliance: 0.9 });
    drv.storyName = 'Sürücü'; D.cast.drv = drv; drv.lines.statement = ['M-memur bey, acelem var… Toplantıya yetişmem lazım.', 'Bagajda bir şey yok, gerçekten!'];
    s.statement(drv, 'talk', 'Panik halindeki sürücüyle konuş', 10);
    const ry = Math.PI / 2, fwd = V(Math.sin(ry), 0, Math.cos(ry)), side = V(Math.cos(ry), 0, -Math.sin(ry));
    const glove = suv.position.clone().addScaledVector(side, -1.5).addScaledVector(fwd, 0.4);
    const trunk = suv.position.clone().addScaledVector(fwd, -3.0);
    m.obj('glove', 'Aracın içini ara', 10); m.obj('trunk', 'Bagajı ara', 15);
    const crates = []; for (let i = 0; i < 3; i++) { const c = M(rbox(0.6, 0.4, 0.5, 0.03), mat('#4a5233', { r: 0.8 }), 0, 0, 0, 0, 0, 0, suv, true); c.position.set(-0.4 + i * 0.4, 0.95, -1.9); c.visible = false; crates.push(c); }
    D.def('crates', () => crates.forEach(c => { c.visible = true; }));
    interact(s, glove, 'Torpido gözünü ara', () => {
      m.done('glove');
      D.beat('envelope', [shot('close', 'P1'), say('P1', '(Torpidodan çıkan mühürlü bir zarfı sessizce cebine atar.)'), shot('mirror'), say('P2', '(Dikiz aynasından her şeyi net bir şekilde gördü.)'), shot('none')]);
    }, { when: () => m.getObj('talk').done || true });
    interact(s, trunk, 'Bagajı ara', () => {
      m.done('trunk'); D.run('crates'); s.g.toast('Bagajda haritada işaretli yasadışı silah sandıkları!', 'warn');
      D.beat('bribe', [
        shot('close', 'drv'), say('drv', 'Bakın memur beyler… Bu çantada iki yüz bin var. Görmediniz, olur biter.'),
        { t: 'vote', id: 'bribe', q: 'Sürücü rüşvet teklif ediyor. Ortak kararınız?', opts: [{ id: 'reject', label: 'Rüşveti reddet ve tutukla', fallback: true }, { id: 'accept', label: 'Rüşveti kabul et' }], then: (D2, v) => { if (v === 'reject') { drv.guilty = true; drv.setState('surrender'); D2.flags.arrestDrv = true; m.getObj('decide').text = 'Sürücüyü tutukla'; s.g.ui.objectives(m); } else { m.penaltyOnce('bribe', -30, 'Rüşvet alındı'); drv.leaveTo(s.a('escape', 0)); drv.guilty = false; m.done('decide'); } } },
        shot('none'),
      ]);
    });
    m.obj('decide', 'Rüşvet teklifine karar ver', 20);
    s.tick(() => { if (D.flags.arrestDrv && drv.cuffed && !m.getObj('decide').done) m.done('decide'); });
    m.focus = suv.position.clone(); m.parTime = 220;
  },
  outro: (D) => D.choices.bribe === 'accept' ? [
    shot('carIn'), say('P2', 'Parayı aldık…'),
    shot('close', 'P2'), say('P2', 'Ve sen o zarfı da cebine attın. Aynadan gördüm.'),
    shot('close', 'P1'), say('P1', 'Zarfı merkeze götüreceğim.'),
    say('P2', 'Tabii. Haritayı götürdüğün gibi.'),
    shot('car'), cap('Player 2 bir ikilemde: ortağını ihbar mı edecek, susacak mı?'),
  ] : [
    shot('carIn'), say('P2', 'Rüşveti reddettik. Doğrusu buydu.'),
    shot('close', 'P2'), say('P2', 'Ama torpidodan aldığın zarfı gördüm. Aynadan.'),
    shot('close', 'P1'), say('P1', 'Ne zarfı?'),
    say('P2', 'Beni aptal yerine koyma.'),
    shot('car'), cap('Player 2 bir ikilemde: ortağını ihbar mı edecek, susacak mı?'),
  ],
});

// ---------------- 4 ----------------
chapter({
  n: 4, name: 'Çay Bahçesi ve Göz Teması', loc: 'cayBahcesi', tod: 'gunbatimi', rain: false,
  intro: [
    ...introCar(4, 'Çay Bahçesi ve Göz Teması'), shot('carIn'),
    say('P1', 'Kısa bir mola verelim. Bir çay içelim.'),
    say('P2', 'Kafam o kadar dolu ki çay bile iyi gelmez.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 4: Çay Bahçesi ve Göz Teması';
    s.brief('Mola — çay bahçesi.');
    const wp = s.a('crowd', 2);
    const woman = s.npc('bystander', wp, { app: womanApp(s), state: 'sit', compliance: 1 }); woman.storyName = 'Gizemli kadın'; D.cast.woman = woman;
    s.crowd(5, { state: 'sit' });
    const car = s.g.policeCar, notePos = car.localToWorld(V(0, 1.05, 1.55));
    const note = noteMesh(s); note.position.copy(notePos); note.visible = false;
    D.def('note', (on) => { note.visible = !!on; });
    m.obj('note', 'Aracın sileceğine sıkıştırılan notu al', 20);
    m.obj('brawl', 'Kavgayı dağıt ve düzeni sağla', 30);
    let stage = 0, stage1T = 0;
    s.tick(() => {
      if (stage === 0 && m.time > 6 && g.allPlayers().some(p => !p.inCar)) {
        stage = 1;
        D.beat('eyes', [shot('close', 'woman'), say('P2', '(Uzaktaki masada oturan gizemli bir kadınla göz göze gelir.)'), shot('close', 'P2'), wait(1.2), shot('orbit', 'woman', 3.5), cap('Kadın kalkar, polis otosuna doğru yürür…'), shot('none')], () => {
          woman.leaveTo(notePos.clone()); woman.flags.vanish = false; stage1T = m.time;
        });
      }
      if (stage === 1 && stage1T && woman.state !== 'leave' && woman.distTo(notePos) > 2.2) woman.leaveTo(notePos.clone());
      if (stage === 1 && stage1T && m.time - stage1T > 16 && woman.distTo(notePos) > 2.2) { const c = s.g.policeCar; woman.pos.copy(c.localToWorld(V(-1.2, 0, 3.2))); woman.pos.y = 0; } // takıldıysa
      if (stage === 1 && woman.distTo(notePos) < 2.2) { stage = 2; D.run('note', true); g.toast('Kadın sileceklere bir not sıkıştırdı ve uzaklaşıyor!', 'warn'); woman.leaveTo(s.a('escape', 0)); woman.flags.vanish = true; }
    });
    const fighters = [];
    interact(s, notePos.clone().setY(0), 'Notu al', () => {
      D.run('note', false); m.done('note');
      D.beat('read', [
        act(() => g.ui.paper('GİZLİ HESAP DÖKÜMÜ', `Hesap sahibi: ${D.nameOf('P1').toLocaleUpperCase('tr-TR')}\nTR34 0006 2211 0457 9932\nBakiye: 4.750.000 ₺\nSon giriş: "Sevkiyat — Gül Sk."\n\n"Ortağın sandığın kişi değil. Onu sat, kurtul."`), true),
        shot('close', 'P2'), say('P2', '(Notu okur. Yüzü bembeyaz olur.)'),
        say('P2', 'Bu… senin adına açılmış gizli bir hesap.'),
        shot('close', 'P1'), say('P1', 'Ne?! Ver şunu bana!'),
        shot('close', 'P2'), say('P2', '(Kadın beni ona karşı kullanmaya çalışıyor… Ya da gerçeği söylüyor.)'),
        act(() => g.ui.paper(null), true), sfx('glass'),
        cap('Tam o sırada bahçede sandalyeler havada uçuşmaya başlar!'), shot('none'),
      ], () => {
        for (const n of fighters) { n.setState('fight'); n.triggered = false; } D.flags.brawlT = m.time;
      });
      if (!fighters.length) {
        const c = s.a('scene', 0);
        for (let i = 0; i < 4; i++) { const f = s.npc('suspect', c.clone().add(V(i % 2 ? 0.9 : -0.9, 0, Math.floor(i / 2) * 1.6)), s.personality({ plan: s.rng.pick(['comply', 'fight', 'comply']), state: 'idle', aggression: 0.7 })); fighters.push(f); }
        fighters[0].partner = fighters[1]; fighters[1].partner = fighters[0]; fighters[2].partner = fighters[3]; fighters[3].partner = fighters[2];
      }
    }, { when: () => note.visible });
    s.tick(() => { if (D.flags.brawlT && m.time - D.flags.brawlT > 3 && !m.getObj('brawl').done && fighters.every(f => !f.alive || f.cuffed || f.down || ['surrender', 'leave', 'idle', 'flee', 'cower', 'handsUp'].includes(f.state) || f.removed)) m.done('brawl'); });
    // uçan sandalyeler
    s.tick((dt) => { if (fighters.some(f => f.state === 'fight') && Math.random() < dt * 0.5) { const f = fighters[Math.floor(Math.random() * fighters.length)]; s.g.fx.blood && s.g.sfx('punch', f.pos, 0.8); } });
    m.focus = s.a('scene', 0); m.parTime = 240;
  },
  outro: [
    shot('carIn'), say('P1', 'O kadını tanımıyorum.'),
    shot('close', 'P2'), say('P2', 'Ama o seni tanıyor. Hesabını da.'),
    shot('close', 'P1'), say('P1', 'Biri bana tuzak kuruyor, görmüyor musun?'),
    say('P2', 'Gördüğüm tek şey var: her gün yeni bir sır.'),
    shot('car'), cap('Kadın, Player 2\'yi ortağına karşı çevirmeye çalışıyor.'),
  ],
});

// ---------------- 5 ----------------
chapter({
  n: 5, name: 'Sahte Teslimiyet Matbaası', loc: 'rezidans', tod: 'sabah', rain: false, variant: 8,
  intro: [
    ...introCar(5, 'Sahte Teslimiyet Matbaası'), shot('carIn'),
    radio('Notta yazan adres doğrulandı: Panorama Residence. Sahte para matbaası şüphesi. Arama kararı çıktı, kapıyı kırabilirsiniz.'),
    say('P2', 'Önden sen gir.'),
    say('P1', 'Neden?'),
    shot('close', 'P2'), say('P2', 'Çünkü sırtımı sana dönmek istemiyorum.'),
    cap('Player 2\'nin eli artık sürekli silahında.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g, h = s.info.house; m.title = 'Bölüm 5: Sahte Teslimiyet Matbaası';
    s.brief('Baskın — sahte para matbaası.'); h.doors.front.locked = true;
    // matbaa
    const S = h.rooms.salon, cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2;
    s.w.box(1.6, 1.1, 0.9, cx - 1.0, h.base, cz + 0.6, mat('#3a3f47', { m: 0.6, r: 0.4 }), { small: true });
    s.w.box(1.2, 0.8, 0.8, cx + 1.2, h.base, cz + 0.6, mat('#2b2e33', { m: 0.6 }), { small: true });
    for (let i = 0; i < 8; i++) prop(s, boxGeo(0.3, 0.06 + (i % 3) * 0.04, 0.15), mat('#3a7a4f', { r: 0.6 }), cx - 1.4 + (i % 4) * 0.25, h.base + 1.12 + (i % 3) * 0.02, cz + 0.4 + Math.floor(i / 4) * 0.2, 0);
    const sus = [];
    for (let i = 0; i < 3; i++) {
      const n = s.npc('suspect', V(cx - 1.2 + i * 1.2, h.base, cz - 0.6), s.personality({ plan: 'shoot', armed: 'gun', compliance: 0.1, aggression: 0.9, state: 'surrender', look: { top: 'Gömlek', topColor: s.rng.pick(['Beyaz', 'Gri', 'Mavi']) } }));
      n.weaponMesh = createShotgun(); n.triggered = true; n.flags.fake = true; n.lines.excuse = ['Biz bir şey yapmadık! Ağlıyorum bakın!']; sus.push(n);
    }
    sus.forEach((n, i) => { n.storyName = 'Şüpheli'; D.cast['s' + i] = n; });
    let sprung = false;
    s.tick(() => {
      if (!sprung) for (const n of sus) if (n.state !== 'surrender' && n.alive && !n.cuffed) n.setState('surrender');
      if (sprung) return;
      if (g.allPlayers().some(p => !p.inCar && sus.some(n => n.distTo(p.pos) < 3.4 && Math.abs(n.pos.y - p.pos.y) < 1.5))) {
        sprung = true;
        for (const n of sus) n.say(s.rng.pick(['Biz bir şey yapmadık!', 'Lütfen ateş etmeyin!', 'Teslim oluyoruz!']));
        D.beat('fake', [shot('close', 's0'), say('s0', '(Ağlayarak) Biz bir şey yapmadık… yemin ederim…'), say('s0', 'ŞİMDİ!', 1.0), shot('none'), act(() => {
          D.qteHandler = (actor, ok) => { const tgt = sus.filter(n => n.alive && !n.cuffed && !n.down).sort((a, b) => a.distTo(actor.pos) - b.distTo(actor.pos))[0]; if (ok && tgt) { tgt.lastHitBy = 'player'; tgt.takeHit('body', 70, 'bullet'); } else if (!ok && actor.damage) actor.damage(40); };
          for (const n of sus) { n.flags.fake = false; n.setState('shoot'); n.shootT = 1.3; }
          D.hostQTE(1.15);
        })]);
      }
    });
    m.obj('enter', 'Kapıyı kır ve daireye gir', 10);
    s.tick(() => { if (!m.getObj('enter').done && g.allPlayers().some(p => h.inside(p.pos))) m.done('enter'); });
    clearObj(s, sus, 'clear', 'Silahlı şüphelileri etkisiz hale getir', 40);
    m.obj('press', 'Matbaayı ve sahte paraları belgele', 15);
    interact(s, V(cx - 1.0, h.base, cz - 0.1), 'Matbaayı belgele', () => { m.done('press'); g.toast('Baskı kalıpları ve 3 milyon ₺ sahte banknot belgelendi.', 'info'); }, { when: () => sprung });
    m.focus = V(cx, h.base, cz); m.parTime = 230;
  },
  outro: [
    shot('carIn'), say('P1', 'İyi misin?'),
    shot('close', 'P2'), say('P2', 'Elim tetikteydi. Silahı sana mı, onlara mı doğrultacağımı bilemedim.'),
    shot('close', 'P1'), say('P1', '…'),
    radio('34-155, matbaadan kaçan bir şüpheli var. Aracı sanayi yönünde görüldü.'),
    shot('car'), cap('Kaçan bir adam var.'),
  ],
});

// ---------------- 6 ----------------
chapter({
  n: 6, name: 'Sanayi Ateşi', loc: 'sanayi', tod: 'aksam', rain: true,
  intro: [
    ...introCar(6, 'Sanayi Ateşi'), shot('carIn'),
    radio('Matbaadan kaçan şüphelinin aracı sanayi sitesinde terk edilmiş halde bulundu. Dikkatli olun.'),
    say('P2', 'Bu sefer önden ben gideceğim.'),
    say('P1', 'Nasıl istersen.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 6: Sanayi Ateşi';
    s.brief('Terk edilmiş araç — sanayi sitesi.');
    const van = s.vehicleAt('scene', 'van', 0.4);
    const anchors = [s.a('hide', 0), s.a('hide', 1), s.a('crowd', 0), s.a('crowd', 2)].map(p => p.clone().add(V(s.rng.range(-1, 1), 0, s.rng.range(-1, 1))));
    const gm = gunmen(s, anchors, { trigger: 0.1 }); gm.forEach(n => { n.setState('hide'); });
    m.obj('inspect', 'Terk edilmiş aracı incele', 10);
    interact(s, van.position.clone(), 'Aracı incele', () => {
      m.done('inspect'); g.toast('Araçta kan izleri ve boş şarjörler… Karanlık köşelerden ateş açılıyor!', 'bad');
      ignite(gm);
      if (D.partner) D.partner.holdFire = 6;
      D.beat('ambush', [say('P2', 'Bizi bekliyorlardı! Burada olacağımızı kim bildi?!'), say('P2', 'Sen önden git dedim, sana ateş etmiyorlar!'), say('P1', 'Kafayı mı yedin?! Siper al!')], null, { cine: false });
    }, { r: 2.6 });
    clearObj(s, gm, 'clear', 'Pusudaki silahlı adamları etkisiz hale getir', 40);
    m.focus = van.position.clone(); m.parTime = 240;
  },
  outro: [
    shot('carIn'), sfx('punch'),
    shot('close', 'P2'), say('P2', 'KİMİNLE ÇALIŞIYORSUN SEN?!'),
    shot('close', 'P1'), say('P1', 'Kimseyle! Aklını mı kaçırdın?!'),
    shot('close', 'P2'), say('P2', 'Matbaada seni vurmadılar! Burada bizi bekliyorlardı! Kim haber verdi?!'),
    shot('close', 'P1'), say('P1', 'Az önce senin için kurşunların önüne atladım!'),
    shot('close', 'P2'), say('P2', 'Belki de rol yapıyorsun!'),
    shot('carIn'), say('P1', '…Bitti mi?'), say('P2', 'Daha başlamadı.'),
  ],
});

// ---------------- 7 ----------------
chapter({
  n: 7, name: 'İstasyon Kargaşası', loc: 'metroIstasyonu', tod: 'sabah', rain: false,
  intro: [
    ...introCar(7, 'İstasyon Kargaşası'), shot('carIn'),
    radio('Tüm ekiplere: kaçan kurye Kadıköy metro istasyonuna girdi. Kalabalık var, ateşli silah kullanmayın!'),
    say('P2', 'Sırtımı kollayacak mısın?'),
    say('P1', 'Her zaman kolladım.'),
    cap('Aralarındaki soğuk savaş tırmanmış durumda.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 7: İstasyon Kargaşası';
    s.brief('Kaçan kurye — metro istasyonu.');
    const crowd = s.crowd(15, { wander: 2 });
    const cour = s.npc('suspect', s.a('scene', 1), s.personality({ plan: 'flee', compliance: 0.4, aggression: 0.3, prop: 'phone', items: ['Mühürlü kurye çantası'], look: { hair: 'Kapüşonlu', top: 'Kapüşonlu sweatshirt', topColor: 'Turuncu' } }));
    cour.triggerDist = 7; cour.storyName = 'Kurye'; D.cast.cour = cour;
    const bag = createBag('#1b1c1f'); cour.char.hold(bag);
    s.arrest([cour], 'arrest', 'Kuryeyi sivillere zarar vermeden etkisiz hale getir', 45);
    m.obj('civ', 'Hiçbir sivil zarar görmesin', 15, { optional: true });
    m.on('fired', () => m.penaltyOnce('crowdFire', -15, 'Kalabalıkta ateş açıldı'));
    s.tick(() => { if (!m.getObj('civ').done && m.getObj('arrest').done && crowd.every(c => c.alive && !c.flags.shotByPlayer)) m.done('civ'); });
    let said = false;
    s.tick(() => {
      if (said || !(cour.cuffed || cour.down)) return; said = true;
      D.beat('whisper', [shot('close', 'cour'), say('cour', '(Fısıldayarak) Büyük patron senin dosyanı çoktan hazırladı, polis bey.'), shot('close', 'P1'), wait(1.2), shot('close', 'P2'), say('P2', 'Ne fısıldadı sana?'), say('P1', 'Hiçbir şey.')]);
    });
    m.focus = cour.pos.clone(); m.parTime = 200;
  },
  outro: [
    shot('carIn'), say('P2', '"Hiçbir şey" dedin. Dudaklarını okudum: "Dosyan hazır" dedi.'),
    shot('close', 'P1'), say('P1', 'Biri beni mi hedef alıyor, yoksa sen mi?'),
    shot('car'), cap('Birbirlerini kollamakta zorlanıyorlar.'),
  ],
});

// ---------------- 8 ----------------
chapter({
  n: 8, name: 'Yolların Ayrıldığı Gece', loc: 'kiraathane', tod: 'gece', rain: true,
  intro: [
    ...introCar(8, 'Yolların Ayrıldığı Gece'), shot('carIn'),
    radio('34-155, kıraathanede kalabalık bir grubun gürültü yaptığı ve kumar oynandığı ihbarı var.'),
    say('P1', 'Hadi bitirelim şunu.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 8: Yolların Ayrıldığı Gece';
    s.brief('Gürültü ve kumar — kıraathane.');
    const gamblers = []; for (let i = 0; i < 3; i++) { const n = s.npc('suspect', s.a('inside', 0, 1.2), s.personality({ plan: 'comply', state: 'sit', compliance: 0.8 })); n.lines.excuse = ['Okey oynuyoruz memur bey, ne var?']; gamblers.push(n); }
    s.crowd(4);
    const alley = V(34, 0, -1.5);
    const mk = M(cyl(0.8, 0.8, 0.05, 20), ownMat('#000', { e: '#ffb020', ei: 1.5, t: true, op: 0.5 }), alley.x, 0.05, alley.z, 0, 0, 0, s.w.dynamic, false); mk.visible = false;
    D.def('alleyMark', (on) => { mk.visible = !!on; });
    m.obj('gamble', 'Kumar masasını dağıt', 25);
    interact(s, s.a('inside', 0), 'Kumar masasını dağıt', () => { m.done('gamble'); gamblers.forEach(n => { n.setState('idle'); n.leaveTo(n.awayPoint(10)); }); g.toast('Kumar masası dağıtıldı, paralara el konuldu.', 'ok'); }, { r: 2.2 });
    m.obj('split', 'Telsiz: ekibi böl', 0, { hidden: true });
    let stage = 0;
    s.tick(() => {
      if (stage === 0 && m.time > 18 && g.allPlayers().some(p => !p.inCar)) {
        stage = 1;
        D.beat('split', [radio('Merkezden 34-155: yakın sokakta şüpheli hareketlilik var. Ekibi bölün; biriniz ara sokağı kontrol etsin.'), say('P2', 'Ben bakarım. Sen ana caddede kal.'), say('P2', '(Gitmeden önce temkinli bir şekilde bakar.) …Dikkatli ol.'), say('P1', 'Sen de.')], () => {
          D.run('alleyMark', true);
          if (D.partner) { D.partner.mode = 'goto'; D.partner.goal = alley.clone(); D.partner.onArrive = () => { stage = 2; }; }
          else g.toast('Player 2: ara sokağı kontrol et (turuncu işaret).', 'info');
        }, { cine: false });
      }
      if (stage === 1 && !D.partner) { const r = D.p2Remote(); if (r && Math.hypot(r.pos.x - alley.x, r.pos.z - alley.z) < 3) stage = 2; if (!r) stage = 2; }
      if (stage === 2) {
        stage = 3; D.run('alleyMark', false);
        g.sfx('scream_m', alley, 1); g.audio.sfx('static');
        D.beat('ambush', [radio('(Boğuk bir çığlık, boğuşma sesleri) — Pusuya düştüm! Yardı—'), sfx('static'), cap('Telsiz sustu.'), act(() => { if (D.partner) { D.partner.mode = 'gone'; } else { g.netEvt({ k: 'captured', on: true }); D.setCaptured(true); } })], () => { m.done('split'); m.obj('radio', 'Ortağını bul — araca dön ve sinyali takip et', 10); m.done('radio'); }, { cine: false });
      }
    });
    m.focus = s.a('inside', 0); m.parTime = 260;
  },
  outro: [
    shot('carIn'), act(D => { D.flags.partnerHidden = true; }, true),
    radio('34-155, durum bildirin! 34-155!'),
    say('P1', 'Ortağım… Ortağımı kaybettim. Sinyal en son ara sokaktan geldi.'),
    radio('Telsiz sinyali kuzeydeki metruk binada sabitlendi.'),
    shot('close', 'P1'), say('P1', 'Geliyorum.'),
  ],
});

// ---------------- 9 ----------------
chapter({
  n: 9, name: 'Metruk Binada Yüzleşme', loc: 'metrukBina', tod: 'gece', rain: true, tiedP2: true,
  intro: [
    ...introCar(9, 'Metruk Binada Yüzleşme'), shot('carIn'),
    say('P1', 'Dayan ortak…'),
    cap('Player 1, telsiz sinyalini takip ederek metruk binaya ulaşır.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 9: Metruk Binada Yüzleşme';
    s.brief('Kayıp ortak — metruk bina.');
    const chair = s.a('chair', 0);
    const woman = s.npc('bystander', s.a('woman', 0), { app: womanApp(s), state: 'idle', compliance: 1 }); woman.storyName = 'Gizemli kadın'; D.cast.woman = woman; woman.lookAt = chair;
    const gm = gunmen(s, [s.a('gang', 0), s.a('gang', 1), s.a('gang', 2), s.a('gang', 3)], { trigger: 0.1 });
    m.obj('find', 'Binaya gir ve ortağını bul', 10);
    zone(s, s.a('inside', 0), 4.5, () => {
      m.done('find');
      D.beat('wink', [shot('close', 'woman'), say('woman', 'Geç kaldın.'), cap('Kadın kaçarken Player 1\'e göz kırpar.'), shot('close', 'P2'), say('P2', '(Kadının ortağına göz kırptığını gördü. Kesin kanıt bu.)'), shot('none')], () => {
        woman.leaveTo(s.a('backExit', 0)); woman.flags.vanish = true; ignite(gm);
      });
    });
    clearObj(s, gm, 'gang', 'Çete üyelerini etkisiz hale getir', 40);
    m.obj('untie', 'Ortağını çöz', 20);
    interact(s, chair.clone(), 'Ortağını çöz', () => {
      m.done('untie');
      D.beat('aim', [
        act(() => { D.setTied(false); g.netEvt({ k: 'tie', on: false }); if (D.partner) { D.partner.mode = 'follow'; } }),
        shot('over', 'P1', 'P2'), say('P2', 'Beni sen sattın, di mi?!'),
        cap('Player 2 silahını Player 1\'e doğrultur.'),
        shot('close', 'P1'), say('P1', 'Hayır! O kadını ikinci kez görüyorum!'),
        shot('close', 'P2'), say('P2', 'Sana göz kırptı! Gördüm!'),
        shot('close', 'P1'), say('P1', 'İndir şu silahı. Buradan birlikte çıkacağız.'),
        shot('close', 'P2'), say('P2', '(Silahını yavaşça indirir.) …Son kez.'),
      ]);
    }, { r: 1.6, when: () => m.getObj('gang').done });
    m.focus = chair; m.parTime = 240;
  },
  outro: [
    shot('carIn'), cap('Araçta tek kelime edilmiyor.'),
    say('P1', 'Teşekkür etmen gerekmiyor.'),
    shot('close', 'P2'), say('P2', 'Etmeyecektim zaten.'),
  ],
});

// ---------------- 10 ----------------
chapter({
  n: 10, name: 'Tekel Bayi Alarmı', loc: 'tekel', tod: 'gece', rain: false,
  intro: [
    ...introCar(10, 'Tekel Bayi Alarmı'), shot('carIn'),
    radio('34-155, gece yarısı camı kırılan bir tekel bayii var. Alarm çalıyor.'),
    say('P1', '(…)', 2.0), say('P2', '(…)', 2.0),
    cap('Güvensizlik zirvede. Konuşmadan, birbirlerinin gözünü üstünden ayırmadan çalışırlar.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 10: Tekel Bayi Alarmı';
    s.brief('Hırsızlık — tekel bayii.');
    g.audio.loop('alarm', true, { vol: 0.25 });
    for (let i = 0; i < 20; i++) { const p = s.a('scene', 0, 1.8); prop(s, boxGeo(0.12, 0.01, 0.08), mat('#bfe3f2', { r: 0.05, m: 0.3, t: true, op: 0.6 }), p.x, 0.01, p.z, Math.random() * 3); }
    const thief = s.npc('suspect', s.a('hide', 0), s.personality({ plan: s.rng.pick(['comply', 'flee', 'fight']), state: 'hide', items: itemsStolen() }));
    s.arrest([thief], 'arrest', 'Hırsızı bul ve gözaltına al', 35);
    const ev = [['cam', 'Kırık cam parçalarını topla', s.a('scene', 0)], ['kamera', 'Güvenlik kamerası kaydını al', s.a('counter', 0) || s.a('inside', 0)], ['iz', 'Ayak izlerini belgele', s.a('scene', 0).add(V(2, 0, 1))]];
    for (const [id, text, p] of ev) { m.obj(id, text, 10); interact(s, p, text, () => { m.done(id); if (id === 'kamera') g.toast('Kayıtta hırsız, kaçmadan önce kameraya bakıp duruyor…', 'warn'); }); }
    m.on('cuffed', () => g.audio.loop('alarm', false));
    m.focus = s.a('scene', 0); m.parTime = 220;
  },
  outro: [
    act(D => D.g.audio.loop('alarm', false), true),
    shot('carIn'), say('P2', 'Kamera kaydını izledim. Hırsız seni görünce durdu. Sana baktı.'),
    say('P1', 'Herkes polise bakar.'),
    shot('close', 'P2'), say('P2', 'Belki.'),
  ],
});
function itemsStolen() { return ['Çalıntı sigara kartonları', 'Kasadaki nakit (3.400 ₺)']; }

// ---------------- 11 ----------------
chapter({
  n: 11, name: 'Otopark Savaşları', loc: 'katliOtopark', tod: 'sabah', rain: false,
  intro: [
    ...introCar(11, 'Otopark Savaşları'), shot('carIn'),
    radio('Çetenin para sevkiyatının katlı otoparkta el değiştireceği bilgisi geldi. Destek yolda; beklemeden müdahale edin.'),
    say('P1', 'Bu iş bugün bitecek.'),
    say('P2', 'Hangimiz için?'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 11: Otopark Savaşları';
    s.brief('Para sevkiyatı — katlı otopark.');
    const woman = s.npc('bystander', s.a('woman', 0), { app: womanApp(s), state: 'idle', compliance: 1 }); woman.storyName = 'Gizemli kadın'; D.cast.woman = woman;
    const wc = createCivilianCar(s.rng); const wcp = s.a('womanCar', 0); wc.position.set(wcp.x, 0, wcp.z); wc.rotation.y = Math.PI; s.w.dynamic.add(wc);
    const gm = gunmen(s, [0, 1, 2, 3, 4, 5].map(i => s.a('gang', i)), { trigger: 0.1 });
    let drive = 0; D.def('drive', () => { drive = 1; });
    s.w.updaters.push((dt) => { if (drive) { drive += dt; wc.position.z -= dt * Math.min(9, drive * 4); wc.visible = wc.position.z > -40; } });
    let met = false;
    s.tick(() => {
      if (met) return;
      const p2 = D.actor('P2'); if (!p2 || p2.inCar) return;
      if (woman.distTo(p2.pos) < 9 || m.time > 25) {
        met = true; woman.faceTo(p2.pos);
        D.beat('whisper', [shot('over', 'woman', 'P2'), say('woman', '(Player 2\'ye fısıldar) Onu korumaktan vazgeç. Seni harcayacak.'), shot('close', 'P2'), say('P2', '(Kafası tamamen karışmıştır.)'), shot('none')], () => {
          woman.remove(); D.run('drive'); ignite(gm);
        });
      }
    });
    clearObj(s, gm, 'gang', 'Kolonlar arasındaki silahlı çeteyi etkisiz hale getir', 40);
    m.obj('cargo', 'Para sevkiyatını ele geçir', 20);
    interact(s, s.a('truck', 0), 'Sevkiyatı ele geçir', () => { m.done('cargo'); g.toast('Tırda 18 milyon ₺ nakit ve sevkiyat defteri ele geçirildi.', 'ok'); }, { r: 2.4, when: () => m.getObj('gang').done });
    m.focus = s.a('truck', 0); m.parTime = 260;
  },
  outro: [
    shot('carIn'), say('P1', 'O kadın sana ne dedi?'),
    shot('close', 'P2'), say('P2', 'Seni korumaktan vazgeçmemi.'),
    say('P1', 'Ve?'),
    say('P2', 'Bilmiyorum artık. Hiçbir şeyi bilmiyorum.'),
  ],
});

// ---------------- 12 ----------------
chapter({
  n: 12, name: 'Hastane Koridorundaki Gerçek', loc: 'hastane', tod: 'sabah', rain: false,
  intro: [
    ...introCar(12, 'Hastane Koridorundaki Gerçek'), shot('carIn'),
    radio('Yaralı şüpheliler acil servise getirildi. İfadeleri için koridorda bekleyin.'),
    say('P2', 'Uyumayalı otuz saat oldu.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g; m.title = 'Bölüm 12: Hastane Koridorundaki Gerçek';
    s.brief('Bekleme — hastane acil servisi.');
    const bp = s.a('inside', 0) || s.a('scene', 0);
    const boss = s.npc('bystander', bp, { app: s.app({ gender: 'm', age: 56, hair: 'Kısa saç', hairColor: 'Kırlaşmış', face: 'Kalın bıyık', top: 'Takım elbise ceketi', topColor: 'Antrasit', bottom: 'Kumaş pantolon', bottomColor: 'Siyah' }), state: 'idle', prop: 'phone' });
    boss.flags.phone = true; boss.setState('idle'); boss.storyName = 'Başkomiser'; D.cast.boss = boss;
    for (let i = 0; i < 2; i++) s.npc('bystander', bp.clone().add(V(1.2 + i * 0.8, 0, 0.8)), { look: { top: 'Gömlek', topColor: 'Beyaz' } });
    s.crowd(3);
    m.obj('wait', 'Acil servis koridorunda bekle', 10);
    m.obj('truth', 'Gerçeği öğren', 30);
    zone(s, bp, 6.5, () => {
      m.done('wait');
      D.beat('call', [
        shot('close', 'boss'), say('boss', '(Telefonda) Evet. Suçları yeni polisin üzerine yıkıyoruz. Dosyayı kapatın.'),
        say('boss', 'Ortağı mı? O zaten ona inanmıyor. Gerekirse o da halledilir.'),
        shot('close', 'P2'), say('P2', '(Kulak misafiri olur. Her şey yerine oturur.)'),
        say('P2', 'Sen… masumsun. Seni sistem seçmiş.'),
        shot('over', 'P2', 'P1'), say('P1', 'Sana söylemiştim.'),
        say('P2', 'Özür dilerim. Gerçekten.'),
        say('P1', 'Şimdi ikimiz de hedefteyiz.'),
        say('P2', 'O zaman sonuna kadar birlikte gideriz.'),
        cap('Ortaklık yeniden mühürlendi.'), shot('none'),
      ], () => { m.done('truth'); boss.leaveTo(s.a('escape', 0)); boss.flags.vanish = true; });
    });
    m.focus = bp.clone(); m.parTime = 200;
  },
  outro: [
    shot('carIn'), say('P2', 'Haritadaki son nokta… Sahildeki villa.'),
    say('P1', 'Başkomiserin villası.'),
    shot('close', 'P2'), say('P2', 'Merkeze haber vermiyoruz. Kime güveneceğimizi bilmiyoruz.'),
    say('P1', 'Sadece birbirimize.'),
  ],
});

// ---------------- 13 ----------------
chapter({
  n: 13, name: 'Malikane ve Son Seçim', loc: 'villa', tod: 'gece', rain: true, variant: 21,
  intro: [
    ...introCar(13, 'Malikane ve Son Seçim'), shot('carIn'),
    cap('Haritanın ve delillerin işaret ettiği son adres: lüks bir villa.'),
    say('P1', 'Hazır mısın?'),
    say('P2', 'Seninle? Evet.'),
  ],
  setup(s, D) {
    const m = s.m, g = s.g, h = s.info.house; m.title = 'Bölüm 13: Malikane ve Son Seçim';
    s.brief('Operasyon — villa.'); h.doors.front.locked = false;
    const sal = s.a('salon', 0);
    const boss = s.npc('suspect', sal, s.personality({ plan: 'shoot', armed: 'gun', compliance: 0.1, aggression: 0.8, state: 'idle', look: { gender: 'm', age: 56, hair: 'Kısa saç', hairColor: 'Kırlaşmış', face: 'Kalın bıyık', top: 'Takım elbise ceketi', topColor: 'Antrasit' } }));
    boss.storyName = 'Başkomiser (Asıl Patron)'; D.cast.boss = boss; boss.hp = 220;
    const men = gunmen(s, [0, 1, 2, 3].map(i => sal.clone().add(V([-1.6, 1.6, -2.4, 2.4][i], 0, [0.8, 0.8, -0.6, -0.6][i]))), { trigger: 0.1 });
    men.forEach(n => n.setState('idle'));
    const bag = createBag('#1b1c1f'); bag.position.copy(sal).add(V(0.6, 0.75, 0.6)); s.w.dynamic.add(bag);
    m.obj('enter', 'Villaya gir', 10);
    m.obj('decide', 'Son seçimi yap', 20);
    zone(s, sal, 4.5, () => {
      m.done('enter');
      D.beat('offer', [
        shot('orbit', 'boss', 4), say('boss', 'Hoş geldiniz beyler. Silahlarınızı indirin. Kimse kahraman olmasın.'),
        say('boss', '(Masaya bir çanta para koyar.)'),
        shot('close', 'boss'), say('boss', 'Dosya senin üzerine yıkıldı zaten. Kabul et, paranı al… ya da ikiniz de burada gömülün!'),
        { t: 'vote', id: 'final', q: 'Köşeye sıkıştınız. Son kararınız?', opts: [{ id: 'blame', label: 'Player 1 suçu üstlenir, ortağını kurtarır' }, { id: 'fight', label: 'Birlikte patrona karşı son saldırı', fallback: true }] },
      ], () => {
        if (D.choices.final === 'blame') {
          D.beat('blame', [shot('close', 'P1'), say('P1', 'Tamam. Suç benim. Onu bırak.'), shot('close', 'P2'), say('P2', 'Hayır! Yapma bunu!'), shot('close', 'boss'), say('boss', 'Akıllı çocuk.'), fade(true, 1.5)], () => { m.done('decide'); men.forEach(n => n.remove()); boss.remove(); m.objectives.forEach(o => { if (!o.optional && !o.done) o.done = true; }); s.g.ui.fade(false, 600); s.g.finishMission(true); });
        } else {
          D.beat('fight', [shot('close', 'P1'), say('P1', 'Ortağımı satmam.'), shot('close', 'P2'), say('P2', 'Ben de seni!'), shot('none')], () => { m.done('decide'); ignite([boss, ...men]); });
        }
      });
    });
    const ob = m.obj('boss', 'Patronu ve adamlarını etkisiz hale getir', 40);
    s.tick(() => { if (D.choices.final === 'fight' && !ob.done && [boss, ...men].every(n => !n.alive || n.cuffed || n.down || n.removed)) m.done('boss'); if (D.choices.final === 'blame' && !ob.done) ob.done = true; });
    m.focus = h.rooms ? V((h.x0 + h.x1) / 2, 0, h.z0) : sal; m.parTime = 260;
  },
  outro: (D) => D.choices.final === 'fight' ? [
    shot('carIn'), say('P2', 'Bitti mi?'), say('P1', 'Bitti.'),
    radio('34-155… Merkez dinliyor. Başkomiserin dosyası açıldı. Garaja dönün.'),
  ] : [],
});

// ---------------- 14 ----------------
chapter({
  n: 14, name: 'Son Vardiya', loc: 'polisGaraji', tod: 'sabah', rain: false, cineOnly: true,
  intro: (D) => {
    const blame = D.choices.final === 'blame';
    const common = [title(14, 'Son Vardiya'), shot('wide', V(0, 2.4, -6), V(0, 1.2, 3)), cap('Sabaha karşı. Polis merkezinin garajı.')];
    if (blame) return [...common,
      act(D2 => D2.endingA(), true),
      shot('wide', V(-4, 1.7, 7), V(1, 1.2, 1)), cap('Player 1 kelepçelenip başka bir ekibe teslim ediliyor.'),
      say('officer', 'Yürü.'),
      shot('close', 'P2'), say('P2', '(Arkasından üzgün ve çaresiz bakar.)', 4),
      shot('wide', V(0, 2.0, 9), V(0, 1.2, -6)), cap('Gerçeği bilen tek kişi, susmak zorunda kaldı.', 4),
      fade(true, 2.5), cap('VARDİYA BİTTİ', 4)];
    return [...common,
      shot('carIn'), cap('İki ortak yan yana, sessizce oturuyor.', 4),
      shot('close', 'P2'), wait(1.5), shot('close', 'P1'), wait(1.5),
      act(D2 => D2.openRoller(), true), sfx('alarm', 0.15),
      shot('wide', V(0, 1.6, 9), V(0, 1.4, -8)), cap('Garaj kapısı açılıyor… Gün doğuyor.', 5),
      fade(true, 2.5), cap('VARDİYA BİTTİ', 4)];
  },
  setup(s, D) {
    const m = s.m; m.title = 'Bölüm 14: Son Vardiya';
    s.brief('Final.');
    const info = s.info;
    D.openRoller = () => { const d = info.rollerDoor; let t = 0; s.w.updaters.push((dt) => { t += dt; if (d) d.position.y = Math.min(4.6, t * 0.75); if (info.rollerCol) info.rollerCol.on = t < 2; }); };
    D.endingA = () => {
      const car = s.g.policeCar, P1 = D.actor('P1'); if (!P1) return;
      // P1 aracın yanında kelepçeli; iki memur kapıya doğru götürür
      const start = car.position.clone().add(V(-2.4, 0, 0));
      D.flags.escort = true;
      const offs = [V(-0.8, 0, 0.6), V(0.8, 0, 0.6)];
      const offs2 = offs.map((o, i) => { const n = s.npc('bystander', start.clone().add(o), { app: loadoutAppearance({ ...DEFAULT, helmet: 'cap' }, 90 + i), state: 'idle' }); n.storyName = 'Memur'; D.cast[i ? 'officer2' : 'officer'] = n; return n; });
      let t = 0;
      s.w.updaters.push((dt) => {
        t += dt; const p = start.clone().add(V(0, 0, -t * 0.9)); if (p.z < -7) p.z = -7;
        if (P1.root) { P1.root.visible = true; P1.root.position.copy(p); P1.root.rotation.y = Math.PI; if (P1.char) { P1.char.setPose('cuffed'); P1.char.speed = t < 9 ? 1.2 : 0; P1.char.update(dt); } }
        offs2.forEach((n, i) => { n.pos.copy(p.clone().add(offs[i])); n.yaw = Math.PI; n.speed = 1.2; });
      });
      const P2 = D.actor('P2'); if (P2 && P2.root) { P2.root.visible = true; P2.root.position.copy(car.position.clone().add(V(2.2, 0, -0.5))); P2.root.rotation.y = Math.PI * 0.85; P2.inCar = false; }
      D.flags.p2stand = true;
    };
    m.obj('end', 'Vardiyayı bitir', 50);
  },
});

// Bölüm başlatma bilgisi
export function storySpec(n, choices = {}) {
  const ch = CHAPTERS[n - 1]; if (!ch) return null;
  return { crime: ch.id, loc: ch.loc, variant: ch.variant || 0, tod: ch.tod, rain: !!ch.rain, story: n, choices: { ...choices } };
}
export function loadStory() { try { const s = JSON.parse(localStorage.getItem('fa-story')); if (s && s.ch) return { ch: clamp(s.ch | 0, 1, 14), done: !!s.done, choices: s.choices || {} }; } catch (e) { } return { ch: 1, done: false, choices: {} }; }
export function saveStory(s) { try { localStorage.setItem('fa-story', JSON.stringify(s)); } catch (e) { } }
