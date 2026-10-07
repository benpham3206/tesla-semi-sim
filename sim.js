// Tesla Semi simulation core: pure, no DOM, fixed-timestep. SI units.
// Coordinates: x east, y south (canvas convention), heading in radians from +x.
(function (root) {
  'use strict';

  const G = 9.81, RHO = 1.2, MPH = 0.44704;

  // Published by Tesla: 82,000 lb max GCW, 0-60 mph ~20 s at GCW, < 2 kWh/mi, up to 500 mi range.
  // Everything else is an explicit estimate, tuned so tests/sim.test.js hits the published targets.
  const PARAMS = {
    tractorMass: 10000,      // est. kg
    trailerMass: 7000,       // est. kg, empty 53 ft dry van
    peakPower: 800e3,        // est. W at wheels (three motors)
    maxDriveForce: 70e3,     // est. N, traction/torque limit at low speed
    regenPower: 400e3,       // est. W, battery acceptance limit
    regenForce: 0.15 * G,    // est. m/s^2 equivalent cap
    brakeDecel: 0.5 * G,     // est. tyre grip limit on dry asphalt
    brakeForce: 130e3,       // est. N, brake torque limit; a loaded rig stops longer
    reverseSpeed: 2.5,       // m/s cap in reverse (~5.6 mph)
    efficiency: 0.9,         // est. battery-to-wheel
    auxPower: 3e3,           // est. W, HVAC + electronics
    batteryKWh: 850,         // est. usable, 500 mi * 1.7 kWh/mi
    crr: 0.0055,             // est. low-rolling-resistance tires on asphalt
    crrOffRoad: 0.03,
    cdA: 3.6,                // est. m^2, tractor + trailer
    cdATractor: 2.4,         // est. m^2, bobtail
    wheelbase: 4.9,          // est. front axle to rear tandem centre
    tractorLength: 7.3, tractorFront: 6.1, width: 2.6, // front bumper 6.1 m ahead of rear axle
    hitchOffset: -0.3,       // fifth wheel 0.3 m ahead of rear axle
    trailerLength: 16.2,     // 53 ft
    kingpinToFront: 1.0,
    kingpinToAxle: 12.5,
    maxSteer: 0.6,           // rad at road wheels, bobtail
    maxSteerCoupled: 0.36,   // keeps steady-turn articulation (~70 deg) under jackknifeAngle
    steerRate: 0.9,          // rad/s
    maxLatAccel: 2.5,        // m/s^2 (~0.25 g), rollover-safe limit for a loaded semi
    jackknifeAngle: 1.4,     // rad articulation limit
  };

  const LOADS = {
    empty: { label: 'Empty trailer', cargo: 0 },
    half: { label: 'Half load', cargo: 10000 },
    full: { label: 'Full 82,000 lb', cargo: 82000 * 0.45359237 - PARAMS.tractorMass - PARAMS.trailerMass },
  };

  const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  const WORLD = {
    bounds: [-100, -1100, 1150, 200],
    roads: [{ width: 14, pts: [[110, 40], [420, 40], [520, -60], [520, -800], [620, -900], [890, -900]] }],
    paved: [box(0, 0, 130, 90), box(880, -1000, 1060, -820)],
    boxes: [
      box(0, -12, 130, 0), box(0, 90, 130, 100), box(-12, -12, 0, 100),        // depot fences
      box(130, -12, 140, 30), box(130, 50, 140, 100),                            // depot east fence, gate y 30..50
      box(10, 62, 40, 86), box(84, 70, 116, 86),                                 // depot buildings
      box(36, 6, 52.2, 8.6), box(36, 12, 52.2, 14.6),                            // parked trailers
      box(870, -1012, 1070, -985), box(870, -820, 1070, -810),                   // dock building, yard south fence
      box(870, -985, 880, -910), box(870, -890, 880, -820),                      // west fence, gate y -910..-890
      box(1060, -985, 1070, -820),                                               // east fence
      box(958.7, -985, 961.3, -968.8), box(998.7, -985, 1001.3, -968.8),         // trailers at neighbour bays
    ],
    bays: [960, 980, 1000],
    dock: { x: 980, y: -985, heading: Math.PI / 2, tolPos: 0.8, tolAngle: 6 * Math.PI / 180 },
    yard: box(880, -985, 1060, -820),
    gate: [880, -900],
    climb: { y0: -250, y1: -550, rise: 12 }, // 4% grade climbing northbound
  };

  // Elevation depends on y only: flat, linear climb, plateau.
  function gradient(world, x, y) {
    const c = world.climb;
    if (!c) return [0, 0];
    return y < c.y0 && y > c.y1 ? [0, c.rise / (c.y1 - c.y0)] : [0, 0];
  }
  function elevation(world, x, y) {
    const c = world.climb;
    if (!c) return 0;
    return c.rise * Math.min(1, Math.max(0, (y - c.y0) / (c.y1 - c.y0)));
  }

  function createState(loadKey = 'full', opts = {}) {
    const P = PARAMS;
    const s = {
      load: loadKey, cargoMass: LOADS[loadKey].cargo,
      x: 75.3, y: 40, th: 0, psi: 0, v: 0, delta: 0, gear: 1,
      coupled: false, kx: 60, ky: 40, kpsi: 0,          // parked trailer kingpin + heading
      batteryKWh: P.batteryKWh, energyKWh: 0, distance: 0, time: 0,
      collisions: 0, cargoCondition: 1, accel: 0, latAccel: 0, power: 0, offRoad: false,
      phase: 'couple', score: 0, events: [],
    };
    Object.assign(s, opts);
    if (s.coupled) { s.phase = 'deliver'; s.psi = opts.psi ?? s.th; }
    return s;
  }

  const mass = s => PARAMS.tractorMass + (s.coupled ? PARAMS.trailerMass + s.cargoMass : 0);

  function hitch(s) {
    const c = PARAMS.hitchOffset;
    return [s.x - c * Math.cos(s.th), s.y - c * Math.sin(s.th)];
  }

  function rect(cx, cy, h, len, w) {
    const c = Math.cos(h), sn = Math.sin(h), l = len / 2, ww = w / 2;
    return [[l, ww], [l, -ww], [-l, -ww], [-l, ww]].map(([a, b]) => [cx + a * c - b * sn, cy + a * sn + b * c]);
  }

  function tractorShape(s, cabOnly) {
    const P = PARAMS, len = cabOnly ? 4.5 : P.tractorLength, front = P.tractorFront;
    const off = front - len / 2;
    return rect(s.x + off * Math.cos(s.th), s.y + off * Math.sin(s.th), s.th, len, P.width);
  }

  function trailerShape(s) {
    const P = PARAMS;
    const [kx, ky] = s.coupled ? hitch(s) : [s.kx, s.ky];
    const h = s.coupled ? s.psi : s.kpsi;
    const off = P.kingpinToFront - P.trailerLength / 2;
    return rect(kx + off * Math.cos(h), ky + off * Math.sin(h), h, P.trailerLength, P.width);
  }

  function trailerRear(s) {
    const P = PARAMS, [kx, ky] = hitch(s), d = P.trailerLength - P.kingpinToFront;
    return [kx - d * Math.cos(s.psi), ky - d * Math.sin(s.psi)];
  }

  function overlap(a, b) {
    for (const poly of [a, b]) {
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], nx = q[1] - p[1], ny = p[0] - q[0];
        let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
        for (const [x, y] of a) { const d = x * nx + y * ny; amin = Math.min(amin, d); amax = Math.max(amax, d); }
        for (const [x, y] of b) { const d = x * nx + y * ny; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
        if (amax < bmin || bmax < amin) return false;
      }
    }
    return true;
  }

  function inside(poly, x, y) {
    return x >= poly[0][0] && x <= poly[2][0] && y >= poly[0][1] && y <= poly[2][1];
  }

  function onRoad(world, x, y) {
    if (world.paved.some(p => inside(p, x, y))) return true;
    return world.roads.some(r => r.pts.some((p, i) => {
      const q = r.pts[i + 1];
      if (!q) return false;
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy) <= r.width / 2 + 1;
    }));
  }

  function collides(s, world) {
    const tractor = tractorShape(s, false);
    const shapes = s.coupled ? [tractor, trailerShape(s)] : [tractor];
    const [x0, y0, x1, y1] = world.bounds;
    for (const sh of shapes) {
      if (sh.some(([x, y]) => x < x0 || x > x1 || y < y0 || y > y1)) return true;
      if (world.boxes.some(b => overlap(sh, b))) return true;
    }
    // Uncoupled: the tractor frame slides under the trailer; only the cab can hit it.
    return !s.coupled && overlap(tractorShape(s, true), trailerShape(s));
  }

  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  // input: { steer: -1..1, throttle: 0..1, brake: 0..1 }; s.gear (1 | -1) is set by the caller when stopped.
  function step(s, input, dt, world = WORLD) {
    const P = PARAMS, m = mass(s), dir = s.gear, v0 = s.v;
    const steer = Math.max(-1, Math.min(1, input.steer || 0));
    const throttle = s.batteryKWh > 0 ? Math.max(0, Math.min(1, input.throttle || 0)) : 0;
    const brake = Math.max(0, Math.min(1, input.brake || 0));

    // Steering: rate-limited, and capped so lateral acceleration stays under maxLatAccel.
    const lim = Math.min(s.coupled ? P.maxSteerCoupled : P.maxSteer, Math.atan(P.maxLatAccel * P.wheelbase / Math.max(v0 * v0, 1e-6)));
    const target = steer * lim;
    s.delta += Math.max(-P.steerRate * dt, Math.min(P.steerRate * dt, target - s.delta));
    s.delta = Math.max(-lim, Math.min(lim, s.delta));

    // Longitudinal: m a = F_drive - F_brake - F_roll - F_air - m g sin(theta)
    const speed = Math.abs(v0);
    const reverseCap = dir < 0 ? Math.max(0, 1 - speed / P.reverseSpeed) : 1;
    const fDrive = dir * throttle * reverseCap * Math.min(P.maxDriveForce, P.peakPower / Math.max(speed, 1));
    const regenCap = Math.min(P.regenForce * m, P.regenPower / Math.max(speed, 1));
    const lift = throttle === 0 ? 0.6 : 0; // one-pedal regen when the accelerator is released
    const want = Math.max(lift * regenCap, brake * Math.min(P.brakeDecel * m, P.brakeForce));
    const fRegen = Math.min(want, regenCap), fBrake = want;   // total retarding force, regen share first
    s.offRoad = !onRoad(world, s.x, s.y);
    const crr = s.offRoad ? P.crrOffRoad : P.crr;
    const [gx, gy] = gradient(world, s.x, s.y);
    const grade = gx * Math.cos(s.th) + gy * Math.sin(s.th);
    const cdA = s.coupled ? P.cdA : P.cdATractor;
    const fGrade = m * G * grade;                                // small-angle sin(atan(g)) ~ g
    const fAir = 0.5 * RHO * cdA * v0 * speed;
    const fRoll = crr * m * G;
    const fResist = fBrake + fRoll;                              // always opposes motion
    let v = v0 + (fDrive - fAir - fGrade) / m * dt;
    const dv = fResist / m * dt;
    if (Math.abs(v) <= dv && Math.abs(fDrive - fGrade) <= fResist) v = 0; // static hold
    else v -= Math.sign(v || fDrive - fGrade) * dv;
    s.accel = (v - v0) / dt;
    s.v = v;

    // Energy: motoring draws mech/eta, regen returns mech*eta.
    const mech = fDrive * v0 - Math.sign(v0) * fRegen * v0;
    const pBatt = (mech >= 0 ? mech / P.efficiency : mech * P.efficiency) + P.auxPower;
    s.power = pBatt;
    s.energyKWh += pBatt * dt / 3.6e6;
    s.batteryKWh = Math.max(0, P.batteryKWh - s.energyKWh);

    // Kinematics: tractor rear axle, then trailer with off-axle hitch.
    const prev = { x: s.x, y: s.y, th: s.th, psi: s.psi };
    const vm = (v0 + v) / 2, omega = vm * Math.tan(s.delta) / P.wheelbase;
    s.latAccel = vm * omega;
    s.x += vm * Math.cos(s.th) * dt;
    s.y += vm * Math.sin(s.th) * dt;
    s.th = wrap(s.th + omega * dt);
    if (s.coupled) {
      const phi = s.th - s.psi, c = P.hitchOffset;
      s.psi = wrap(s.psi + (vm * Math.sin(phi) - c * omega * Math.cos(phi)) / P.kingpinToAxle * dt);
    }
    s.distance += Math.abs(vm) * dt;
    s.time += dt;

    const jackknife = s.coupled && Math.abs(wrap(s.th - s.psi)) > P.jackknifeAngle;
    if (jackknife || collides(s, world)) {
      Object.assign(s, prev);
      if (speed > 0.5) {
        s.collisions++;
        s.cargoCondition = Math.max(0, s.cargoCondition - (s.coupled ? 0.02 + 0.01 * speed : 0));
        s.events.push(jackknife ? 'jackknife' : 'collision');
      }
      s.v = 0; s.accel = 0;
      return s;
    }

    // Harsh driving damages cargo.
    if (s.coupled && (Math.abs(s.accel) > 2.8 || Math.abs(s.latAccel) > 2.8)) {
      s.cargoCondition = Math.max(0, s.cargoCondition - 0.05 * dt);
    }

    if (s.phase === 'couple' && s.gear < 0 && speed < 3) {
      const [hx, hy] = hitch(s);
      if (Math.hypot(hx - s.kx, hy - s.ky) < 0.8 && Math.abs(wrap(s.th - s.kpsi)) < 0.2) {
        s.coupled = true; s.psi = s.kpsi; s.v = 0; s.phase = 'deliver'; s.events.push('coupled');
      }
    }
    if (s.phase === 'deliver' && inside(world.yard, s.x, s.y)) { s.phase = 'dock'; s.events.push('yard'); }
    if (s.phase === 'dock' && Math.abs(s.v) < 0.05) {
      const d = world.dock, [rx, ry] = trailerRear(s);
      if (Math.abs(rx - d.x) < d.tolPos && Math.abs(ry - d.y) < 1.5 && Math.abs(wrap(s.psi - d.heading)) < d.tolAngle) {
        s.phase = 'done';
        s.score = Math.round(Math.max(0, 1000 - 50 * s.collisions - 500 * (1 - s.cargoCondition)
          - Math.max(0, s.time - 240) - 2 * s.energyKWh));
        s.events.push('docked');
      }
    }
    return s;
  }

  const api = { PARAMS, LOADS, WORLD, MPH, createState, step, hitch, tractorShape, trailerShape, trailerRear, elevation, mass };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sim = api;
})(this);
