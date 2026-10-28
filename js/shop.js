// Kişiselleştirme: her kategorinin ilk ürünü bedava (yelek hariç), kalanlar kasalardan çıkar.
// Kasa olasılıkları CS kasa sistemi gibi: Askeri %79.92 · Kısıtlı %15.98 · Gizli %3.2 · Çok Gizli %0.64 · Efsanevi %0.26
import { HAIR, HAIR_COLOR, policeAppearance } from './character.js';
import { RNG } from './util.js';

export const RARITY = {
  free: { n: 'Başlangıç', c: '#9aa3ad', w: 0 },
  blue: { n: 'Askeri Sınıf', c: '#4b69ff', w: 79.92 },
  purple: { n: 'Kısıtlı', c: '#8847ff', w: 15.98 },
  pink: { n: 'Gizli', c: '#d32ce6', w: 3.2 },
  red: { n: 'Çok Gizli', c: '#eb4b4b', w: 0.64 },
  gold: { n: 'Efsanevi', c: '#e4ae39', w: 0.26 },
};
export const TIERS = ['blue', 'purple', 'pink', 'red', 'gold'];

// Silah özellikleri: şarjör, yedek, atış aralığı, otomatik, yeniden doldurma, hasar, tepme, saçılma
export const WEAPONS = {
  schofield: { n: 'Schofield 6', mag: 1, reserve: 24, rate: 0.3, auto: false, reload: 1.25, dmg: { head: 140, body: 58, legs: 36 }, kick: 0.055, vmKick: 1.5, spread: 0.035, rateSnd: 0.88, vol: 1.2, model: 'schofield' },
  glock19: { n: 'Glock 19', mag: 17, reserve: 51, rate: 0.14, auto: false, reload: 1.6, dmg: { head: 120, body: 38, legs: 24 }, kick: 0.02, vmKick: 1, spread: 0.05, rateSnd: 1, vol: 1, model: 'glock' },
  deagle: { n: 'Desert Eagle', mag: 7, reserve: 28, rate: 0.38, auto: false, reload: 2.0, dmg: { head: 160, body: 66, legs: 40 }, kick: 0.085, vmKick: 2.4, spread: 0.06, rateSnd: 0.78, vol: 1.45, model: 'deagle' },
  mp5k: { n: 'MP5K', mag: 15, reserve: 60, rate: 0.075, auto: true, reload: 3.4, dmg: { head: 60, body: 19, legs: 13 }, kick: 0.013, vmKick: 0.45, spread: 0.07, rateSnd: 1.25, vol: 0.85, model: 'mp5k' },
  silverglock: { n: 'Gümüş Glock', mag: 17, reserve: 51, rate: 0.14, auto: false, reload: 1.6, dmg: { head: 120, body: 38, legs: 24 }, kick: 0.02, vmKick: 1, spread: 0.05, rateSnd: 1, vol: 1, model: 'glock', shine: 'silver' },
  golddeagle: { n: 'Altın Deagle', mag: 7, reserve: 28, rate: 0.38, auto: false, reload: 2.0, dmg: { head: 160, body: 66, legs: 40 }, kick: 0.085, vmKick: 2.4, spread: 0.06, rateSnd: 0.78, vol: 1.45, model: 'deagle', shine: 'gold' },
};

export const SHOP = {
  helmet: {
    label: 'Kask', box: 'Kask Kasası', items: [
      { id: 'kepi', n: 'Devriye Kepi', r: 'free', d: 'Başlangıç kepi' },
      { id: 'cap', n: 'Polis Kasketi', r: 'blue', d: 'Siperlikli, rozetli kasket' },
      { id: 'beret', n: 'Bordo Bere', r: 'blue', d: 'Özel harekât beresi' },
      { id: 'riot', n: 'Çevik Kuvvet', r: 'purple', d: 'Şeffaf vizörlü kask' },
      { id: 'nvg', n: 'Gece Görüş Kaskı', r: 'pink', d: 'Yeşil parlayan gece görüş dürbünü' },
      { id: 'silver', n: 'Gümüş Kask', r: 'red', d: 'Parlak gümüş kaplama', shine: 'silver' },
      { id: 'gold', n: 'Altın Kask', r: 'gold', d: 'Parlak altın kaplama', shine: 'gold' },
    ],
  },
  weapon: {
    label: 'Tabanca', box: 'Silah Kasası', items: [
      { id: 'schofield', n: 'Schofield 6', r: 'free', d: 'Tek atış, her mermiden sonra doldur' },
      { id: 'glock19', n: 'Glock 19', r: 'blue', d: '17 mermi · dengeli' },
      { id: 'deagle', n: 'Desert Eagle', r: 'purple', d: '7 mermi · güçlü, sert tepme' },
      { id: 'mp5k', n: 'MP5K', r: 'pink', d: '15 mermi · tek elde taramalı · uzun doldurma' },
      { id: 'silverglock', n: 'Gümüş Glock', r: 'red', d: 'Glock 19 · gümüş parıltı', shine: 'silver' },
      { id: 'golddeagle', n: 'Altın Deagle', r: 'gold', d: 'Desert Eagle · altın parıltı', shine: 'gold' },
    ],
  },
  vest: {
    label: 'Yelek', box: 'Yelek Kasası', items: [
      { id: 'civil', n: 'Sivil Görev Yeleği', r: 'blue', c: '#2b3138', d: 'Hasar %10 azalır', armor: 0.1 },
      { id: 'steel', n: 'Klasik Çelik Yelek', r: 'purple', c: '#5f6670', d: 'Hasar %20 azalır', armor: 0.2 },
      { id: 'molle', n: 'Molle Taktik Hücum Yeleği', r: 'pink', c: '#3f4630', d: 'Hasar %30 azalır', armor: 0.3 },
    ],
  },
  uniform: {
    label: 'Üniforma', box: 'Üniforma Kasası', items: [
      { id: 'standard', n: 'Standart Gece Devriye Üniforması', r: 'free', c: '#1b2640', pc: '#161c2c' },
      { id: 'rain', n: 'Yağmurluklu Operasyon Kıyafeti', r: 'blue', c: '#1f2a24', pc: '#141816', d: 'Parlak yağmurluk' },
      { id: 'riotsuit', n: 'Çevik Kuvvet Zırhlı Takımı', r: 'purple', c: '#16181c', pc: '#101114', d: 'Omuz, kol ve diz zırhları' },
      { id: 'ceremony', n: 'Gümüş Şeritli Tören Üniforması', r: 'red', c: '#1c2a4a', pc: '#141c30', d: 'Gümüş apolet ve şeritler', shine: 'silver' },
      { id: 'goldrank', n: 'Altın İşlemeli Rütbe Üniforması', r: 'gold', c: '#141a2c', pc: '#0f1322', d: 'Altın işleme ve apoletler', shine: 'gold' },
    ],
  },
  hair: { label: 'Saç stili', items: Object.keys(HAIR).filter(k => !['Bereli', 'Kapüşonlu', 'Şapkalı'].includes(k)).sort((a, b) => (a === 'Kısa saç' ? -1 : b === 'Kısa saç' ? 1 : 0)).map(k => ({ id: k, n: k, r: k === 'Kısa saç' ? 'free' : 'buy', p: k === 'Kısa saç' ? 0 : 200 })) },
  hairColor: { label: 'Saç rengi', items: Object.keys(HAIR_COLOR).map(k => ({ id: k, n: k, r: 'free', sw: HAIR_COLOR[k] })) },
};
export const CATS = Object.keys(SHOP);
export const CASE_CATS = ['helmet', 'weapon', 'vest', 'uniform'];
export const CASE_PRICE = { helmet: 250, weapon: 350, vest: 250, uniform: 300 };
export const DUP_REFUND = 0.3; // aynı ürün çıkarsa kasa fiyatının %30'u geri
export const REMOVABLE = { helmet: 'none', vest: 'none' };
export const DEFAULT = { helmet: 'kepi', weapon: 'schofield', vest: 'none', uniform: 'standard', hair: 'Kısa saç', hairColor: 'Siyah' };

export const item = (cat, id) => SHOP[cat].items.find(i => i.id === id) || (id === REMOVABLE[cat] ? { id, n: 'Yok', r: 'free' } : SHOP[cat].items[0]);
export const weaponOf = (id) => WEAPONS[id] || WEAPONS.schofield;
export const isFree = (it) => it.r === 'free';

// Kasa içeriği ve gerçek olasılıklar (yalnızca kasada bulunan seviyeler üzerinden normalize)
export function caseOdds(cat) {
  const items = SHOP[cat].items.filter(i => TIERS.includes(i.r));
  const tiers = TIERS.filter(t => items.some(i => i.r === t));
  const tot = tiers.reduce((s, t) => s + RARITY[t].w, 0);
  return tiers.map(t => ({ tier: t, p: RARITY[t].w / tot, items: items.filter(i => i.r === t) }));
}
// Ücretsiz çark: yalnız mor ve üstü (Kısıtlı, Gizli, Çok Gizli, Efsanevi), seviyelerin şansı eşit
export function freeOdds(cat) {
  const odds = caseOdds(cat).filter(o => TIERS.indexOf(o.tier) >= TIERS.indexOf('purple'));
  return odds.map(o => ({ ...o, p: 1 / odds.length }));
}
export function rollFree(cat) {
  const odds = freeOdds(cat), o = odds[Math.floor(Math.random() * odds.length)];
  return o.items[Math.floor(Math.random() * o.items.length)];
}
export function rollCase(cat, rnd = Math.random) {
  const odds = caseOdds(cat); let x = rnd(), acc = 0;
  for (const o of odds) { acc += o.p; if (x <= acc) return o.items[Math.floor(rnd() * o.items.length)]; }
  const last = odds[odds.length - 1]; return last.items[0];
}

// Kayıtlı durum: sahip olunanlar + giyilenler (v2: yeni katalog; eski kayıt bulunursa harcama iade edilir)
export function loadShop() {
  let s = null; try { s = JSON.parse(localStorage.getItem('fa-shop')); } catch (e) { }
  s = s && typeof s === 'object' ? s : {};
  const migrated = !!(s.eq && s.v !== 2);
  if (s.v !== 2) s = {};
  const eq = { ...DEFAULT, ...(s.eq || {}) }, owned = {};
  for (const c of CATS) {
    const free = SHOP[c].items.filter(isFree).map(i => i.id);
    owned[c] = [...new Set([...(Array.isArray(s.owned?.[c]) ? s.owned[c] : []), ...free])].filter(id => SHOP[c].items.some(i => i.id === id));
    if (!owned[c].includes(eq[c]) && eq[c] !== REMOVABLE[c]) eq[c] = DEFAULT[c];
  }
  return { v: 2, eq, owned, migrated };
}
export function saveShop(s) { try { localStorage.setItem('fa-shop', JSON.stringify({ v: 2, eq: s.eq, owned: s.owned })); } catch (e) { } }

// Ağ için kısa biçim
export const packLoadout = (eq) => CATS.map(c => eq[c]).join('|');
export function unpackLoadout(str) {
  const eq = { ...DEFAULT }; if (typeof str !== 'string') return eq;
  str.split('|').slice(0, CATS.length).forEach((v, i) => { const c = CATS[i]; if (SHOP[c].items.some(it => it.id === v) || v === REMOVABLE[c]) eq[c] = v; });
  return eq;
}

// Giyilenlerden polis görünümü
export function loadoutAppearance(eq, seed = 7) {
  const a = policeAppearance(new RNG(seed));
  const u = item('uniform', eq.uniform);
  a.uniform = u.c; a.uniformPants = u.pc; a.uniformKind = u.id;
  a.helmet = eq.helmet; a.vest = eq.vest; a.vestColor = item('vest', eq.vest).c || '#16181c';
  a.hair = eq.hair; a.hairColor = eq.hairColor;
  return a;
}
