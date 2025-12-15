# Collision Simulator – Conservation of Momentum

A browser-based physics simulation that demonstrates how momentum is conserved in one-dimensional collisions.

## Features

- **Two collision types**: Elastic and Inelastic
- **Multiple objects**: Choose from cars, balls, carts, or blocks
- **Interactive controls**: Adjust mass and velocity for both objects
- **Real-time calculations**: See momentum before/after and final velocities
- **Step-by-step formulas**: View the physics calculations used
- **Dynamic conclusions**: Get a summary of what happened in each collision
- **Visual animation**: Watch objects collide and move according to physics laws

## How to Use

1. Open `index.html` in any web browser
2. Select the collision type (Elastic or Inelastic)
3. Choose the object type from the dropdown
4. Enter the mass and velocity for both objects
5. Click "Start Simulation" to see the collision
6. Check the Results panel for momentum and velocity values
7. Read the Conclusion for a summary of the physics

## Physics Concepts

### Momentum Conservation
In all collisions, total momentum is conserved:
```
p_before = p_after
m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂
```

### Elastic Collision
Both momentum and kinetic energy are conserved. Objects bounce off each other.

### Inelastic Collision
Only momentum is conserved. Objects stick together and move as one. Kinetic energy is lost to heat, sound, and deformation.

## Technologies Used

- **HTML** – Structure and layout
- **CSS** – Styling and SVG graphics
- **JavaScript** – Physics calculations and animation

## Project Structure

```
Physics_Simulation/
├── index.html      # Main HTML file
├── styles.css      # All styling
├── script.js       # Physics logic and animation
├── images/         # Background images
│   ├── road.jpg
│   ├── court.jpg
│   └── box.jpg
└── README.md       # This file
```

## Sign Convention

- **Positive velocity** = moving right →
- **Negative velocity** = moving left ←
- **Zero velocity** = stationary

## Authors

Physics Final Project - December 2025
