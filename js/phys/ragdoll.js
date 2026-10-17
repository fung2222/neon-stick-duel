// P0 physics spike — Planck.js 2D neon ragdoll (side-view). Pure sim, no Three.js.
// Units: metres, seconds. Ground at y = 0. Arena walls at ±ARENA.
import { World, Edge, Box, Circle, RevoluteJoint, Vec2 } from '../../vendor/planck/planck.mjs';

export const ARENA = 7.5;
export const DT = 1 / 60;
export const GRAVITY = -22;

const CAT = { GROUND: 0x0001, A: 0x0002, B: 0x0004, FIST_A: 0x0008, FIST_B: 0x0010 };
const MASK = {
  ground: CAT.A | CAT.B | CAT.FIST_A | CAT.FIST_B,
  bodyA: CAT.GROUND | CAT.B | CAT.FIST_B,
  bodyB: CAT.GROUND | CAT.A | CAT.FIST_A,
  fistA: CAT.GROUND | CAT.B,
  fistB: CAT.GROUND | CAT.A,
};

function boxBody(world, x, y, hx, hy, dens, filter, opts = {}) {
  const b = world.createBody({ type: 'dynamic', position: { x, y }, linearDamping: opts.ld ?? 0.4, angularDamping: opts.ad ?? 0.8, fixedRotation: !!opts.fixed });
  b.createFixture({ shape: new Box(hx, hy), density: dens, friction: opts.fric ?? 0.55, restitution: opts.rest ?? 0.05, filterCategoryBits: filter.cat, filterMaskBits: filter.mask });
  return b;
}
function circleBody(world, x, y, r, dens, filter, opts = {}) {
  const b = world.createBody({ type: 'dynamic', position: { x, y }, linearDamping: opts.ld ?? 0.35, angularDamping: opts.ad ?? 0.7 });
  b.createFixture({ shape: new Circle(r), density: dens, friction: opts.fric ?? 0.4, restitution: opts.rest ?? 0.08, filterCategoryBits: filter.cat, filterMaskBits: filter.mask });
  return b;
}

function joint(world, a, b, ax, ay, { lo, hi, motor = true, torque = 40, speed = 0 } = {}) {
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

  // proportions (half-extents / radii)
  const torsoH = 0.38, torsoW = 0.16;
  const headR = 0.16;
  const ua = { hx: 0.07, hy: 0.18 }, la = { hx: 0.06, hy: 0.16 };
  const th = { hx: 0.09, hy: 0.22 }, sh = { hx: 0.08, hy: 0.2 };
  const fistR = 0.09;

  const pelvisY = 0.95;
  const torso = boxBody(world, x0, pelvisY + torsoH, torsoW, torsoH, 3.2, bodyCat, { ad: 1.2 });
  const head = circleBody(world, x0, pelvisY + torsoH * 2 + headR + 0.02, headR, 1.0, bodyCat, { ad: 0.9 });

  const shY = pelvisY + torsoH * 2 - 0.04;
  const hipY = pelvisY;

  const uArmF = boxBody(world, x0 + f * 0.22, shY - ua.hy, ua.hx, ua.hy, 0.9, bodyCat);
  const lArmF = boxBody(world, x0 + f * 0.22, shY - ua.hy * 2 - la.hy, la.hx, la.hy, 0.7, bodyCat);
  const fistF = circleBody(world, x0 + f * 0.22, shY - ua.hy * 2 - la.hy * 2 - fistR, fistR, 0.55, fistCat, { rest: 0.15, fric: 0.7 });

  const uArmB = boxBody(world, x0 - f * 0.18, shY - ua.hy, ua.hx, ua.hy, 0.85, bodyCat);
  const lArmB = boxBody(world, x0 - f * 0.18, shY - ua.hy * 2 - la.hy, la.hx, la.hy, 0.65, bodyCat);
  const fistB = circleBody(world, x0 - f * 0.18, shY - ua.hy * 2 - la.hy * 2 - fistR, fistR, 0.5, fistCat, { rest: 0.12 });

  const thighF = boxBody(world, x0 + f * 0.08, hipY - th.hy, th.hx, th.hy, 1.6, bodyCat);
  const shinF = boxBody(world, x0 + f * 0.08, hipY - th.hy * 2 - sh.hy, sh.hx, sh.hy, 1.1, bodyCat);
  const thighB = boxBody(world, x0 - f * 0.08, hipY - th.hy, th.hx, th.hy, 1.6, bodyCat);
  const shinB = boxBody(world, x0 - f * 0.08, hipY - th.hy * 2 - sh.hy, sh.hx, sh.hy, 1.1, bodyCat);

  const j = {
    neck: joint(world, torso, head, x0, pelvisY + torsoH * 2, { lo: -0.55, hi: 0.55, torque: 18 }),
    shF: joint(world, torso, uArmF, x0 + f * 0.14, shY, { lo: -2.2, hi: 1.4, torque: 28 }),
    elF: joint(world, uArmF, lArmF, x0 + f * 0.22, shY - ua.hy * 2, { lo: -0.05, hi: 2.4, torque: 22 }),
    wrF: joint(world, lArmF, fistF, x0 + f * 0.22, shY - ua.hy * 2 - la.hy * 2, { lo: -0.8, hi: 0.8, torque: 10 }),
    shB: joint(world, torso, uArmB, x0 - f * 0.14, shY, { lo: -1.4, hi: 2.2, torque: 26 }),
    elB: joint(world, uArmB, lArmB, x0 - f * 0.18, shY - ua.hy * 2, { lo: -0.05, hi: 2.4, torque: 20 }),
    wrB: joint(world, lArmB, fistB, x0 - f * 0.18, shY - ua.hy * 2 - la.hy * 2, { lo: -0.8, hi: 0.8, torque: 10 }),
    hipF: joint(world, torso, thighF, x0 + f * 0.06, hipY, { lo: -1.5, hi: 0.9, torque: 55 }),
    knF: joint(world, thighF, shinF, x0 + f * 0.08, hipY - th.hy * 2, { lo: -0.05, hi: 2.3, torque: 40 }),
    hipB: joint(world, torso, thighB, x0 - f * 0.06, hipY, { lo: -1.5, hi: 0.9, torque: 55 }),
    knB: joint(world, thighB, shinB, x0 - f * 0.08, hipY - th.hy * 2, { lo: -0.05, hi: 2.3, torque: 40 }),
  };

  const parts = { torso, head, uArmF, lArmF, fistF, uArmB, lArmB, fistB, thighF, shinF, thighB, shinB };
  for (const [name, body] of Object.entries(parts)) {
    body.setUserData({ team, part: name, ragdoll: null });
  }

  const doll = {
    team, face: f, parts, joints: j, alive: true, hp: 100, maxHp: 100,
    punchCd: 0, jumpCd: 0, limpT: 0, color: team === 'a' ? 0x00e5ff : 0xff2bd6,
    _stance: { hipF: 0.15, hipB: -0.1, knF: 0.25, knB: 0.2, shF: -0.4, shB: 0.3, elF: 0.6, elB: 0.5 },
  };
  for (const body of Object.values(parts)) body.getUserData().ragdoll = doll;
  return doll;
}

export function makePhysWorld() {
  const world = new World({ gravity: { x: 0, y: GRAVITY } });
  const ground = world.createBody({ type: 'static' });
  ground.createFixture({ shape: new Edge({ x: -ARENA - 2, y: 0 }, { x: ARENA + 2, y: 0 }), friction: 0.85, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });
  // walls
  const wall = (x) => {
    const b = world.createBody({ type: 'static', position: { x, y: 3 } });
    b.createFixture({ shape: new Box(0.25, 4), friction: 0.4, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground });
  };
  wall(-ARENA - 0.3); wall(ARENA + 0.3);
  // soft ceiling so ragdolls don't fly forever
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
    if (speed < 3.5) return;
    const dmg = Math.min(22, 5 + Math.min(speed, 18) * 1.4);
    const tp = victim.parts.torso.getPosition();
    events.push({ type: 'hit', att: fist, def: victim, dmg, speed, part: victimUd.part, x: tp.x, y: tp.y });
    fist._hitLatch = true;
  });

  return { world, a, b, events, ground };
}

function setMotor(j, targetAngle, gain = 12, maxTorque) {
  if (!j) return;
  const ang = j.getJointAngle();
  j.setMotorSpeed((targetAngle - ang) * gain);
  if (maxTorque != null) j.setMaxMotorTorque(maxTorque);
}

/** Drive alive motors toward a stance; limp = motors off. */
export function driveRagdoll(doll, intent, dt) {
  const { mx = 0, guard = false, jump = false, punch = false } = intent || {};
  if (doll.punchCd > 0) doll.punchCd -= dt;
  if (doll.jumpCd > 0) doll.jumpCd -= dt;
  if (doll.punchCd <= 0) doll._hitLatch = false;

  const J = doll.joints;
  if (!doll.alive) {
    for (const j of Object.values(J)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    doll.limpT += dt;
    return;
  }

  for (const j of Object.values(J)) { j.enableMotor(true); }

  const stiff = guard ? 1.6 : 1;
  const st = doll._stance;
  setMotor(J.hipF, st.hipF + mx * 0.15, 14 * stiff, 70 * stiff);
  setMotor(J.hipB, st.hipB - mx * 0.12, 14 * stiff, 70 * stiff);
  setMotor(J.knF, st.knF, 16 * stiff, 55 * stiff);
  setMotor(J.knB, st.knB, 16 * stiff, 55 * stiff);
  setMotor(J.shF, guard ? -1.1 : st.shF, 10 * stiff, 35 * stiff);
  setMotor(J.shB, guard ? -0.9 : st.shB, 10 * stiff, 32 * stiff);
  setMotor(J.elF, guard ? 1.4 : st.elF, 12 * stiff, 28 * stiff);
  setMotor(J.elB, guard ? 1.2 : st.elB, 12 * stiff, 26 * stiff);
  setMotor(J.neck, 0, 8, 14);

  // walk: push torso horizontally
  const torso = doll.parts.torso;
  const v = torso.getLinearVelocity();
  const walk = mx * (guard ? 1.6 : 3.4);
  torso.applyForceToCenter({ x: (walk - v.x) * 18, y: 0 }, true);
  // upright torque on torso
  const ang = torso.getAngle();
  torso.applyTorque(-ang * 40 - torso.getAngularVelocity() * 6);

  // face foe direction for punches
  if (Math.abs(mx) > 0.2) doll.face = mx > 0 ? 1 : -1;

  if (jump && doll.jumpCd <= 0) {
    const p = torso.getPosition();
    if (p.y < 1.6) {
      torso.applyLinearImpulse({ x: mx * 0.8, y: 5.2 }, torso.getWorldCenter(), true);
      doll.jumpCd = 0.55;
    }
  }

  if (punch && doll.punchCd <= 0) {
    firePunch(doll);
    doll.punchCd = 0.38;
  }
}

function firePunch(doll) {
  const fist = doll.parts.fistF;
  const torso = doll.parts.torso;
  const dir = doll.face;
  // wind-up shoulder then impulse through fist
  setMotor(doll.joints.shF, -1.6 * dir, 40, 90);
  setMotor(doll.joints.elF, 0.2, 40, 80);
  const impulse = { x: dir * 2.4, y: 0.35 };
  fist.applyLinearImpulse(impulse, fist.getWorldCenter(), true);
  torso.applyLinearImpulse({ x: dir * 0.45, y: 0.1 }, torso.getWorldCenter(), true);
  // slight step-in
  torso.applyForceToCenter({ x: dir * 80, y: 0 }, true);
}

export function applyHit(doll, dmg) {
  if (!doll.alive) return false;
  doll.hp = Math.max(0, doll.hp - dmg);
  // flinch knock
  const torso = doll.parts.torso;
  torso.applyLinearImpulse({ x: (Math.random() - 0.5) * 1.2, y: 1.5 + dmg * 0.04 }, torso.getWorldCenter(), true);
  if (doll.hp <= 0) {
    doll.alive = false;
    doll.hp = 0;
    for (const j of Object.values(doll.joints)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    return true; // KO
  }
  return false;
}

export function stepWorld(ctx, dt = DT) {
  ctx.events.length = 0;
  ctx.world.step(dt, 8, 3);
  // flush contact events collected during step
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
