// DOM Elements
const inputs = {
  m1: document.getElementById("m1"),
  m2: document.getElementById("m2"),
  v1: document.getElementById("v1"),
  v2: document.getElementById("v2"),
  obj: document.getElementById("objectType"),
};

const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const slowBtn = document.getElementById("slowBtn");
const simArea = document.querySelector(".sim-arena");
const obj1El = document.getElementById("object1");
const obj2El = document.getElementById("object2");
const pBeforeEl = document.getElementById("pBefore");
const pAfterEl = document.getElementById("pAfter");
const conservedEl = document.getElementById("conserved");
const vaEl = document.getElementById("va");
const vbEl = document.getElementById("vb");
const stepsEl = document.getElementById("stepsText");
const directionsEl = document.getElementById("directions");
const dot1 = document.querySelector(".dot-obj1");
const dot2 = document.querySelector(".dot-obj2");
const label1 = obj1El ? obj1El.querySelector('.object-label') : null;
const label2 = obj2El ? obj2El.querySelector('.object-label') : null;
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const simStatusEl = document.getElementById("simStatus");
const collisionMsgEl = document.getElementById("collisionMsg");
const conclusionTextEl = document.getElementById("conclusionText");

// Simulation State
let animationId = null;
let slowMotion = false;
let collided = false;

const state = {
  m1: 1200,
  m2: 800,
  v1: 8,
  v2: -5,
  va: 0,
  vb: 0,
  x1: 40,
  x2: 0,
  width: 120,
  labelOffset: 10,
};

// Status Management
function updateSimStatus(status) {
  const statusText = {
    ready: "Ready",
    running: "Running",
    collision: "Collision!",
    complete: "Complete"
  };

  simStatusEl.textContent = statusText[status] || status;
  simStatusEl.className = `status-badge ${status}`;
}

// Collision Visual Effect
function createCollisionEffect(x, y) {
  const effect = document.createElement('div');
  effect.className = 'collision-effect';
  effect.style.left = `${x}px`;
  effect.style.top = `${y}px`;
  effect.style.transform = 'translate(-50%, -50%)';
  simArea.appendChild(effect);

  setTimeout(() => {
    effect.remove();
  }, 600);
}

function readInputs() {
  state.m1 = parseFloat(inputs.m1.value) || 0;
  state.m2 = parseFloat(inputs.m2.value) || 0;
  state.v1 = parseFloat(inputs.v1.value) || 0;
  state.v2 = parseFloat(inputs.v2.value) || 0;
}

function setObjectAppearance(type) {
  // Set the data-type attribute for SVG visibility
  obj1El.setAttribute('data-type', type);
  obj2El.setAttribute('data-type', type);

  // Update legend dot colors based on type
  const colors = {
    car: { c1: '#2e6bb5', c2: '#ea580c' },
    ball: { c1: '#0ea5e9', c2: '#f97316' },
    cart: { c1: '#6366f1', c2: '#f97316' },
    block: { c1: '#3b82f6', c2: '#f97316' }
  };

  const colorSet = colors[type] || colors.car;
  if (dot1 && dot2) {
    dot1.style.background = colorSet.c1;
    dot2.style.background = colorSet.c2;
  }

  // Change background based on object type
  if (type === 'car') {
    simArea.style.backgroundImage = 'url("images/road.jpg")';
  } else if (type === 'ball') {
    simArea.style.backgroundImage = 'url("images/court.jpg")';
  } else if (type === 'cart') {
    simArea.style.backgroundImage = 'url("images/box.jpg")';
  } else {
    simArea.style.backgroundImage = 'none';
    simArea.style.backgroundColor = '#1a1a2e';
  }
}

function computeElastic(m1, m2, u1, u2) {
  // 1-D elastic collision formulas conserving momentum and kinetic energy.
  const denom = m1 + m2 || 1; // avoid divide-by-zero if inputs are zero
  const va = ((m1 - m2) / denom) * u1 + ((2 * m2) / denom) * u2;
  const vb = ((2 * m1) / denom) * u1 + ((m2 - m1) / denom) * u2;
  return { va, vb };
}

function computeInelastic(m1, m2, u1, u2) {
  // Perfectly inelastic: objects stick together, share final velocity.
  const denom = m1 + m2 || 1;
  const vf = (m1 * u1 + m2 * u2) / denom;
  return { va: vf, vb: vf };
}

function momentum(m, v) {
  return m * v;
}

function getCollisionType() {
  return document.querySelector('input[name="collisionType"]:checked').value;
}

function updateCalculations(predictedOnly = false) {
  const { m1, m2, v1, v2, va, vb } = state;
  const pBefore = momentum(m1, v1) + momentum(m2, v2);
  const pAfter = momentum(m1, va) + momentum(m2, vb);
  const conserved = Math.abs(pBefore - pAfter) < 0.5; // Allow small floating point tolerance

  pBeforeEl.textContent = `${pBefore.toFixed(2)} kg·m/s`;
  pAfterEl.textContent = `${pAfter.toFixed(2)} kg·m/s`;
  conservedEl.textContent = conserved ? "YES ✓" : "NO ✗";
  conservedEl.style.background = conserved ? "#22c55e" : "#ef4444";
  vaEl.textContent = `${va.toFixed(2)} m/s`;
  vbEl.textContent = `${vb.toFixed(2)} m/s`;

  const dir1 = Math.abs(va) < 0.01 ? "Stationary" : va > 0 ? "Right →" : "Left ←";
  const dir2 = Math.abs(vb) < 0.01 ? "Stationary" : vb > 0 ? "Right →" : "Left ←";
  directionsEl.textContent = `${dir1} / ${dir2}`;

  const type = getCollisionType();
  const M = m1 + m2;

  // Calculate intermediate values for display
  const p1_before = m1 * v1;
  const p2_before = m2 * v2;
  const KE_before = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const KE_after = 0.5 * m1 * va * va + 0.5 * m2 * vb * vb;

  let steps;
  if (type === "elastic") {
    steps = [
      "ELASTIC COLLISION",
      "─────────────────────────",
      "",
      "Given:",
      `  m₁ = ${m1} kg    u₁ = ${v1} m/s`,
      `  m₂ = ${m2} kg    u₂ = ${v2} m/s`,
      "",
      "Initial Momentum:",
      `  p = m₁u₁ + m₂u₂`,
      `  p = (${m1})(${v1}) + (${m2})(${v2})`,
      `  p = ${pBefore.toFixed(2)} kg·m/s`,
      "",
      "Final Velocities:",
      `  v₁ = [(m₁-m₂)u₁ + 2m₂u₂] / (m₁+m₂)`,
      `     = ${va.toFixed(2)} m/s`,
      "",
      `  v₂ = [2m₁u₁ + (m₂-m₁)u₂] / (m₁+m₂)`,
      `     = ${vb.toFixed(2)} m/s`,
      "",
      "Final Momentum:",
      `  p = ${pAfter.toFixed(2)} kg·m/s`,
      "",
      conserved ? "✓ Momentum Conserved" : "✗ Check Values"
    ];
  } else {
    const vf = (m1 * v1 + m2 * v2) / M;
    steps = [
      "INELASTIC COLLISION",
      "─────────────────────────",
      "",
      "Given:",
      `  m₁ = ${m1} kg    u₁ = ${v1} m/s`,
      `  m₂ = ${m2} kg    u₂ = ${v2} m/s`,
      "",
      "Initial Momentum:",
      `  p = m₁u₁ + m₂u₂`,
      `  p = ${pBefore.toFixed(2)} kg·m/s`,
      "",
      "Final Velocity (combined):",
      `  v = (m₁u₁ + m₂u₂) / (m₁+m₂)`,
      `    = ${pBefore.toFixed(2)} / ${M}`,
      `    = ${vf.toFixed(2)} m/s`,
      "",
      "Final Momentum:",
      `  p = ${pAfter.toFixed(2)} kg·m/s`,
      "",
      "Energy Lost:",
      `  ΔKE = ${(KE_before - KE_after).toFixed(2)} J`,
      "",
      conserved ? "✓ Momentum Conserved" : "✗ Check Values"
    ];
  }

  stepsEl.textContent = steps.join("\n");

  // Generate conclusion
  if (!predictedOnly) {
    let conclusion = "";
    if (type === "elastic") {
      conclusion = `In this elastic collision, momentum was ${conserved ? "successfully conserved" : "not conserved (check inputs)"}. `;
      conclusion += `Object 1 changed from ${v1.toFixed(1)} m/s to ${va.toFixed(1)} m/s, while Object 2 changed from ${v2.toFixed(1)} m/s to ${vb.toFixed(1)} m/s. `;
      conclusion += `Both kinetic energy and momentum are conserved in elastic collisions, which is why the objects bounce off each other with calculated velocities.`;
    } else {
      const energyLoss = KE_before - KE_after;
      const energyPercent = ((energyLoss / KE_before) * 100).toFixed(1);
      conclusion = `In this inelastic collision, the objects stuck together and moved at ${va.toFixed(1)} m/s. `;
      conclusion += `Momentum was ${conserved ? "conserved" : "not conserved"} (${pBefore.toFixed(1)} → ${pAfter.toFixed(1)} kg·m/s), but `;
      conclusion += `${energyLoss.toFixed(1)} J of kinetic energy (${energyPercent}%) was lost, converted to heat, sound, and deformation.`;
    }
    conclusionTextEl.textContent = conclusion;
  } else {
    conclusionTextEl.textContent = "Run the simulation to see the analysis.";
  }

  // For pre-run preview, show predicted final velocities
  if (predictedOnly) {
    pAfterEl.textContent = "—";
    conservedEl.textContent = "--";
    conservedEl.style.background = "#64748b";
    directionsEl.textContent = "Ready. Press Start to simulate.";

    // Show preview calculations
    const previewSteps = type === "elastic" ? [
      "ELASTIC COLLISION",
      "─────────────────────────",
      "",
      "Given:",
      `  m₁ = ${m1} kg    u₁ = ${v1} m/s`,
      `  m₂ = ${m2} kg    u₂ = ${v2} m/s`,
      "",
      "Predicted:",
      `  v₁ = ${va.toFixed(2)} m/s`,
      `  v₂ = ${vb.toFixed(2)} m/s`,
      "",
      "Press Start to simulate."
    ] : [
      "INELASTIC COLLISION",
      "─────────────────────────",
      "",
      "Given:",
      `  m₁ = ${m1} kg    u₁ = ${v1} m/s`,
      `  m₂ = ${m2} kg    u₂ = ${v2} m/s`,
      "",
      "Predicted:",
      `  v = ${va.toFixed(2)} m/s (combined)`,
      "",
      "Press Start to simulate."
    ];
    stepsEl.textContent = previewSteps.join("\n");
  }

  updateLabels();
}

function resetObjects() {
  readInputs();
  setObjectAppearance(inputs.obj.value);

  // Ensure objects are visible
  obj1El.style.display = 'block';
  obj2El.style.display = 'block';
  obj1El.style.visibility = 'visible';
  obj2El.style.visibility = 'visible';
  obj1El.style.opacity = '1';
  obj2El.style.opacity = '1';

  // Get width based on object type
  const objType = inputs.obj.value;
  let objWidth = 120; // default for car
  if (objType === 'ball') objWidth = 80;
  else if (objType === 'cart') objWidth = 110;
  else if (objType === 'block') objWidth = 85;

  state.width = objWidth;
  state.x1 = 50;
  state.x2 = (simArea.clientWidth || 800) - state.width - 50;

  collided = false;
  slowMotion = false;
  if (slowBtn) slowBtn.classList.remove("active");
  cancelAnimationFrame(animationId);

  const type = getCollisionType();
  const { va, vb } =
    type === "elastic"
      ? computeElastic(state.m1, state.m2, state.v1, state.v2)
      : computeInelastic(state.m1, state.m2, state.v1, state.v2);
  state.va = va;
  state.vb = vb;

  obj1El.style.left = `${state.x1}px`;
  obj2El.style.left = `${state.x2}px`;

  updateCalculations(true);
  updateLabels();
}

function updateLabels() {
  const dirArrow = (v) => {
    if (Math.abs(v) < 0.01) return '<span class="velocity-arrow">●</span>';
    return v > 0 ? '<span class="velocity-arrow">→</span>' : '<span class="velocity-arrow">←</span>';
  };
  const formatVelocity = (v) => {
    const absV = Math.abs(v).toFixed(1);
    const sign = v >= 0 ? "+" : "-";
    return `${sign}${absV}`;
  };
  if (label1) {
    label1.innerHTML = `<div><strong>m₁</strong> = ${state.m1} kg</div><div><strong>v₁</strong> = ${formatVelocity(state.v1)} m/s ${dirArrow(state.v1)}</div>`;
  }
  if (label2) {
    label2.innerHTML = `<div><strong>m₂</strong> = ${state.m2} kg</div><div><strong>v₂</strong> = ${formatVelocity(state.v2)} m/s ${dirArrow(state.v2)}</div>`;
  }
}

function detectCollision() {
  return (
    state.x1 + state.width >= state.x2 &&
    state.x1 <= state.x2 + state.width
  );
}

function animate(timestamp) {
  const speedFactor = slowMotion ? 0.35 : 1;
  const dt = 0.016 * speedFactor;

  if (!collided) {
    updateSimStatus("running");
    state.x1 += state.v1 * dt * 30;
    state.x2 += state.v2 * dt * 30;

    if (detectCollision()) {
      collided = true;
      updateSimStatus("collision");

      // Calculate collision point
      const collisionX = (state.x1 + state.width + state.x2) / 2;
      const collisionY = simArea.clientHeight * 0.75;

      // Add collision visual effects
      obj1El.classList.add("colliding");
      obj2El.classList.add("colliding");
      createCollisionEffect(collisionX, collisionY);

      setTimeout(() => {
        obj1El.classList.remove("colliding");
        obj2El.classList.remove("colliding");
      }, 400);

      // After collision, apply final velocities
      state.v1 = state.va;
      state.v2 = state.vb;
      updateCalculations();

      // Show collision message
      if (collisionMsgEl) {
        collisionMsgEl.textContent = "💥 Collision Detected!";
        collisionMsgEl.style.color = "#ef4444";
        setTimeout(() => {
          collisionMsgEl.textContent = "✓ Simulation Complete";
          collisionMsgEl.style.color = "#22c55e";
          updateSimStatus("complete");
        }, 2000);
      }
    }
  } else {
    state.x1 += state.v1 * dt * 30;
    state.x2 += state.v2 * dt * 30;
  }

  // Bounds checking
  const minX = 0;
  const maxX = simArea.clientWidth - state.width;
  state.x1 = Math.min(Math.max(state.x1, minX), maxX);
  state.x2 = Math.min(Math.max(state.x2, minX), maxX);

  obj1El.style.left = `${state.x1}px`;
  obj2El.style.left = `${state.x2}px`;
  updateLabels();

  animationId = requestAnimationFrame(animate);
}

// Event Listeners
startBtn.addEventListener("click", () => {
  resetObjects();
  updateSimStatus("running");
  animationId = requestAnimationFrame(animate);
});

resetBtn.addEventListener("click", () => {
  resetObjects();
  updateSimStatus("ready");
});

if (slowBtn) {
  slowBtn.addEventListener("click", () => {
    slowMotion = !slowMotion;
    slowBtn.classList.toggle("active", slowMotion);
  });
}

inputs.obj.addEventListener("change", () => {
  setObjectAppearance(inputs.obj.value);
});

document.querySelectorAll('input[name="collisionType"]').forEach((radio) =>
  radio.addEventListener("change", () => {
    resetObjects();
  })
);

// Initial setup
window.addEventListener("resize", resetObjects);
window.addEventListener("load", () => {
  setTimeout(() => {
    resetObjects();
    updateSimStatus("ready");
  }, 100);
});
resetObjects();
updateSimStatus("ready");

