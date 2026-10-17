// PHYS P1 — Landfall-style active ragdoll (pose SM) + grab/throw + impact.
// Poses drive joint target angles; KO = soft limp. Limb mesh sizes unchanged.
import { World, Edge, Box, Circle, RevoluteJoint, WeldJoint, Vec2 } from '../../vendor/planck/planck.mjs';

export const ARENA = 7.5;
export const DT = 1 / 60;
export const GRAVITY = -18;

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

export const POSE = { STAND: 'stand', WALK: 'walk', PUNCH: 'punch', HIT: 'hit', KO: 'ko' };

export const SOFT = {
  // Pose motors: legs firm, arms softer; light upright assist; KO limp unlocks.
  gain: 14, hipT: 78, knT: 58, ankT: 44, shT: 38, elT: 32, neckT: 14, wrT: 10,
  upright: 48, uprightD: 14, walkK: 16, flinchT: 0.22,
  punchReach: 1.05, punchDmg: 16,
  // Kung-fu punch phases — long enough to READ on 30–60fps
  punchWindup: 0.32, punchThrust: 0.22, punchRecover: 0.20,
  balanceBoost: 1.6, walkHz: 2.4,
};

/** Base joint targets (Landfall-style active ragdoll poses). */
export const POSE_STAND = {
  hipF: 0.1, hipB: -0.06, knF: 0.28, knB: 0.25, ankF: 0.04, ankB: 0.04,
  // Raised guard — fists up, elbows bent (not hanging straight down)
  shF: -1.05, shB: -0.75, elF: 1.35, elB: 1.25, neck: 0, wrF: 0.05, wrB: 0.05,
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
    linearDamping: opts.ld ?? 0.35, angularDamping: opts.ad ?? 0.4, fixedRotation: !!opts.fixed,
  });
  b.createFixture({
    shape: new Box(hx, hy), density: dens,
    friction: opts.fric ?? 0.7, restitution: opts.rest ?? 0.02,
    filterCategoryBits: filter.cat, filterMaskBits: filter.mask,
  });
  return b;
}
function circleBody(world, x, y, r, dens, filter, opts = {}) {
  const b = world.createBody({
    type: 'dynamic', position: { x, y },
    linearDamping: opts.ld ?? 0.3, angularDamping: opts.ad ?? 0.35,
  });
  b.createFixture({
    shape: new Circle(r), density: dens,
    friction: opts.fric ?? 0.55, restitution: opts.rest ?? 0.02,
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

  // Silhouette sizes unchanged; mass shifted DOWN (heavy legs/feet, lighter head/arms).
  const torsoH = 0.38, torsoW = 0.16, headR = 0.16;
  const ua = { hx: 0.07, hy: 0.18 }, la = { hx: 0.06, hy: 0.16 };
  const th = { hx: 0.09, hy: 0.22 }, sh = { hx: 0.08, hy: 0.2 };
  const foot = { hx: 0.15, hy: 0.04 };
  const fistR = 0.14;
  const pelvisY = 0.95;

  const torso = boxBody(world, x0, pelvisY + torsoH, torsoW, torsoH, 2.8, bodyCat, { ad: 1.4, ld: 0.55, fric: 0.45 });
  const head = circleBody(world, x0, pelvisY + torsoH * 2 + headR + 0.02, headR, 0.55, bodyCat, { ad: 0.9, ld: 0.45 });
  const shY = pelvisY + torsoH * 2 - 0.04, hipY = pelvisY;

  // light arms (less alive chaos)
  const uArmF = boxBody(world, x0 + f * 0.22, shY - ua.hy, ua.hx, ua.hy, 0.55, bodyCat, { ad: 0.55 });
  const lArmF = boxBody(world, x0 + f * 0.22, shY - ua.hy * 2 - la.hy, la.hx, la.hy, 0.42, bodyCat, { ad: 0.55 });
  const fistF = circleBody(world, x0 + f * 0.22, shY - ua.hy * 2 - la.hy * 2 - fistR, fistR, 0.4, fistCat, { rest: 0.05, fric: 0.7, ad: 0.45 });
  const uArmB = boxBody(world, x0 - f * 0.18, shY - ua.hy, ua.hx, ua.hy, 0.5, bodyCat, { ad: 0.55 });
  const lArmB = boxBody(world, x0 - f * 0.18, shY - ua.hy * 2 - la.hy, la.hx, la.hy, 0.38, bodyCat, { ad: 0.55 });
  const fistB = circleBody(world, x0 - f * 0.18, shY - ua.hy * 2 - la.hy * 2 - fistR, fistR, 0.35, fistCat, { rest: 0.05, fric: 0.65, ad: 0.45 });

  // HEAVY legs + grippy feet (lower COM)
  const thighF = boxBody(world, x0 + f * 0.08, hipY - th.hy, th.hx, th.hy, 2.2, bodyCat, { ad: 1.15, ld: 0.5, fric: 0.95 });
  const shinF = boxBody(world, x0 + f * 0.08, hipY - th.hy * 2 - sh.hy, sh.hx, sh.hy, 1.8, bodyCat, { ad: 1.15, ld: 0.5, fric: 1.15 });
  const footF = boxBody(world, x0 + f * 0.12, 0.045, foot.hx, foot.hy, 2.0, bodyCat, { ad: 1.3, ld: 0.55, fric: 1.7, rest: 0 });
  const thighB = boxBody(world, x0 - f * 0.08, hipY - th.hy, th.hx, th.hy, 2.2, bodyCat, { ad: 1.15, ld: 0.5, fric: 0.95 });
  const shinB = boxBody(world, x0 - f * 0.08, hipY - th.hy * 2 - sh.hy, sh.hx, sh.hy, 1.8, bodyCat, { ad: 1.15, ld: 0.5, fric: 1.15 });
  const footB = boxBody(world, x0 - f * 0.04, 0.045, foot.hx, foot.hy, 2.0, bodyCat, { ad: 1.3, ld: 0.55, fric: 1.7, rest: 0 });

  // Alive: legs nearly locked. Arms keep Stick Fight range. KO widens legs.
  const j = {
    neck: joint(world, torso, head, x0, pelvisY + torsoH * 2, { lo: -0.85, hi: 0.85, torque: SOFT.neckT }),
    shF: joint(world, torso, uArmF, x0 + f * 0.14, shY, { lo: -2.7, hi: 2.7, torque: SOFT.shT }),
    elF: joint(world, uArmF, lArmF, x0 + f * 0.22, shY - ua.hy * 2, { lo: -0.08, hi: 2.7, torque: SOFT.elT }),
    wrF: joint(world, lArmF, fistF, x0 + f * 0.22, shY - ua.hy * 2 - la.hy * 2, { lo: -1.3, hi: 1.3, torque: SOFT.wrT }),
    shB: joint(world, torso, uArmB, x0 - f * 0.14, shY, { lo: -2.7, hi: 2.7, torque: SOFT.shT }),
    elB: joint(world, uArmB, lArmB, x0 - f * 0.18, shY - ua.hy * 2, { lo: -0.08, hi: 2.7, torque: SOFT.elT }),
    wrB: joint(world, lArmB, fistB, x0 - f * 0.18, shY - ua.hy * 2 - la.hy * 2, { lo: -1.3, hi: 1.3, torque: SOFT.wrT }),
    hipF: joint(world, torso, thighF, x0 + f * 0.06, hipY, { lo: -1.05, hi: 0.7, torque: SOFT.hipT }),
    knF: joint(world, thighF, shinF, x0 + f * 0.08, hipY - th.hy * 2, { lo: 0.05, hi: 1.65, torque: SOFT.knT }),
    ankF: joint(world, shinF, footF, x0 + f * 0.08, 0.085, { lo: -0.4, hi: 0.5, torque: SOFT.ankT }),
    hipB: joint(world, torso, thighB, x0 - f * 0.06, hipY, { lo: -1.05, hi: 0.7, torque: SOFT.hipT }),
    knB: joint(world, thighB, shinB, x0 - f * 0.08, hipY - th.hy * 2, { lo: 0.05, hi: 1.65, torque: SOFT.knT }),
    ankB: joint(world, shinB, footB, x0 - f * 0.08, 0.085, { lo: -0.4, hi: 0.5, torque: SOFT.ankT }),
  };

  const parts = { torso, head, uArmF, lArmF, fistF, uArmB, lArmB, fistB, thighF, shinF, footF, thighB, shinB, footB };
  for (const [name, body] of Object.entries(parts)) body.setUserData({ team, part: name, ragdoll: null, kind: 'limb' });

  const doll = {
    team, face: f, parts, joints: j, alive: true, hp: 100, maxHp: 100,
    punchCd: 0, punchActive: 0, punchPhase: null, punchPhaseT: 0, jumpCd: 0, limpT: 0, flinchT: 0, grabCd: 0, throwCd: 0,
    held: null, color: team === 'a' ? 0x00e5ff : 0xff2bd6,
    pose: POSE.STAND, poseT: 0, walkPhase: 0,
    _stance: { ...POSE_STAND },
    _impactCd: 0, _limitsLocked: true,
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
    friction: 1.45, filterCategoryBits: CAT.GROUND, filterMaskBits: MASK.ground,
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
        const active = fist.punchActive > 0;
        const minSp = active ? 1.2 : 4.5;  // only easy hits during punch window
        if (speed >= minSp || (active && speed >= 0.4)) {
          const dmg = active ? SOFT.punchDmg : Math.min(14, 3 + Math.min(speed, 14));
          const tp = victim.parts.torso.getPosition();
          const fp = (fistUd === ua ? ba : bb).getPosition();
          events.push({ type: 'hit', kind: 'punch', att: fist, def: victim, dmg, speed, x: fp.x, y: fp.y, solid: true });
          fist._hitLatch = true;
          fist.punchActive = 0;
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
      const minSp = env.kind === 'wall' ? 5.0 : 8.8;
      if (speed < minSp) return;
      // feet/shins planting don't count as slam
      if (part?.startsWith('foot') || part?.startsWith('shin')) return;
      const dmg = Math.min(30, (speed - minSp * 0.4) * 2.0 * mul);
      if (dmg < 4) return;
      const p = body.getPosition();
      events.push({ type: 'hit', kind: 'impact', att: null, def: doll, dmg, speed, part, x: p.x, y: p.y, env: env.kind });
      doll._impactCd = 0.35;
    }
  });

  return { world, a, b, weapons, events, ground };
}

function setMotor(j, targetAngle, gain, maxTorque, maxSpeed = 14) {
  if (!j) return;
  const ang = j.getJointAngle();
  let spd = (targetAngle - ang) * gain;
  if (maxSpeed != null && Math.abs(spd) > maxSpeed) spd = Math.sign(spd) * maxSpeed;
  j.setMotorSpeed(spd);
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


function walkPoseTargets(phase, face) {
  // Alternate legs via sine; opposite arm swing. phase in radians.
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const liftF = Math.max(0, -s);
  const liftB = Math.max(0, s);
  return {
    hipF: POSE_STAND.hipF + s * 0.38,
    hipB: POSE_STAND.hipB - s * 0.38,
    knF: POSE_STAND.knF + liftF * 0.55 + 0.04,
    knB: POSE_STAND.knB + liftB * 0.55 + 0.04,
    ankF: POSE_STAND.ankF - s * 0.12,
    ankB: POSE_STAND.ankB + s * 0.12,
    shF: POSE_STAND.shF - s * 0.35 * face,
    shB: POSE_STAND.shB + s * 0.3 * face,
    elF: POSE_STAND.elF + liftB * 0.15,
    elB: POSE_STAND.elB + liftF * 0.15,
    neck: 0, wrF: 0, wrB: 0,
  };
}

/** Kung-fu punch: windup (chamber) → thrust (extend) → recover.
 *  Targets are EXAGGERATED so chamber/thrust read clearly in silhouette. */
function punchPoseTargets(face, phase = 'thrust') {
  const f = face || 1;
  const base = {
    ...POSE_STAND,
    hipF: POSE_STAND.hipF + 0.06,
    hipB: POSE_STAND.hipB - 0.03,
    knF: POSE_STAND.knF + 0.1,
    knB: POSE_STAND.knB + 0.06,
    // off-hand stays in high guard
    shB: -1.1,
    elB: 1.55,
    neck: -0.05 * f,
    wrF: 0, wrB: 0,
  };
  if (phase === 'windup') {
    // CHAMBER: lead fist pulls BACK behind torso, elbow cocked (readable silhouette)
    // Joint map (face+1): negative sh ⇒ fist behind; high el ⇒ bent.
    return {
      ...base,
      hipF: base.hipF - 0.06 * f,
      shF: -1.9 * f,    // clearly behind torso
      elF: 2.25,        // cocked (limit 2.7)
      wrF: 0.25,
      neck: 0.15 * f,
      shB: -1.15,
      elB: 1.55,
    };
  }
  if (phase === 'recover') {
    return {
      ...base,
      shF: POSE_STAND.shF,
      elF: POSE_STAND.elF,
      shB: POSE_STAND.shB,
      elB: POSE_STAND.elB,
      neck: 0,
    };
  }
  // THRUST: lead arm snaps FORWARD toward foe, elbow opens
  // Joint map (face+1): positive sh ⇒ fist forward/right.
  return {
    ...base,
    hipF: base.hipF + 0.1,
    shF: 2.25 * f,    // forward reach
    elF: 0.15,        // nearly straight
    wrF: -0.15,
    neck: -0.15 * f,
    shB: -0.75,
    elB: 1.35,
  };
}

function hitPoseTargets(face) {
  return {
    hipF: 0.35, hipB: 0.2, knF: 0.7, knB: 0.65, ankF: 0.1, ankB: 0.1,
    shF: 0.6 * face, shB: -0.4 * face, elF: 1.1, elB: 1.0,
    neck: 0.25 * face, wrF: 0.2, wrB: -0.2,
  };
}

function resolvePose(doll, intent) {
  if (!doll.alive) return POSE.KO;
  if (doll.flinchT > 0) return POSE.HIT;
  if (doll.punchPhase || doll.punchActive > 0) return POSE.PUNCH;
  if (Math.abs(intent.mx || 0) > 0.18) return POSE.WALK;
  return POSE.STAND;
}

function poseTargets(doll, intent) {
  const face = doll.face || 1;
  switch (doll.pose) {
    case POSE.WALK: return walkPoseTargets(doll.walkPhase, face);
    case POSE.PUNCH: return punchPoseTargets(face, doll.punchPhase || 'thrust');
    case POSE.HIT: return hitPoseTargets(face);
    case POSE.STAND:
    default: {
      const st = { ...POSE_STAND };
      if (intent.guard) {
        st.shF = -1.4; st.shB = -1.25; st.elF = 1.7; st.elB = 1.55;
        st.hipF = 0.16; st.hipB = 0.05; st.knF = 0.4; st.knB = 0.38;
      }
      return st;
    }
  }
}

export function driveRagdoll(doll, intent, dt, world, weapons, foe = null) {
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
  // Advance kung-fu punch phases: windup → thrust → recover → done
  if (doll.punchPhase) {
    doll.punchPhaseT += dt;
    const w = SOFT.punchWindup, th = SOFT.punchThrust, r = SOFT.punchRecover;
    if (doll.punchPhase === 'windup' && doll.punchPhaseT >= w) {
      doll.punchPhase = 'thrust';
      doll.punchPhaseT = 0;
      doll.punchActive = th; // hit window = thrust only
      doll._hitLatch = false;
      thrustPunchImpulse(doll);
    } else if (doll.punchPhase === 'thrust' && doll.punchPhaseT >= th) {
      doll.punchPhase = 'recover';
      doll.punchPhaseT = 0;
      doll.punchActive = 0;
    } else if (doll.punchPhase === 'recover' && doll.punchPhaseT >= r) {
      doll.punchPhase = null;
      doll.punchPhaseT = 0;
      doll.punchActive = 0;
    } else if (doll.punchPhase === 'thrust') {
      doll.punchActive = Math.max(0, th - doll.punchPhaseT);
    }
  } else {
    doll.punchActive = 0;
  }
  if (doll.punchCd <= 0 && !doll.punchPhase) doll._hitLatch = false;
  if (doll.held && doll.held.hitCd > 0) doll.held.hitCd -= dt;
  doll.poseT += dt;

  const J = doll.joints;
  if (!doll.alive) {
    doll.pose = POSE.KO;
    for (const j of Object.values(J)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    if (doll._limitsLocked) {
      doll._limitsLocked = false;
      for (const key of ['hipF', 'hipB']) if (J[key]?.setLimits) J[key].setLimits(-2.5, 1.8);
      for (const key of ['knF', 'knB']) if (J[key]?.setLimits) J[key].setLimits(-0.1, 2.7);
      for (const key of ['ankF', 'ankB']) if (J[key]?.setLimits) J[key].setLimits(-1.2, 1.2);
      for (const b of Object.values(doll.parts)) b.setAngularDamping(0.08);
    }
    if (doll.held && world) throwWeapon(world, doll, { drop: true });
    doll.limpT += dt;
    return;
  }

  // Face foe / move dir before pose (punch targets use face)
  if (foe && foe.alive) {
    const fx = foe.parts.torso.getPosition().x, mx0 = doll.parts.torso.getPosition().x;
    if (Math.abs(fx - mx0) > 0.15) doll.face = fx > mx0 ? 1 : -1;
  } else if (Math.abs(mx) > 0.2) doll.face = mx > 0 ? 1 : -1;

  // Start punch → windup → thrust → recover (or weapon swing)
  if (punch && doll.punchCd <= 0 && doll.flinchT <= 0 && !doll.punchPhase) {
    if (doll.held) {
      swingWeapon(doll, foe);
      doll.punchCd = 0.4;
    } else {
      firePunch(doll, foe);
      doll.punchCd = SOFT.punchWindup + SOFT.punchThrust + SOFT.punchRecover + 0.06;
    }
  }

  const prev = doll.pose;
  doll.pose = resolvePose(doll, { mx, guard });
  if (doll.pose !== prev) doll.poseT = 0;

  if (doll.pose === POSE.WALK) {
    const spd = Math.min(1.35, 0.55 + Math.abs(mx));
    doll.walkPhase += dt * Math.PI * 2 * SOFT.walkHz * spd;
  } else if (doll.pose === POSE.STAND) {
    // ease phase toward rest so legs don't snap
    doll.walkPhase *= Math.max(0, 1 - dt * 4);
  }

  for (const j of Object.values(J)) j.enableMotor(true);

  const flinch = doll.pose === POSE.HIT;
  const stiff = guard && !flinch ? 2.0 : 1;
  const softMul = flinch ? 0.12 : 1;
  const g = SOFT.gain * (guard && !flinch ? 1.3 : 1) * softMul;
  const targets = poseTargets(doll, { mx, guard });
  doll._stance = targets;

  const legG = g * 1.35;
  const legT = stiff * softMul;
  const punching = doll.pose === POSE.PUNCH;
  const thrusting = doll.punchPhase === 'thrust';
  const winding = doll.punchPhase === 'windup';
  // Firm but solver-safe — too much torque blows the elbow past limits
  // Arm drive: moderate gain + speed cap so exaggerated targets arrive without blowing joints
  const armG = g * (thrusting ? 1.15 : winding ? 1.25 : punching ? 1.05 : 0.95);
  const armT = stiff * softMul * (thrusting ? 1.7 : winding ? 1.8 : punching ? 1.3 : 1);
  const armSpd = thrusting ? 14 : winding ? 11 : 9;

  setMotor(J.hipF, targets.hipF, legG, SOFT.hipT * legT);
  setMotor(J.hipB, targets.hipB, legG, SOFT.hipT * legT);
  setMotor(J.knF, targets.knF, legG, SOFT.knT * legT);
  setMotor(J.knB, targets.knB, legG, SOFT.knT * legT);
  if (J.ankF) setMotor(J.ankF, targets.ankF, legG, SOFT.ankT * legT);
  if (J.ankB) setMotor(J.ankB, targets.ankB, legG, SOFT.ankT * legT);
  setMotor(J.shF, targets.shF, armG, SOFT.shT * armT, armSpd);
  setMotor(J.shB, targets.shB, g * 0.9, SOFT.shT * stiff * softMul, armSpd);
  setMotor(J.elF, targets.elF, armG, SOFT.elT * armT, armSpd);
  setMotor(J.elB, targets.elB, g * 0.9, SOFT.elT * stiff * softMul, armSpd);
  setMotor(J.neck, targets.neck ?? 0, g, SOFT.neckT * softMul);
  setMotor(J.wrF, targets.wrF ?? 0, g * 0.5, SOFT.wrT * softMul);
  setMotor(J.wrB, targets.wrB ?? 0, g * 0.5, SOFT.wrT * softMul);

  const torso = doll.parts.torso;
  const v = torso.getLinearVelocity();
  const walk = mx * (guard ? 1.0 : 2.3);
  torso.applyForceToCenter({ x: (walk - v.x) * SOFT.walkK, y: 0 }, true);

  // Light upright assist (Landfall-ish — pose does most of the standing)
  if (!flinch) {
    const ang = torso.getAngle();
    const av = torso.getAngularVelocity();
    const lean = Math.min(1, Math.abs(ang) / 0.45);
    const boost = 1 + lean * (SOFT.balanceBoost - 1);
    torso.applyTorque(-ang * SOFT.upright * stiff * boost - av * SOFT.uprightD * boost);
    if (Math.abs(av) > 12) torso.setAngularVelocity(Math.sign(av) * 12);
  }

  if (jump && doll.jumpCd <= 0) {
    const p = torso.getPosition();
    if (p.y < 1.7) {
      torso.applyLinearImpulse({ x: mx * 0.7, y: 4.8 }, torso.getWorldCenter(), true);
      setMotor(J.knF, 1.5, 18, 48); setMotor(J.knB, 1.5, 18, 48);
      doll.jumpCd = 0.55;
    }
  }

  if (grab && world && weapons) grabWeapon(world, doll, weapons);
  if ((throwIt || drop) && world && doll.held) throwWeapon(world, doll, { drop: !!drop && !throwIt });
}

function firePunch(doll, foe = null) {
  // Face foe, then chamber (windup). Thrust impulse fires when phase advances.
  if (foe && foe.alive) {
    const dx = foe.parts.torso.getPosition().x - doll.parts.torso.getPosition().x;
    if (Math.abs(dx) > 0.1) doll.face = Math.sign(dx);
  }
  doll.punchPhase = 'windup';
  doll.punchPhaseT = 0;
  doll.punchActive = 0; // no hit until thrust
  doll.pose = POSE.PUNCH;
  doll.poseT = 0;
  doll._hitLatch = false;
  doll._punchAimY = 0.25;
  if (foe && foe.alive) {
    const fp = doll.parts.fistF.getPosition();
    const tp = foe.parts.torso.getPosition();
    const dy = tp.y - fp.y;
    const len = Math.hypot(tp.x - fp.x, dy) || 1;
    doll._punchAimY = Math.max(-0.15, Math.min(0.7, dy / len));
  }
}

/** Snap fist forward at windup→thrust (kung-fu extension). */
function thrustPunchImpulse(doll) {
  const dir = doll.face || 1;
  const aimY = doll._punchAimY ?? 0.25;
  const fist = doll.parts.fistF;
  doll.parts.torso.applyLinearImpulse({ x: dir * 0.18, y: 0.02 }, doll.parts.torso.getWorldCenter(), true);
  fist.applyLinearImpulse({ x: dir * 1.6, y: aimY * 0.7 }, fist.getWorldCenter(), true);
  doll.parts.uArmF.applyLinearImpulse({ x: dir * 0.4, y: aimY * 0.15 }, doll.parts.uArmF.getWorldCenter(), true);
  doll.parts.lArmF.applyLinearImpulse({ x: dir * 0.45, y: aimY * 0.18 }, doll.parts.lArmF.getWorldCenter(), true);
}

function swingWeapon(doll, foe = null) {
  const w = doll.held;
  if (!w) return;
  let dir = doll.face;
  if (foe && foe.alive) {
    const dx = foe.parts.torso.getPosition().x - doll.parts.torso.getPosition().x;
    if (Math.abs(dx) > 0.1) { dir = Math.sign(dx); doll.face = dir; }
  }
  doll.pose = POSE.PUNCH;
  doll.poseT = 0;
  doll.punchPhase = 'thrust';
  doll.punchPhaseT = 0;
  w.body.applyAngularImpulse(dir * -1.6);
  w.body.applyLinearImpulse({ x: dir * 3.2, y: 0.6 }, w.body.getWorldCenter(), true);
  doll.parts.torso.applyLinearImpulse({ x: dir * 0.2, y: 0.05 }, doll.parts.torso.getWorldCenter(), true);
  w.hitCd = 0;
  doll.punchActive = SOFT.punchThrust;
}

/** Distance probe so punches connect even if Box2D contact is fussy. */
export function probeMeleeHits(ctx) {
  const out = [];
  for (const [att, def] of [[ctx.a, ctx.b], [ctx.b, ctx.a]]) {
    if (!att?.alive || !def?.alive || att.held || att._hitLatch) continue;
    if (!(att.punchActive > 0)) continue;
    const fist = att.parts.fistF.getPosition();
    const torso = def.parts.torso.getPosition();
    const head = def.parts.head.getPosition();
    const dT = Math.hypot(fist.x - torso.x, fist.y - torso.y);
    const dH = Math.hypot(fist.x - head.x, fist.y - head.y);
    const reach = SOFT.punchReach;
    if (dT <= reach || dH <= reach * 0.9) {
      out.push({
        type: 'hit', kind: 'punch', att, def, dmg: SOFT.punchDmg, speed: 8,
        x: fist.x, y: fist.y, solid: true, probe: true,
      });
      att._hitLatch = true;
      att.punchActive = 0;
    }
  }
  return out;
}

export function applyHit(doll, dmg, fromX = null) {
  if (!doll.alive) return false;
  doll.hp = Math.max(0, doll.hp - dmg);
  doll.flinchT = SOFT.flinchT;
  doll.pose = POSE.HIT;
  doll.poseT = 0;
  doll.punchActive = 0;
  doll.punchPhase = null;
  doll.punchPhaseT = 0;
  const torso = doll.parts.torso;
  const tx = torso.getPosition().x;
  const kdir = fromX != null ? Math.sign(tx - fromX) || doll.face : doll.face;
  // directed knockback — little random spin while alive (readable hits)
  torso.applyLinearImpulse({ x: kdir * (2.2 + dmg * 0.08), y: 1.4 + dmg * 0.05 }, torso.getWorldCenter(), true);
  doll.parts.head.applyLinearImpulse({ x: kdir * 0.4, y: 0.3 }, doll.parts.head.getWorldCenter(), true);
  if (doll.hp <= 0) {
    doll.alive = false; doll.hp = 0;
    doll.pose = POSE.KO;
    for (const j of Object.values(doll.joints)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
    for (const b of Object.values(doll.parts)) b.setAngularDamping(0.08);
    // KO flop may flail
    const spin = (b, s) => b.applyAngularImpulse((Math.random() - 0.5) * s);
    spin(doll.parts.uArmF, 0.6); spin(doll.parts.uArmB, 0.5); spin(doll.parts.thighF, 0.4); spin(torso, 0.35);
    torso.applyLinearImpulse({ x: kdir * 2.8, y: 2.4 }, torso.getWorldCenter(), true);
    return true;
  }
  return false;
}

export function stepWorld(ctx, dt = DT) {
  ctx.events.length = 0;
  ctx.world.step(dt, 12, 4);
  for (const w of ctx.weapons || []) if (w.hitCd > 0) w.hitCd -= dt;
  const contact = ctx.events.splice(0);
  const probed = probeMeleeHits(ctx);
  return contact.concat(probed);
}

export function torsoPose(doll) {
  const p = doll.parts.torso.getPosition();
  return { x: p.x, y: p.y, angle: doll.parts.torso.getAngle(), alive: doll.alive, hp: doll.hp, maxHp: doll.maxHp, held: doll.held?.id || null, pose: doll.pose, punchPhase: doll.punchPhase };
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
