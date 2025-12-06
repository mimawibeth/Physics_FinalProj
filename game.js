// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Physics Constants
const FRICTION = 0.98; // Friction coefficient (slows down marbles)
const RESTITUTION = 0.8; // Bounce coefficient (elasticity)
const MIN_VELOCITY = 0.1; // Minimum velocity threshold

// Arena variables (will be updated on resize)
let ARENA_CENTER_X = 400;
let ARENA_CENTER_Y = 400;
let ARENA_RADIUS = 350;

// Calculate responsive canvas size
function resizeCanvas() {
    const container = canvas.parentElement;
    const maxSize = Math.min(
        container.clientWidth - 40,  // Account for padding
        container.clientHeight - 60,  // Account for padding and hint
        window.innerHeight - 150      // Account for header
    );
    const size = Math.max(400, Math.min(700, maxSize)); // Min 400, Max 700
    canvas.width = size;
    canvas.height = size;
    
    // Update arena center and radius (proportional to canvas size)
    // Make sure arena fits within canvas with some padding
    ARENA_CENTER_X = canvas.width / 2;
    ARENA_CENTER_Y = canvas.height / 2;
    ARENA_RADIUS = Math.min(canvas.width, canvas.height) / 2 - 50; // Leave 50px padding
    
    // Reinitialize if game is running
    if (striker) {
        initGame();
    }
}

// Resize on load and window resize
window.addEventListener('resize', resizeCanvas);

// Initialize canvas after page loads
window.addEventListener('load', () => {
    resizeCanvas();
    // Start game loop (but don't initialize game until start button is clicked)
    gameLoop();
});

// Game State
let gameState = {
    score: 0,
    enemiesLeft: 5,
    gameOver: false,
    strikerReady: true
};

// Marble Class
class Marble {
    constructor(x, y, radius, color, mass, isStriker = false) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.mass = mass;
        this.vx = 0; // Velocity X
        this.vy = 0; // Velocity Y
        this.isStriker = isStriker;
        this.isOut = false;
    }

    // Draw the marble
    draw() {
        if (this.isOut) return;

        ctx.save();
        
        // Shadow
        ctx.beginPath();
        ctx.arc(this.x, this.y + 2, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
        
        // Main marble
        const gradient = ctx.createRadialGradient(
            this.x - this.radius * 0.3,
            this.y - this.radius * 0.3,
            0,
            this.x,
            this.y,
            this.radius
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.darkenColor(this.color, 0.3));
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Highlight
        ctx.beginPath();
        ctx.arc(
            this.x - this.radius * 0.3,
            this.y - this.radius * 0.3,
            this.radius * 0.4,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        
        // Striker indicator - gaming style glow
        if (this.isStriker) {
            ctx.strokeStyle = '#FF6B35'; // Gaming orange-red
            ctx.lineWidth = 4;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#FF6B35';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        ctx.restore();
    }

    // Helper to darken color
    darkenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Update marble position based on velocity
    update() {
        if (this.isOut) return;

        // Apply friction (reduces velocity)
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        // Update position based on velocity
        this.x += this.vx;
        this.y += this.vy;

        // Stop very slow marbles
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed < MIN_VELOCITY) {
            this.vx = 0;
            this.vy = 0;
        }

        // Check arena boundaries (circular)
        const dx = this.x - ARENA_CENTER_X;
        const dy = this.y - ARENA_CENTER_Y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // For striker: keep it in the arena with bouncing
        if (this.isStriker && distance + this.radius > ARENA_RADIUS) {
            // Push striker back into arena
            const angle = Math.atan2(dy, dx);
            this.x = ARENA_CENTER_X + Math.cos(angle) * (ARENA_RADIUS - this.radius);
            this.y = ARENA_CENTER_Y + Math.sin(angle) * (ARENA_RADIUS - this.radius);

            // Bounce with restitution
            const normalX = Math.cos(angle);
            const normalY = Math.sin(angle);
            const dotProduct = this.vx * normalX + this.vy * normalY;
            this.vx -= 2 * dotProduct * normalX * RESTITUTION;
            this.vy -= 2 * dotProduct * normalY * RESTITUTION;
        }

        // For enemy marbles: allow them to exit the arena
        if (!this.isStriker) {
            // Check if enemy is out of arena (beyond the boundary)
            if (distance + this.radius > ARENA_RADIUS + 5) {
                this.isOut = true;
                if (!gameState.gameOver) {
                    gameState.score += 10;
                    gameState.enemiesLeft--;
                    updateUI();
                }
            }
        }
    }

    // Apply impulse (force over time)
    applyImpulse(forceX, forceY) {
        // Impulse = Force × Time, but we'll use it as velocity change
        // F = ma, so a = F/m, and v = v0 + a*dt
        // For simplicity, we'll treat impulse as velocity change
        this.vx += forceX / this.mass;
        this.vy += forceY / this.mass;
    }
}

// Collision Detection and Response
function checkCollision(marble1, marble2) {
    const dx = marble2.x - marble1.x;
    const dy = marble2.y - marble1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = marble1.radius + marble2.radius;

    if (distance < minDistance && !marble1.isOut && !marble2.isOut) {
        // Collision detected - apply conservation of momentum
        
        // Store velocities before collision for calculation display
        const v1Before = { x: marble1.vx, y: marble1.vy };
        const v2Before = { x: marble2.vx, y: marble2.vy };
        
        // Calculate momentum before collision
        const p1Before = Math.sqrt((marble1.mass * marble1.vx) ** 2 + (marble1.mass * marble1.vy) ** 2);
        const p2Before = Math.sqrt((marble2.mass * marble2.vx) ** 2 + (marble2.mass * marble2.vy) ** 2);
        const totalMomentumBefore = p1Before + p2Before;
        
        // Normalize collision vector
        const nx = dx / distance;
        const ny = dy / distance;

        // Relative velocity
        const relativeVx = marble2.vx - marble1.vx;
        const relativeVy = marble2.vy - marble1.vy;

        // Relative velocity along collision normal
        const relativeSpeed = relativeVx * nx + relativeVy * ny;

        // Don't resolve if velocities are separating
        if (relativeSpeed > 0) return;

        // Calculate impulse scalar (conservation of momentum)
        // J = (1 + e) * relativeSpeed / (1/m1 + 1/m2)
        // where e is restitution coefficient
        const impulse = (1 + RESTITUTION) * relativeSpeed / (1 / marble1.mass + 1 / marble2.mass);

        // Apply impulse to velocities (conservation of momentum)
        marble1.vx += (impulse / marble1.mass) * nx;
        marble1.vy += (impulse / marble1.mass) * ny;
        marble2.vx -= (impulse / marble2.mass) * nx;
        marble2.vy -= (impulse / marble2.mass) * ny;

        // Calculate momentum after collision
        const p1After = Math.sqrt((marble1.mass * marble1.vx) ** 2 + (marble1.mass * marble1.vy) ** 2);
        const p2After = Math.sqrt((marble2.mass * marble2.vx) ** 2 + (marble2.mass * marble2.vy) ** 2);
        const totalMomentumAfter = p1After + p2After;

        // Store collision data for display (only if striker is involved)
        if (marble1.isStriker || marble2.isStriker) {
            lastCollisionData = {
                marble1Mass: marble1.mass,
                marble2Mass: marble2.mass,
                momentumBefore: totalMomentumBefore.toFixed(2),
                momentumAfter: totalMomentumAfter.toFixed(2),
                impulse: Math.abs(impulse).toFixed(2),
                timestamp: Date.now()
            };
        }

        // Separate marbles to prevent overlap
        const overlap = minDistance - distance;
        const separationX = (overlap / 2) * nx;
        const separationY = (overlap / 2) * ny;

        marble1.x -= separationX;
        marble1.y -= separationY;
        marble2.x += separationX;
        marble2.y += separationY;
    }
}

// Game Objects
let striker = null;
let enemies = [];
let isAiming = false;
let aimStartX = 0;
let aimStartY = 0;
let currentPower = 0;
let lastCollisionData = null;
let lastPhysicsData = {
    momentum: 0,
    velocity: 0,
    kineticEnergy: 0
};
let shouldClearPhysicsData = false;
let lastImpulse = 0; // Track last applied impulse
let gameStarted = false;

// Initialize Game
function initGame() {
    gameState.score = 0;
    gameState.enemiesLeft = 5;
    gameState.gameOver = false;
    gameState.strikerReady = true;

    // Calculate striker position (below center, inside arena)
    const strikerDistance = ARENA_RADIUS * 0.5; // Position striker at 50% of arena radius
    
    // Create striker marble - player color (bright orange/red gaming style)
    striker = new Marble(
        ARENA_CENTER_X,
        ARENA_CENTER_Y + strikerDistance,
        22,
        '#FF6B35', // Vibrant gaming orange-red
        1.5,
        true
    );

    // Create enemy marbles with vibrant gaming colors
    enemies = [];
    const enemyColors = [
        '#FF1744', // Gaming red
        '#00E676', // Gaming green
        '#2979FF', // Gaming blue
        '#FFD600', // Gaming yellow
        '#AA00FF'  // Gaming purple
    ];
    
    // Position enemies in a circle, closer to center
    const enemyDistance = ARENA_RADIUS * 0.4; // 40% of arena radius
    
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        const x = ARENA_CENTER_X + Math.cos(angle) * enemyDistance;
        const y = ARENA_CENTER_Y + Math.sin(angle) * enemyDistance;
        
        enemies.push(new Marble(
            x,
            y,
            18,
            enemyColors[i],
            1.0,
            false
        ));
    }

    updateUI();
    document.getElementById('game-over').classList.add('hidden');
}

// Draw Arena
function drawArena() {
    // Make sure arena radius is valid
    if (ARENA_RADIUS <= 0 || !ARENA_CENTER_X || !ARENA_CENTER_Y) {
        console.log('Arena invalid:', { ARENA_RADIUS, ARENA_CENTER_X, ARENA_CENTER_Y });
        return;
    }
    
    ctx.save();
    
    // Draw arena background (subtle fill)
    ctx.beginPath();
    ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, ARENA_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 30, 50, 0.3)';
    ctx.fill();
    
    // Outer ring - main boundary (gaming blue with glow effect)
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#2979FF';
    ctx.beginPath();
    ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, ARENA_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#2979FF'; // Gaming blue
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Middle ring (gaming accent)
    ctx.beginPath();
    ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, ARENA_RADIUS - 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD600'; // Gaming yellow
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Inner boundary
    ctx.beginPath();
    ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, ARENA_RADIUS - 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Center point (gaming style)
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFD600';
    ctx.beginPath();
    ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Inner decorative ring
    ctx.beginPath();
    ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, ARENA_RADIUS * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(41, 121, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
}

// Draw Aiming Line with Impulse Visualization
function drawAimLine() {
    if (!isAiming || !striker || striker.isOut || !gameStarted) return;

    const dx = aimStartX - striker.x;
    const dy = aimStartY - striker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 200;
    const power = Math.min(distance / maxDistance, 1);

    // Calculate impulse for display
    const maxForce = 15;
    const impulseMagnitude = power * maxForce;

    ctx.save();
    
    // Draw impulse vector (force direction)
    const angle = Math.atan2(dy, dx);
    const impulseColor = power > 0.7 ? '#FF1744' : power > 0.4 ? '#FFD600' : '#00E676';
    
    // Main impulse line
    ctx.strokeStyle = impulseColor;
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.shadowBlur = 10;
    ctx.shadowColor = impulseColor;
    ctx.beginPath();
    ctx.moveTo(striker.x, striker.y);
    ctx.lineTo(aimStartX, aimStartY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Impulse arrow head
    const arrowLength = Math.min(distance * 0.2, 30);
    ctx.beginPath();
    ctx.moveTo(aimStartX, aimStartY);
    ctx.lineTo(
        aimStartX - Math.cos(angle) * arrowLength,
        aimStartY - Math.sin(angle) * arrowLength
    );
    ctx.lineTo(
        aimStartX - Math.cos(angle) * arrowLength + Math.cos(angle + Math.PI / 6) * 12,
        aimStartY - Math.sin(angle) * arrowLength + Math.sin(angle + Math.PI / 6) * 12
    );
    ctx.moveTo(aimStartX, aimStartY);
    ctx.lineTo(
        aimStartX - Math.cos(angle) * arrowLength + Math.cos(angle - Math.PI / 6) * 12,
        aimStartY - Math.sin(angle) * arrowLength + Math.sin(angle - Math.PI / 6) * 12
    );
    ctx.fillStyle = impulseColor;
    ctx.fill();
    
    // Display impulse value near the striker
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`J = ${impulseMagnitude.toFixed(1)} N·s`, striker.x, striker.y - striker.radius - 15);
    
    ctx.restore();
}

// Game Loop
function gameLoop() {
    // Clear canvas with better background color
    ctx.fillStyle = '#0F1419'; // Dark blue-gray
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Only draw game if started
    if (!gameStarted) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Draw arena
    drawArena();

    // Update and draw marbles
    if (striker && !striker.isOut) {
        striker.update();
        striker.draw();
    }

    enemies.forEach(enemy => {
        if (!enemy.isOut) {
            enemy.update();
            enemy.draw();
        }
    });

    // Check collisions
    if (striker && !striker.isOut) {
        enemies.forEach(enemy => {
            if (!enemy.isOut) {
                checkCollision(striker, enemy);
            }
        });
    }

    // Check collisions between enemies
    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            if (!enemies[i].isOut && !enemies[j].isOut) {
                checkCollision(enemies[i], enemies[j]);
            }
        }
    }

    // Draw aiming line
    drawAimLine();

    // Update physics calculations display
    updatePhysicsCalculations();

    // Check game over
    if (gameState.enemiesLeft === 0 && !gameState.gameOver) {
        gameState.gameOver = true;
        document.getElementById('final-score').textContent = gameState.score;
        document.getElementById('game-over').classList.remove('hidden');
    }

    requestAnimationFrame(gameLoop);
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('enemies-left').textContent = gameState.enemiesLeft;
    
    const powerPercent = Math.round(currentPower * 100);
    document.getElementById('power-value').textContent = powerPercent + '%';
    document.getElementById('power-fill').style.width = powerPercent + '%';
}

// Update Physics Calculations Display
function updatePhysicsCalculations() {
    // Clear data when dragging starts
    if (shouldClearPhysicsData) {
        lastPhysicsData = { momentum: 0, velocity: 0, kineticEnergy: 0 };
        lastCollisionData = null;
        lastImpulse = 0;
        shouldClearPhysicsData = false;
        // Update displays to show cleared values
        document.getElementById('striker-momentum').textContent = '0.00 kg·m/s';
        document.getElementById('striker-velocity').textContent = '0.00 m/s';
        document.getElementById('striker-ke').textContent = '0.00 J';
        document.getElementById('impulse-value').textContent = '0.00 N·s';
        document.getElementById('collision-momentum').textContent = 'No collision';
    }
    
    // Update impulse display (show last applied impulse)
    document.getElementById('impulse-value').textContent = lastImpulse.toFixed(2) + ' N·s';
    
    if (!striker || striker.isOut) {
        // Show last data if available, otherwise show zeros
        document.getElementById('striker-momentum').textContent = lastPhysicsData.momentum.toFixed(2) + ' kg·m/s';
        document.getElementById('striker-velocity').textContent = lastPhysicsData.velocity.toFixed(2) + ' m/s';
        document.getElementById('striker-ke').textContent = lastPhysicsData.kineticEnergy.toFixed(2) + ' J';
        return;
    }

    // Calculate velocity magnitude: v = √(vₓ² + vᵧ²)
    const velocity = Math.sqrt(striker.vx * striker.vx + striker.vy * striker.vy);
    
    // Calculate momentum: p = m × v
    const momentum = striker.mass * velocity;
    
    // Calculate kinetic energy: KE = ½mv²
    const kineticEnergy = 0.5 * striker.mass * velocity * velocity;

    // Update last physics data (keep it even when striker stops)
    if (velocity > MIN_VELOCITY || momentum > 0.01) {
        lastPhysicsData.momentum = momentum;
        lastPhysicsData.velocity = velocity;
        lastPhysicsData.kineticEnergy = kineticEnergy;
    }

    // Update displays (always show last calculated values)
    document.getElementById('striker-momentum').textContent = lastPhysicsData.momentum.toFixed(2) + ' kg·m/s';
    document.getElementById('striker-velocity').textContent = lastPhysicsData.velocity.toFixed(2) + ' m/s';
    document.getElementById('striker-ke').textContent = lastPhysicsData.kineticEnergy.toFixed(2) + ' J';

    // Update collision info (keep showing until new drag starts)
    if (lastCollisionData) {
        document.getElementById('collision-momentum').textContent = 
            `Δp: ${lastCollisionData.momentumBefore} → ${lastCollisionData.momentumAfter} kg·m/s`;
    } else {
        document.getElementById('collision-momentum').textContent = 'No collision';
    }

    // Friction info (constant)
    const frictionCoeff = (1 - FRICTION).toFixed(3);
    document.getElementById('friction-info').textContent = `μ = ${frictionCoeff} (2% per frame)`;
}

// Mouse/Touch Events
canvas.addEventListener('mousedown', (e) => {
    if (!gameStarted || gameState.gameOver || !striker || striker.isOut) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking near striker
    const dx = x - striker.x;
    const dy = y - striker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < striker.radius + 50 && gameState.strikerReady) {
        isAiming = true;
        aimStartX = x;
        aimStartY = y;
        // Mark that we should clear physics data when dragging starts
        shouldClearPhysicsData = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isAiming) return;

    const rect = canvas.getBoundingClientRect();
    aimStartX = e.clientX - rect.left;
    aimStartY = e.clientY - rect.top;

    // Calculate power
    const dx = aimStartX - striker.x;
    const dy = aimStartY - striker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 200;
    currentPower = Math.min(distance / maxDistance, 1);
    updateUI();
});

canvas.addEventListener('mouseup', (e) => {
    if (!isAiming || !gameState.strikerReady) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate impulse (force vector)
    const dx = x - striker.x;
    const dy = y - striker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 200;
    const power = Math.min(distance / maxDistance, 1);

    // Apply impulse (force = power * maxForce)
    const maxForce = 15;
    const forceX = (dx / distance) * power * maxForce;
    const forceY = (dy / distance) * power * maxForce;

    // Calculate impulse magnitude: J = |F| × Δt (where Δt is approximated by power)
    // In this simulation, impulse ≈ change in momentum
    const impulseMagnitude = Math.sqrt(forceX * forceX + forceY * forceY) * power;
    lastImpulse = impulseMagnitude;

    striker.applyImpulse(forceX, forceY);
    gameState.strikerReady = false;

    isAiming = false;
    currentPower = 0;
    updateUI();

    // Reset striker after it stops
    function checkStrikerReset() {
        if (striker && !striker.isOut) {
            const speed = Math.sqrt(striker.vx * striker.vx + striker.vy * striker.vy);
            if (speed < MIN_VELOCITY) {
                // Reset to initial position (proportional to arena)
                const strikerDistance = ARENA_RADIUS * 0.5;
                striker.x = ARENA_CENTER_X;
                striker.y = ARENA_CENTER_Y + strikerDistance;
                striker.vx = 0;
                striker.vy = 0;
                gameState.strikerReady = true;
            } else {
                setTimeout(checkStrikerReset, 100);
            }
        }
    }
    setTimeout(checkStrikerReset, 100);
});

// Touch events for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
});

// Start button handler
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            gameStarted = true;
            const startPopup = document.getElementById('start-popup');
            const backdrop = document.getElementById('popup-backdrop');
            if (startPopup) startPopup.classList.add('hidden');
            if (backdrop) backdrop.classList.add('hidden');
            initGame();
        });
    }
});

// Also try immediate setup if DOM is already loaded
const startBtn = document.getElementById('start-btn');
if (startBtn) {
    startBtn.addEventListener('click', () => {
        gameStarted = true;
        const startPopup = document.getElementById('start-popup');
        const backdrop = document.getElementById('popup-backdrop');
        if (startPopup) startPopup.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
        initGame();
    });
}

// Reset button
document.getElementById('reset-btn').addEventListener('click', initGame);
document.getElementById('restart-btn').addEventListener('click', () => {
    initGame();
    document.getElementById('game-over').classList.add('hidden');
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (gameStarted) {
            initGame();
        }
    }
});

