// Calibration and behaviour contracts for sim.js. Run: node tests/sim.test.js
const assert = require('assert');
const Sim = require('../sim.js');
const { MPH } = Sim;
const DT = 1 / 60;
const OPEN = { bounds: [-1e6, -1e6, 1e6, 1e6], roads: [], paved: [[[-1e6, -1e6], [1e6, -1e6], [1e6, 1e6], [-1e6, 1e6]]], boxes: [], yard: [[0, 0], [0, 0], [0, 0], [0, 0]], climb: null };
const HILL = { ...OPEN, climb: { y0: 1e5, y1: -1e5, rise: 8000 } }; // 4% everywhere, uphill northbound
const truck = (load, opts = {}) => Sim.createState(load, { x: 0, y: 0, th: 0, coupled: true, ...opts });
const results = [];

function zeroToSixty(load) {
  const s = truck(load);
  while (s.v < 60 * MPH) { Sim.step(s, { throttle: 1 }, DT, OPEN); assert(s.time < 60, 'never reached 60 mph'); }
  return s.time;
}
function stoppingDistance(load) {
  const s = truck(load, { v: 50 * MPH });
  const d0 = s.distance;
  while (s.v > 0) Sim.step(s, { brake: 1 }, DT, OPEN);
  return s.distance - d0;
}
function cruise(world, th, mph) {
  const s = truck('full', { th, v: mph * MPH });
  const target = mph * MPH;
  let energy = 0, dist = 0, power = 0, n = 0;
  for (let i = 0; i < 60 * 120; i++) {
    const e0 = s.energyKWh, d0 = s.distance;
    Sim.step(s, { throttle: Math.max(0, Math.min(1, 0.3 + (target - s.v) * 2)) }, DT, world);
    if (i > 60 * 20) { energy += s.energyKWh - e0; dist += s.distance - d0; power += s.power; n++; }
  }
  return { kWhPerMile: energy / (dist / 1609.344), kW: power / n / 1000 };
}

const t = zeroToSixty('full');
results.push(`0-60 mph at 82,000 lb: ${t.toFixed(1)} s`);
assert(t >= 17 && t <= 24, `0-60 ${t}`);
assert(zeroToSixty('empty') < t, 'empty accelerates faster');

const flat = cruise(OPEN, 0, 55);
results.push(`55 mph flat, full load: ${flat.kWhPerMile.toFixed(2)} kWh/mi`);
assert(flat.kWhPerMile >= 1.4 && flat.kWhPerMile <= 2.0, `kWh/mi ${flat.kWhPerMile}`);

const climb = cruise(HILL, -Math.PI / 2, 40), level = cruise(OPEN, 0, 40);
results.push(`40 mph power: flat ${level.kW.toFixed(0)} kW, 4% climb ${climb.kW.toFixed(0)} kW`);
assert(climb.kW > level.kW * 2, 'climb costs much more power');

const dFull = stoppingDistance('full'), dEmpty = stoppingDistance('empty');
results.push(`50-0 mph stop: empty ${dEmpty.toFixed(0)} m, full ${dFull.toFixed(0)} m`);
assert(dFull > dEmpty * 1.2, 'heavier load stops in a longer distance');

// Off-tracking: in a steady low-speed turn the trailer axle runs inside the tractor rear axle.
{
  const s = truck('full', { v: 3 });
  for (let i = 0; i < 60 * 40; i++) Sim.step(s, { steer: 1, throttle: 0.05 + (3 - s.v) }, DT, OPEN);
  const R = Sim.PARAMS.wheelbase / Math.tan(s.delta);
  const mx = s.x - R * Math.sin(s.th), my = s.y + R * Math.cos(s.th);
  const [hx, hy] = Sim.hitch(s), L = Sim.PARAMS.kingpinToAxle;
  const rTractor = Math.hypot(s.x - mx, s.y - my);
  const rTrailer = Math.hypot(hx - L * Math.cos(s.psi) - mx, hy - L * Math.sin(s.psi) - my);
  assert.strictEqual(s.collisions, 0, 'no jackknife at full lock');
  results.push(`steady turn radius: tractor ${rTractor.toFixed(1)} m, trailer ${rTrailer.toFixed(1)} m`);
  assert(rTrailer < rTractor - 2, 'trailer cuts inside');
}

// Determinism: identical inputs give identical state.
{
  const run = () => { const s = truck('half'); for (let i = 0; i < 600; i++) Sim.step(s, { throttle: 1, steer: Math.sin(i / 50) }, DT, OPEN); return [s.x, s.y, s.psi, s.energyKWh]; };
  assert.deepStrictEqual(run(), run());
}

// Mission: backing straight from the start couples the trailer; a parked-at-dock state completes.
{
  const s = Sim.createState('full');
  s.gear = -1;
  for (let i = 0; i < 60 * 30 && !s.coupled; i++) Sim.step(s, { throttle: 0.3 }, DT);
  assert(s.coupled && s.events.includes('coupled'), 'couples by reversing');
  assert.strictEqual(s.collisions, 0);
  const d = Sim.WORLD.dock, P = Sim.PARAMS, k = P.trailerLength - P.kingpinToFront;
  const docked = Sim.createState('full', { coupled: true, th: d.heading, psi: d.heading, x: d.x, y: d.y + k - P.hitchOffset + 0.5, phase: 'dock' });
  Sim.step(docked, {}, DT);
  assert.strictEqual(docked.phase, 'done', 'dock detection');
  assert(docked.score > 0);
}

// The route is drivable: a simple pursuit driver reaches the yard without collisions or cargo damage.
{
  const s = Sim.createState('full', { coupled: true, x: 60 + Sim.PARAMS.hitchOffset, y: 40, th: 0 });
  const wps = [[140, 40], ...Sim.WORLD.roads[0].pts.slice(1), [930, -900]];
  let i = 0;
  for (let n = 0; n < 60 * 600 && s.phase !== 'dock'; n++) {
    const [tx, ty] = wps[i], b = Math.atan2(ty - s.y, tx - s.x), err = Math.atan2(Math.sin(b - s.th), Math.cos(b - s.th));
    if (Math.hypot(tx - s.x, ty - s.y) < 20 && i < wps.length - 1) i++;
    const vt = Math.abs(err) > 0.3 ? 5 : 20;
    Sim.step(s, { steer: err * 3, throttle: s.v < vt ? 0.6 : 0, brake: s.v > vt + 2 ? 0.5 : 0 }, DT);
  }
  results.push(`route to yard: ${s.time.toFixed(0)} s, ${s.energyKWh.toFixed(1)} kWh, cargo ${(s.cargoCondition * 100).toFixed(0)}%`);
  assert.strictEqual(s.phase, 'dock');
  assert.strictEqual(s.collisions, 0);
  assert(s.cargoCondition > 0.95, `cargo ${s.cargoCondition}`);
}

// The default world spawn is collision-free.
{
  const s = Sim.createState('full');
  Sim.step(s, {}, DT);
  assert.strictEqual(s.collisions + s.x, 75.3);
}

console.log(results.join('\n'));
console.log('sim tests: PASS');
