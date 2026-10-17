// PHYS P1 — Planck.js 2D neon ragdoll + grab/throw weapons + wall/floor impact damage.
// Soft Stick Fight joints kept. Limb mesh sizes unchanged.
import { World, Edge, Box, Circle, RevoluteJoint, WeldJoint, Vec2 } from '../../vendor/planck/planck.mjs';

export const ARENA = 7.5;
export const DT = 1 / 60;
export const GRAVITY = -20;

const CAT = {
  GROUND: 0x0001, A: 0x0002, B: 0x0004, FIST_A: 0x0008, FIST_B: 0x0010, WEAPON: 0x0020,
};
const MASK = {
  ground: CAT.A | CAT.B | CAT.FIST_A | CAT.FIST_B | CAT.WEAPON,
  bodyA: CAT.GROUND | CAT.B | CAT.FIST_B | CAT.WEAPON,
  bodyB: CAT.GROUND | CAT.A | CAT.FIST_A | CAT.WEAPON,
  fistA: CAT.GROUND | CAT.B | CAT.WEAPON,
  fistB: CAT.GROUND | CAT.A | CAT.WEAPON,
  weapon: CAT.GROUND | CAT.A | CAT.B | CAT.FIST_A | CAT.FIST_B,
};

export const SOFT = {
  gain: 4.5, hipT: 22, knT: 14, shT: 10, elT: 8, neckT: 5, wrT: 4,
  upright: 14, uprightD: 2.5, walkK: 12, flinchT: 0.28,
};

/** Neon weapon catalogue (original CYBER props — not Landfall clones). */
export const WEAPON_DEFS = {
  bat:   { id: 'bat',   zh: '等離子棍', en: 'PLASMA BAT',   hx: 0.52, hy: 0.07, dens: 1.5, color: 0x00e5ff, dmgMul: 1.25, throw: 5.2 },
  blade: { id: 'blade', zh: '霓虹刃',   en: 'NEON BLADE',   hx: 0.58, hy: 0.045, dens: 0.95, color: 0xff2bd6, dmgMul: 1.45, throw: 6.0 },
  pipe:  { id: 'pipe',  zh: '鉻管',     en: 'CHROME PIPE',  hx: 0.45, hy: 0.08, dens: 1.9, color: 0xffe14d, dmgMul: 1.15, throw: 4.6 },
};

function boxBody(world, x, y, hx, hy, dens, filter, opts = {}) {
  const b = world.createBody({
    type: 'dynamic', position: { x, y }, angle: opts.angle || 0,
    linearDamping: opts.ld ?? 0.25, angularDamping: opts.ad ?? 0.22, fixedRotation: !!opts.fixed,
  });
  b.createFixture({
    shape: new Box(hx, hy), density: dens,
    friction: opts.fric ?? 0.5, restitution: opts.rest ?? 0.12,
    filterCategoryBits: filter.cat, filterMaskBits: filter.mask,
  });
  return b;
}
function circleBody(world, x, y, r, dens, filter, opts = {}) {
  const b = world.createBody({
    type: 'dynamic', position: { x, y },
    linearDamping: opts.ld ?? 0.22, angularDamping: opts.ad ?? 0.18,
  });
  b.createFixture({
    shape: new Circle(r), density: dens,
    friction: opts.fric ?? 0.4, restitution: opts.rest ?? 0.15,
    filterCategoryBits: filter.cat, filterMaskBits: filter.mask,
  });
  return b;
}

function joint(world, a, b, ax, ay, { lo, hi, motor = true, torque = 12, speed = 0 } = {}) {
  return world.createJoint(new RevoluteJoint({
    enableLimit: lo != null && hi != null, lowerAngle: lo ?? 0, upperAngle: hi ?? 0,
    enableMotor: motor, maxMotorTorque: torque, motorSpeed: speed, collideConnected: false,
  }, a, b, { x: ax, y: ay }));
}

export function makeRagdoll(world, x0, face, team) {
  const f = face >= 0 ? 1 : -1;
  const bodyCat = team === 'a' ? { cat: CAT.A, mask: MASK.bodyA } : { cat: CAT.B, mask: MASK.bodyB };
  const fistCat = team === 'a' ? { cat: CAT.FIST_A, mask: MASK.fistA } : { cat: CAT.FIST_B, mask: MASK.fistB };

  const torsoH = 0.38, torsoW = 0.16, headR = 0.16;
  const ua = { hx: 0.07, hy: 0.18 }, la = { hx: 0.06, hy: 0.16 };
  const th = { hx: 0.09, hy: 0.22 }, sh = { hx: 0.08, hy: 0.2 };
  const fistR = 0.09;
  const pelvisY = 0.95;

  const torso = boxBody(world, x0, pelvisY + torsoH, torsoW, torsoH, 2.8, bodyCat, { ad: 0.35 });
  const head = circleBody(world, x0, pelvisY + torsoH * 2 + headR + 0.02, headR, 0.85, bodyCat, { ad: 0.2 });
  const shY = pelvisY + torsoH * 2 - 0.04, hipY = pelvisY;

  const uArmF = boxBody(world, x0 + f * 0.22, shY - ua.hy, ua.hx, ua.hy, 0.7, bodyCat);
  const lArmF = boxBody(world, x0 + f * 0.22, shY - ua.hy * 2 - la.hy, la.hx, la.hy, 0.55, bodyCat);
  const fistF = circleBody(world, x0 + f * 0.22, shY - ua.hy * 2 - la.hy * 2 - fistR, fistR, 0.45, fistCat, { rest: 0.2, fric: 0.65 });
  const uArmB = boxBody(world, x0 - f * 0.18, shY - ua.hy, ua.hx, ua.hy, 0.65, bodyCat);
  const lArmB = boxBody(world, x0 - f * 0.18, shY - ua.hy * 2 - la.hy, la.hx, la.hy, 0.5, bodyCat);
  const fistB = circleBody(world, x0 - f * 0.18, shY - ua.hy * 2 - la.hy * 2 - fistR, fistR, 0.4, fistCat, { rest: 0.18 });
  const thighF = boxBody(world, x0 + f * 0.08, hipY - th.hy, th.hx, th.hy, 1.3, bodyCat);
  const shinF = boxBody(world, x0 + f * 0.08, hipY - th.hy * 2 - sh.hy, sh.hx, sh.hy, 0.9, bodyCat);
  const thighB = boxBody(world, x0 - f * 0.08, hipY - th.hy, th.hx, th.hy, 1.3, bodyCat);
  const shinB = boxBody(world, x0 - f * 0.08, hipY - th.hy * 2 - sh.hy, sh.hx, sh.hy, 0.9, bodyCat);

  const j = {
    neck: joint(world, torso, head, x0, pelvisY + torsoH * 2, { lo: -1.4, hi: 1.4, torque: SOFT.neckT }),
    shF: joint(world, torso, uArmF, x0 + f * 0.14, shY, { lo: -2.9, hi: 2.9, torque: SOFT.shT }),
    elF: joint(world, uArmF, lArmF, x0 + f * 0.22, shY - ua.hy * 2, { lo: -0.15, hi: 2.85, torque: SOFT.elT }),
    wrF: joint(world, lArmF, fistF, x0 + f * 0.22, shY - ua.hy * 2 - la.hy * 2, { lo: -1.6, hi: 1.6, torque: SOFT.wrT }),
    shB: joint(world, torso, uArmB, x0 - f * 0.14, shY, { lo: -2.9, hi: 2.9, torque: SOFT.shT }),
    elB: joint(world, uArmB, lArmB, x0 - f * 0.18, shY - ua.hy * 2, { lo: -0.15, hi: 2.85, torque: SOFT.elT }),
    wrB: joint(world, lArmB, fistB, x0 - f * 0.18, shY - ua.hy * 2 - la.hy * 2, { lo: -1.6, hi: 1.6, torque: SOFT.wrT }),
    hipF: joint(world, torso, thighF, x0 + f * 0.06, hipY, { lo: -2.4, hi: 1.6, torque: SOFT.hipT }),
    knF: joint(world, thighF, shinF, x0 + f * 0.08, hipY - th.hy * 2, { lo: -0.1, hi: 2.7, torque: SOFT.knT }),
    hipB: joint(world, torso, thighB, x0 - f * 0.06, hipY, { lo: -2.4, hi: 1.6, torque: SOFT.hipT }),
    knB: joint(world, thighB, shinB, x0 - f * 0.08, hipY - th.hy * 2, { lo: -0.1, hi: 2.7, torque: SOFT.knT }),
  };

  const parts = { torso, head, uArmF, lArmF, fistF, uArmB, lArmB, fistB, thighF, shinF, thighB, shinB };
  for (const [name, body] of Object.entries(parts)) body.setUserData({ team, part: name, ragdoll: null, kind: 'limb' });

  const doll = {
    team, face: f, parts, joints: j, alive: true, hp: 100, maxHp: 100,
    punchCd: 0, jumpCd: 0, limpT: 0, flinchT: 0, grabCd: 0, throwCd: 0,
    held: null, color: team === 'a' ? 0x00e5ff : 0xff2bd6,
    _stance: { hipF: 0.2, hipB: -0.15, knF: 0.35, knB: 0.3, shF: -0.55, shB: 0.45, elF: 0.75, elB: 0.65 },
    _impactCd: 0,
  };
  for (const body of Object.values(parts)) body.getUserData().ragdoll = doll;
  return doll;
}

function spawnWeapon(world, defId, x, y, angle = 0) {
  const def = WEAPON_DEFS[defId];
  const body = boxBody(world, x, y, def.hx, def.hy, def.dens, { cat: CAT.WEAPON, mask: MASK.weapon }, {
    angle, ld: 0.15, ad: 0.12, fric: 0.55, rest: 0.2,
  });
  const w = { id: def.id, def, body, heldBy: null, weld: null, hitCd: 0 };
  body.setUserData({ kind: 'weapon', weapon: w });
  return w;
}

export function makePhysWorld() {
  const world = new World({ gravity: { x: 0, y: GRAVITY } });
  const ground = world.createBody({ type: 'static' });
  ground.createFixture({
    shape: new Edge({ x: -ARENA - 2, y: 0 }, { x: ARENA + 2, y: 0 }),
    friction: 0.85, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground,
  });
  ground.setUserData({ kind: 'ground' });

  const wallL = world.createBody({ type: 'static', position: { x: -ARENA - 0.3, y: 3 } });
  wallL.createFixture({ shape: new Box(0.25, 4), friction: 0.35, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });
  wallL.setUserData({ kind: 'wall' });
  const wallR = world.createBody({ type: 'static', position: { x: ARENA + 0.3, y: 3 } });
  wallR.createFixture({ shape: new Box(0.25, 4), friction: 0.35, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });
  wallR.setUserData({ kind: 'wall' });

  const ceil = world.createBody({ type: 'static', position: { x: 0, y: 7.2 } });
  ceil.createFixture({ shape: new Box(ARENA + 1, 0.2), filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });
  ceil.setUserData({ kind: 'ceil' });

  const a = makeRagdoll(world, -2.4, 1, 'a');
  const b = makeRagdoll(world, 2.4, -1, 'b');
  a.color = 0x00e5ff; b.color = 0xff2bd6;

  // 3 neon weapons on the rooftop
  const weapons = [
    spawnWeapon(world, 'bat', -0.2, 0.12, 0.15),
    spawnWeapon(world, 'blade', 1.6, 0.1, -0.4),
    spawnWeapon(world, 'pipe', -4.2, 0.14, 0.9),
  ];

  const events = [];

  world.on('begin-contact', (contact) => {
    const fa = contact.getFixtureA(), fb = contact.getFixtureB();
    const ba = fa.getBody(), bb = fb.getBody();
    const ua = ba.getUserData(), ub = bb.getUserData();
    if (!ua || !ub) return;

    // ---- fist → limb punch (only if attacker not holding a weapon)
    const fistHit = (ua.part?.startsWith('fist') && ub.kind === 'limb' && !ub.part?.startsWith('fist'))
      || (ub.part?.startsWith('fist') && ua.kind === 'limb' && !ua.part?.startsWith('fist'));
    if (fistHit) {
      const fistUd = ua.part?.startsWith('fist') ? ua : ub;
      const victimUd = fistUd === ua ? ub : ua;
      const fist = fistUd.ragdoll, victim = victimUd.ragdoll;
      if (fist?.alive && victim?.alive && fist.team !== victim.team && !fist.held && !fist._hitLatch) {
        const wv = Vec2.sub(ba.getLinearVelocity(), bb.getLinearVelocity());
        const speed = Math.hypot(wv.x, wv.y);
        if (speed >= 3.2) {
          const dmg = Math.min(18, 4 + Math.min(speed, 16) * 1.1);
          const tp = victim.parts.torso.getPosition();
          events.push({ type: 'hit', kind: 'punch', att: fist, def: victim, dmg, speed, x: tp.x, y: tp.y });
          fist._hitLatch = true;
        }
      }
    }

    // ---- weapon → limb
    const weapHit = (ua.kind === 'weapon' && ub.kind === 'limb') || (ub.kind === 'weapon' && ua.kind === 'limb');
    if (weapHit) {
      const wUd = ua.kind === 'weapon' ? ua : ub;
      const vUd = wUd === ua ? ub : ua;
      const w = wUd.weapon, victim = vUd.ragdoll;
      if (w && victim?.alive && !(w.hitCd > 0)) {
        // don't hurt holder
        if (w.heldBy === victim) return;
        const wb = w.body;
        const speed = Math.hypot(wb.getLinearVelocity().x, wb.getLinearVelocity().y)
          + Math.abs(wb.getAngularVelocity()) * w.def.hx * 0.6;
        if (speed >= 3.0) {
          const dmg = Math.min(32, (5 + Math.min(speed, 20) * 1.5) * w.def.dmgMul);
          const tp = victim.parts.torso.getPosition();
          const att = w.heldBy || null;
          events.push({ type: 'hit', kind: 'weapon', att, weapon: w, def: victim, dmg, speed, x: tp.x, y: tp.y });
          w.hitCd = 0.22;
        }
      }
    }

    // ---- limb → ground/wall impact damage
    const impact = (ua.kind === 'limb' && (ub.kind === 'ground' || ub.kind === 'wall'))
      || (ub.kind === 'limb' && (ua.kind === 'ground' || ua.kind === 'wall'));
    if (impact) {
      const lUd = ua.kind === 'limb' ? ua : ub;
      const env = lUd === ua ? ub : ua;
      const doll = lUd.ragdoll;
      if (!doll?.alive || doll._impactCd > 0) return;
      // head / torso / thighs take impact; soft parts less
      const part = lUd.part;
      const mul = part === 'head' ? 1.4 : part === 'torso' ? 1.0 : (part?.startsWith('thigh') || part?.startsWith('shin') ? 0.55 : 0.35);
      const body = lUd === ua ? ba : bb;
      const speed = Math.hypot(body.getLinearVelocity().x, body.getLinearVelocity().y);
      const minSp = env.kind === 'wall' ? 4.2 : 6.2;
      if (speed < minSp) return;
      const dmg = Math.min(30, (speed - minSp * 0.4) * 2.0 * mul);
      if (dmg < 4) return;
      const p = body.getPosition();
      events.push({ type: 'hit', kind: 'impact', att: null, def: doll, dmg, speed, part, x: p.x, y: p.y, env: env.kind });
      doll._impactCd = 0.35;
    }
  });

  return { world, a, b, weapons, events, ground };
}

function setMotor(j, targetAngle, gain, maxTorque) {
  if (!j) return;
  const ang = j.getJointAngle();
  j.setMotorSpeed((targetAngle - ang) * gain);
  if (maxTorque != null) j.setMaxMotorTorque(maxTorque);
}

export function nearestFreeWeapon(doll, weapons, maxDist = 1.35) {
  const fist = doll.parts.fistF.getPosition();
  let best = null, bestD = maxDist;
  for (const w of weapons) {
    if (w.heldBy) continue;
    const p = w.body.getPosition();
    const d = Math.hypot(p.x - fist.x, p.y - fist.y);
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}

export function grabWeapon(world, doll, weapons) {
  if (!doll.alive || doll.held || doll.grabCd > 0) return null;
  const w = nearestFreeWeapon(doll, weapons, 1.4);
  if (!w) return null;
  const fist = doll.parts.fistF;
  const fp = fist.getPosition();
  // place grip near fist, blade extending along facing
  const ang = doll.face > 0 ? 0 : Math.PI;
  w.body.setTransform(Vec2(fp.x + doll.face * 0.15, fp.y), ang);
  w.body.setLinearVelocity(fist.getLinearVelocity());
  w.body.setAngularVelocity(0);
  const weld = world.createJoint(new WeldJoint({
    collideConnected: false,
    frequencyHz: 0, // rigid-ish
    dampingRatio: 0,
  }, fist, w.body, fp));
  w.weld = weld;
  w.heldBy = doll;
  doll.held = w;
  doll.grabCd = 0.35;
  return w;
}

export function throwWeapon(world, doll, { drop = false } = {}) {
  const w = doll.held;
  if (!w) return null;
  if (w.weld) { world.destroyJoint(w.weld); w.weld = null; }
  w.heldBy = null;
  doll.held = null;
  doll.throwCd = 0.4;
  w.hitCd = 0;
  if (!drop) {
    const dir = doll.face;
    const imp = w.def.throw;
    w.body.applyLinearImpulse({ x: dir * imp, y: 2.2 }, w.body.getWorldCenter(), true);
    w.body.applyAngularImpulse(dir * -0.8);
    // recoil
    doll.parts.torso.applyLinearImpulse({ x: -dir * 0.6, y: 0.2 }, doll.parts.torso.getWorldCenter(), true);
  }
  return w;
}

export function driveRagdoll(doll, intent, dt, world, weapons) {
  const {
    mx = 0, guard = false, jump = false, punch = false,
    grab = false, throwIt = false, drop = false,
  } = intent || {};
  if (doll.punchCd > 0) doll.punchCd -= dt;
  if (doll.jumpCd > 0) doll.jumpCd -= dt;
  if (doll.flinchT > 0) doll.flinchT -= dt;
  if (doll.grabCd > 0) doll.grabCd -= dt;
  if (doll.throwCd > 0) doll.throwCd -= dt;
  if (doll._impactCd > 0) doll._impactCd -= dt;
  if (doll.punchCd <= 0) doll._hitLatch = false;
  if (doll.held && doll.held.hitCd > 0) doll.held.hitCd -= dt;

  const J = doll.joints;
  if (!doll.alive) {
    for (const j of Object.values(J)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    if (doll.held && world) throwWeapon(world, doll, { drop: true });
    if (doll.limpT < 0.05) for (const b of Object.values(doll.parts)) b.setAngularDamping(0.08);
    doll.limpT += dt;
    return;
  }

  for (const j of Object.values(J)) j.enableMotor(true);

  const flinch = doll.flinchT > 0;
  const stiff = guard && !flinch ? 2.2 : 1;
  const softMul = flinch ? 0.08 : 1;
  const g = SOFT.gain * (guard && !flinch ? 1.4 : 1) * softMul;
  const st = doll._stance;

  setMotor(J.hipF, st.hipF + mx * 0.25, g, SOFT.hipT * stiff * softMul);
  setMotor(J.hipB, st.hipB - mx * 0.2, g, SOFT.hipT * stiff * softMul);
  setMotor(J.knF, st.knF, g * 1.1, SOFT.knT * stiff * softMul);
  setMotor(J.knB, st.knB, g * 1.1, SOFT.knT * stiff * softMul);
  setMotor(J.shF, guard && !flinch ? -1.2 : st.shF + Math.sin(performance.now() * 0.004 + doll.face) * 0.08, g * 0.9, SOFT.shT * stiff * softMul);
  setMotor(J.shB, guard && !flinch ? -1.0 : st.shB - Math.sin(performance.now() * 0.0035) * 0.08, g * 0.9, SOFT.shT * stiff * softMul);
  setMotor(J.elF, guard && !flinch ? 1.5 : st.elF, g, SOFT.elT * stiff * softMul);
  setMotor(J.elB, guard && !flinch ? 1.3 : st.elB, g, SOFT.elT * stiff * softMul);
  setMotor(J.neck, Math.sin(performance.now() * 0.002) * 0.15, g * 0.7, SOFT.neckT * softMul);
  setMotor(J.wrF, 0, g * 0.5, SOFT.wrT * softMul);
  setMotor(J.wrB, 0, g * 0.5, SOFT.wrT * softMul);

  const torso = doll.parts.torso;
  const v = torso.getLinearVelocity();
  const walk = mx * (guard ? 1.4 : 3.2);
  torso.applyForceToCenter({ x: (walk - v.x) * SOFT.walkK, y: 0 }, true);
  if (!flinch) {
    const ang = torso.getAngle();
    torso.applyTorque(-ang * SOFT.upright * stiff - torso.getAngularVelocity() * SOFT.uprightD);
  }
  if (Math.abs(mx) > 0.2) doll.face = mx > 0 ? 1 : -1;

  if (jump && doll.jumpCd <= 0) {
    const p = torso.getPosition();
    if (p.y < 1.7) {
      torso.applyLinearImpulse({ x: mx * 0.7, y: 4.8 }, torso.getWorldCenter(), true);
      setMotor(J.knF, 1.8, 20, 40); setMotor(J.knB, 1.8, 20, 40);
      doll.jumpCd = 0.55;
    }
  }

  if (grab && world && weapons) grabWeapon(world, doll, weapons);
  if ((throwIt || drop) && world && doll.held) throwWeapon(world, doll, { drop: !!drop && !throwIt });

  if (punch && doll.punchCd <= 0) {
    if (doll.held) swingWeapon(doll);
    else firePunch(doll);
    doll.punchCd = doll.held ? 0.42 : 0.36;
  }
}

function firePunch(doll) {
  const fist = doll.parts.fistF;
  const dir = doll.face;
  setMotor(doll.joints.shF, -2.2 * dir, 18, 55);
  setMotor(doll.joints.elF, 0.15, 16, 40);
  fist.applyLinearImpulse({ x: dir * 2.6, y: 0.45 }, fist.getWorldCenter(), true);
  doll.parts.uArmF.applyAngularImpulse(dir * -0.35);
  doll.parts.lArmF.applyAngularImpulse(dir * -0.2);
  doll.parts.torso.applyLinearImpulse({ x: dir * 0.4, y: 0.12 }, doll.parts.torso.getWorldCenter(), true);
  doll.parts.torso.applyForceToCenter({ x: dir * 70, y: 0 }, true);
}

function swingWeapon(doll) {
  const w = doll.held;
  if (!w) return;
  const dir = doll.face;
  setMotor(doll.joints.shF, -2.5 * dir, 22, 70);
  setMotor(doll.joints.elF, 0.1, 18, 50);
  w.body.applyAngularImpulse(dir * -1.6);
  w.body.applyLinearImpulse({ x: dir * 3.2, y: 0.8 }, w.body.getWorldCenter(), true);
  doll.parts.torso.applyLinearImpulse({ x: dir * 0.5, y: 0.15 }, doll.parts.torso.getWorldCenter(), true);
  w.hitCd = 0;
}

export function applyHit(doll, dmg) {
  if (!doll.alive) return false;
  doll.hp = Math.max(0, doll.hp - dmg);
  doll.flinchT = SOFT.flinchT;
  const torso = doll.parts.torso;
  torso.applyLinearImpulse({ x: (Math.random() - 0.5) * 1.6, y: 1.2 + dmg * 0.06 }, torso.getWorldCenter(), true);
  const spin = (b, s) => b.applyAngularImpulse((Math.random() - 0.5) * s);
  spin(doll.parts.head, 0.25);
  spin(doll.parts.uArmF, 0.55); spin(doll.parts.lArmF, 0.4);
  spin(doll.parts.uArmB, 0.5); spin(doll.parts.thighF, 0.35); spin(doll.parts.shinF, 0.3);
  spin(torso, 0.2);
  if (doll.hp <= 0) {
    doll.alive = false; doll.hp = 0;
    for (const j of Object.values(doll.joints)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    for (const b of Object.values(doll.parts)) b.setAngularDamping(0.08);
    torso.applyLinearImpulse({ x: (Math.random() - 0.5) * 2.5, y: 2.2 }, torso.getWorldCenter(), true);
    return true;
  }
  return false;
}

export function stepWorld(ctx, dt = DT) {
  ctx.events.length = 0;
  ctx.world.step(dt, 8, 3);
  for (const w of ctx.weapons || []) if (w.hitCd > 0) w.hitCd -= dt;
  return ctx.events.splice(0);
}

export function torsoPose(doll) {
  const p = doll.parts.torso.getPosition();
  return { x: p.x, y: p.y, angle: doll.parts.torso.getAngle(), alive: doll.alive, hp: doll.hp, maxHp: doll.maxHp, held: doll.held?.id || null };
}

export function snapshotParts(doll) {
  const out = {};
  for (const [name, body] of Object.entries(doll.parts)) {
    const p = body.getPosition();
    out[name] = { x: p.x, y: p.y, a: body.getAngle() };
  }
  return out;
}

export function snapshotWeapons(weapons) {
  return weapons.map((w) => {
    const p = w.body.getPosition();
    return { id: w.id, x: p.x, y: p.y, a: w.body.getAngle(), color: w.def.color, hx: w.def.hx, hy: w.def.hy, held: !!w.heldBy };
  });
}
