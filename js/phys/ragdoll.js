// P0 physics spike — Planck.js 2D neon ragdoll (side-view). Pure sim, no Three.js.
// Units: metres, seconds. Ground at y = 0. Arena walls at ±ARENA.
// Stick Fight–like rubbery joints: WIDE revolute limits + SOFT motors (limb silhouette / mesh sizes unchanged).
import { World, Edge, Box, Circle, RevoluteJoint, Vec2 } from '../../vendor/planck/planck.mjs';

export const ARENA = 7.5;
export const DT = 1 / 60;
export const GRAVITY = -20;

const CAT = { GROUND: 0x0001, A: 0x0002, B: 0x0004, FIST_A: 0x0008, FIST_B: 0x0010 };
const MASK = {
  ground: CAT.A | CAT.B | CAT.FIST_A | CAT.FIST_B,
  bodyA: CAT.GROUND | CAT.B | CAT.FIST_B,
  bodyB: CAT.GROUND | CAT.A | CAT.FIST_A,
  fistA: CAT.GROUND | CAT.B,
  fistB: CAT.GROUND | CAT.A,
};

// Soft “alive” motor gains / torques (Stick Fight–rubbery). Guard multiplies these.
const SOFT = {
  gain: 4.5,          // was ~12–16 — low = laggy rubbery follow
  hipT: 22, knT: 14,  // was 55–70 / 40–55
  shT: 10, elT: 8,    // was 28–35
  neckT: 5, wrT: 4,
  upright: 14,        // torso stand torque (was 40)
  uprightD: 2.5,      // angular damp on upright (was 6)
  walkK: 12,
  flinchT: 0.28,      // seconds motors go near-zero after a hit
};

function boxBody(world, x, y, hx, hy, dens, filter, opts = {}) {
  // Low angular damping → limbs keep swinging / flailing
  const b = world.createBody({
    type: 'dynamic', position: { x, y },
    linearDamping: opts.ld ?? 0.25,
    angularDamping: opts.ad ?? 0.22,
    fixedRotation: !!opts.fixed,
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
    linearDamping: opts.ld ?? 0.22,
    angularDamping: opts.ad ?? 0.18,
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
    enableLimit: lo != null && hi != null,
    lowerAngle: lo ?? 0,
    upperAngle: hi ?? 0,
    enableMotor: motor,
    maxMotorTorque: torque,
    motorSpeed: speed,
    collideConnected: false,
  }, a, b, { x: ax, y: ay }));
}

/** Build one neon stick ragdoll facing `face` (+1 right / -1 left) at pelvis x. */
export function makeRagdoll(world, x0, face, team /* 'a'|'b' */) {
  const f = face >= 0 ? 1 : -1;
  const bodyCat = team === 'a' ? { cat: CAT.A, mask: MASK.bodyA } : { cat: CAT.B, mask: MASK.bodyB };
  const fistCat = team === 'a' ? { cat: CAT.FIST_A, mask: MASK.fistA } : { cat: CAT.FIST_B, mask: MASK.fistB };

  // proportions (half-extents / radii) — DO NOT CHANGE (silhouette locked)
  const torsoH = 0.38, torsoW = 0.16;
  const headR = 0.16;
  const ua = { hx: 0.07, hy: 0.18 }, la = { hx: 0.06, hy: 0.16 };
  const th = { hx: 0.09, hy: 0.22 }, sh = { hx: 0.08, hy: 0.2 };
  const fistR = 0.09;

  const pelvisY = 0.95;
  const torso = boxBody(world, x0, pelvisY + torsoH, torsoW, torsoH, 2.8, bodyCat, { ad: 0.35 });
  const head = circleBody(world, x0, pelvisY + torsoH * 2 + headR + 0.02, headR, 0.85, bodyCat, { ad: 0.2 });

  const shY = pelvisY + torsoH * 2 - 0.04;
  const hipY = pelvisY;

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

  // WIDE angle limits — almost Stick Fight full flop (radians). Soft base torque only.
  const j = {
    neck: joint(world, torso, head, x0, pelvisY + torsoH * 2, { lo: -1.4, hi: 1.4, torque: SOFT.neckT }),
    // shoulders: nearly full windmill
    shF: joint(world, torso, uArmF, x0 + f * 0.14, shY, { lo: -2.9, hi: 2.9, torque: SOFT.shT }),
    elF: joint(world, uArmF, lArmF, x0 + f * 0.22, shY - ua.hy * 2, { lo: -0.15, hi: 2.85, torque: SOFT.elT }),
    wrF: joint(world, lArmF, fistF, x0 + f * 0.22, shY - ua.hy * 2 - la.hy * 2, { lo: -1.6, hi: 1.6, torque: SOFT.wrT }),
    shB: joint(world, torso, uArmB, x0 - f * 0.14, shY, { lo: -2.9, hi: 2.9, torque: SOFT.shT }),
    elB: joint(world, uArmB, lArmB, x0 - f * 0.18, shY - ua.hy * 2, { lo: -0.15, hi: 2.85, torque: SOFT.elT }),
    wrB: joint(world, lArmB, fistB, x0 - f * 0.18, shY - ua.hy * 2 - la.hy * 2, { lo: -1.6, hi: 1.6, torque: SOFT.wrT }),
    // hips: deep splits / backbend
    hipF: joint(world, torso, thighF, x0 + f * 0.06, hipY, { lo: -2.4, hi: 1.6, torque: SOFT.hipT }),
    knF: joint(world, thighF, shinF, x0 + f * 0.08, hipY - th.hy * 2, { lo: -0.1, hi: 2.7, torque: SOFT.knT }),
    hipB: joint(world, torso, thighB, x0 - f * 0.06, hipY, { lo: -2.4, hi: 1.6, torque: SOFT.hipT }),
    knB: joint(world, thighB, shinB, x0 - f * 0.08, hipY - th.hy * 2, { lo: -0.1, hi: 2.7, torque: SOFT.knT }),
  };

  const parts = { torso, head, uArmF, lArmF, fistF, uArmB, lArmB, fistB, thighF, shinF, thighB, shinB };
  for (const [name, body] of Object.entries(parts)) {
    body.setUserData({ team, part: name, ragdoll: null });
  }

  const doll = {
    team, face: f, parts, joints: j, alive: true, hp: 100, maxHp: 100,
    punchCd: 0, jumpCd: 0, limpT: 0, flinchT: 0,
    color: team === 'a' ? 0x00e5ff : 0xff2bd6,
    // loose idle pose targets (motors are soft so they won’t lock)
    _stance: { hipF: 0.2, hipB: -0.15, knF: 0.35, knB: 0.3, shF: -0.55, shB: 0.45, elF: 0.75, elB: 0.65 },
  };
  for (const body of Object.values(parts)) body.getUserData().ragdoll = doll;
  return doll;
}

export function makePhysWorld() {
  const world = new World({ gravity: { x: 0, y: GRAVITY } });
  const ground = world.createBody({ type: 'static' });
  ground.createFixture({ shape: new Edge({ x: -ARENA - 2, y: 0 }, { x: ARENA + 2, y: 0 }), friction: 0.85, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });
  const wall = (x) => {
    const b = world.createBody({ type: 'static', position: { x, y: 3 } });
    b.createFixture({ shape: new Box(0.25, 4), friction: 0.35, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });
  };
  wall(-ARENA - 0.3); wall(ARENA + 0.3);
  const ceil = world.createBody({ type: 'static', position: { x: 0, y: 7.2 } });
  ceil.createFixture({ shape: new Box(ARENA + 1, 0.2), filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });

  const a = makeRagdoll(world, -2.4, 1, 'a');
  const b = makeRagdoll(world, 2.4, -1, 'b');
  a.color = 0x00e5ff; b.color = 0xff2bd6;

  const events = [];
  world.on('begin-contact', (contact) => {
    const fa = contact.getFixtureA(), fb = contact.getFixtureB();
    const ua = fa.getBody().getUserData(), ub = fb.getBody().getUserData();
    if (!ua || !ub || !ua.ragdoll || !ub.ragdoll) return;
    if (ua.team === ub.team) return;
    const fistHit = (ua.part?.startsWith('fist') && !String(ub.part || '').startsWith('fist'))
      || (ub.part?.startsWith('fist') && !String(ua.part || '').startsWith('fist'));
    if (!fistHit) return;
    const fistUd = ua.part?.startsWith('fist') ? ua : ub;
    const victimUd = fistUd === ua ? ub : ua;
    const fist = fistUd.ragdoll, victim = victimUd.ragdoll;
    if (!fist.alive || !victim.alive) return;
    if (fist._hitLatch) return;
    const ba = fa.getBody(), bb = fb.getBody();
    const wv = Vec2.sub(ba.getLinearVelocity(), bb.getLinearVelocity());
    const speed = Math.hypot(wv.x, wv.y);
    if (speed < 3.2) return;
    const dmg = Math.min(22, 5 + Math.min(speed, 18) * 1.4);
    const tp = victim.parts.torso.getPosition();
    events.push({ type: 'hit', att: fist, def: victim, dmg, speed, part: victimUd.part, x: tp.x, y: tp.y });
    fist._hitLatch = true;
  });

  return { world, a, b, events, ground };
}

function setMotor(j, targetAngle, gain, maxTorque) {
  if (!j) return;
  const ang = j.getJointAngle();
  j.setMotorSpeed((targetAngle - ang) * gain);
  if (maxTorque != null) j.setMaxMotorTorque(maxTorque);
}

/** Drive alive motors toward a stance; limp = motors off. Soft = rubbery. */
export function driveRagdoll(doll, intent, dt) {
  const { mx = 0, guard = false, jump = false, punch = false } = intent || {};
  if (doll.punchCd > 0) doll.punchCd -= dt;
  if (doll.jumpCd > 0) doll.jumpCd -= dt;
  if (doll.flinchT > 0) doll.flinchT -= dt;
  if (doll.punchCd <= 0) doll._hitLatch = false;

  const J = doll.joints;
  if (!doll.alive) {
    for (const j of Object.values(J)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    // extra limp: bleed angular damping so KO keeps flopping
    if (doll.limpT < 0.05) {
      for (const b of Object.values(doll.parts)) b.setAngularDamping(0.08);
    }
    doll.limpT += dt;
    return;
  }

  for (const j of Object.values(J)) { j.enableMotor(true); }

  // Flinch window: motors almost off → limbs flail from hit impulse
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
  // soft upright — allow lean / wobble
  if (!flinch) {
    const ang = torso.getAngle();
    torso.applyTorque(-ang * SOFT.upright * stiff - torso.getAngularVelocity() * SOFT.uprightD);
  }

  if (Math.abs(mx) > 0.2) doll.face = mx > 0 ? 1 : -1;

  if (jump && doll.jumpCd <= 0) {
    const p = torso.getPosition();
    if (p.y < 1.7) {
      torso.applyLinearImpulse({ x: mx * 0.7, y: 4.8 }, torso.getWorldCenter(), true);
      // tuck knees a bit
      setMotor(J.knF, 1.8, 20, 40);
      setMotor(J.knB, 1.8, 20, 40);
      doll.jumpCd = 0.55;
    }
  }

  if (punch && doll.punchCd <= 0) {
    firePunch(doll);
    doll.punchCd = 0.36;
  }
}

function firePunch(doll) {
  const fist = doll.parts.fistF;
  const torso = doll.parts.torso;
  const dir = doll.face;
  // loose wind-up — soft motors let the arm whip
  setMotor(doll.joints.shF, -2.2 * dir, 18, 55);
  setMotor(doll.joints.elF, 0.15, 16, 40);
  fist.applyLinearImpulse({ x: dir * 2.6, y: 0.45 }, fist.getWorldCenter(), true);
  doll.parts.uArmF.applyAngularImpulse(dir * -0.35);
  doll.parts.lArmF.applyAngularImpulse(dir * -0.2);
  torso.applyLinearImpulse({ x: dir * 0.4, y: 0.12 }, torso.getWorldCenter(), true);
  torso.applyForceToCenter({ x: dir * 70, y: 0 }, true);
}

export function applyHit(doll, dmg) {
  if (!doll.alive) return false;
  doll.hp = Math.max(0, doll.hp - dmg);
  doll.flinchT = SOFT.flinchT;

  const torso = doll.parts.torso;
  const kick = 1.2 + dmg * 0.06;
  torso.applyLinearImpulse({ x: (Math.random() - 0.5) * 1.6, y: kick }, torso.getWorldCenter(), true);
  // spin limbs for rubbery flail (silhouette unchanged — only angular impulse)
  const spin = (b, s) => b.applyAngularImpulse((Math.random() - 0.5) * s);
  spin(doll.parts.head, 0.25);
  spin(doll.parts.uArmF, 0.55); spin(doll.parts.lArmF, 0.4); spin(doll.parts.fistF, 0.2);
  spin(doll.parts.uArmB, 0.5); spin(doll.parts.lArmB, 0.35);
  spin(doll.parts.thighF, 0.35); spin(doll.parts.shinF, 0.3);
  spin(doll.parts.thighB, 0.35); spin(doll.parts.shinB, 0.3);
  spin(torso, 0.2);

  if (doll.hp <= 0) {
    doll.alive = false;
    doll.hp = 0;
    for (const j of Object.values(doll.joints)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    for (const b of Object.values(doll.parts)) b.setAngularDamping(0.08);
    // KO launch flop
    torso.applyLinearImpulse({ x: (Math.random() - 0.5) * 2.5, y: 2.2 }, torso.getWorldCenter(), true);
    return true;
  }
  return false;
}

export function stepWorld(ctx, dt = DT) {
  ctx.events.length = 0;
  ctx.world.step(dt, 8, 3);
  return ctx.events.splice(0);
}

export function torsoPose(doll) {
  const p = doll.parts.torso.getPosition();
  return { x: p.x, y: p.y, angle: doll.parts.torso.getAngle(), alive: doll.alive, hp: doll.hp, maxHp: doll.maxHp };
}

export function snapshotParts(doll) {
  const out = {};
  for (const [name, body] of Object.entries(doll.parts)) {
    const p = body.getPosition();
    out[name] = { x: p.x, y: p.y, a: body.getAngle() };
  }
  return out;
}
