// Sand Animation - Canvas particle effect
// Converted from React component to vanilla JS

export function initSandAnimation(canvas, options = {}) {
  const {
    filterPosition = 0.65,
    speed = 1,
    opacity = 1,
    particleCount = 800
  } = options;

  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  let animationId;
  let particles = [];
  let isRunning = true;
  let currentWidth = 0;
  let currentHeight = 0;

  // Configuration
  const config = {
    particleCount: particleCount,
    minSize: 1.5,
    maxSize: 3,
    minSpeed: 2 * speed,
    maxSpeed: 4 * speed,
    filterPosition: filterPosition,
    passThrough: 0.03,
    colors: [
      `rgba(60, 60, 60, ${0.6 * opacity})`,
      `rgba(70, 70, 70, ${0.5 * opacity})`,
      `rgba(50, 50, 50, ${0.6 * opacity})`,
      `rgba(80, 80, 80, ${0.45 * opacity})`,
    ]
  };

  // Resize handler - updates canvas buffer to match CSS size
  function resize(width, height) {
    const dpr = window.devicePixelRatio || 1;

    currentWidth = width;
    currentHeight = height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Create a particle
  function createParticle(xPosition = null) {
    const willPassThrough = Math.random() < config.passThrough;

    return {
      x: xPosition !== null ? xPosition : -5 - Math.random() * 50,
      y: Math.random() * currentHeight,
      size: config.minSize + Math.random() * (config.maxSize - config.minSize),
      speed: config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed),
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      opacity: 0.4 + Math.random() * 0.5,
      willPassThrough,
      stopped: false,
      fadeOut: 0,
      verticalDrift: (Math.random() - 0.5) * 0.15,
    };
  }

  // Initialize particles
  function init() {
    particles = [];
    for (let i = 0; i < config.particleCount; i++) {
      const startX = Math.random() * currentWidth * config.filterPosition;
      particles.push(createParticle(startX));
    }
  }

  // Animation loop
  function animate() {
    if (!isRunning) return;
    if (currentWidth === 0 || currentHeight === 0) {
      animationId = requestAnimationFrame(animate);
      return;
    }

    const filterX = currentWidth * config.filterPosition;

    // Clear canvas
    ctx.clearRect(0, 0, currentWidth, currentHeight);

    // Draw the filter line (very subtle vertical line)
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(filterX, 0);
    ctx.lineTo(filterX, currentHeight);
    ctx.stroke();

    // Update and draw particles
    particles.forEach((p, index) => {
      if (!p.stopped) {
        p.x += p.speed;
        p.y += p.verticalDrift;

        if (p.x >= filterX && !p.willPassThrough) {
          p.stopped = true;
          p.x = filterX - p.size;
          p.fadeOut = 1;
        }
      } else {
        p.fadeOut -= 0.008;
        if (p.fadeOut <= 0) {
          particles[index] = createParticle();
        }
      }

      const currentOpacity = p.stopped ? p.opacity * p.fadeOut : p.opacity;
      if (currentOpacity > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentOpacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (p.x > currentWidth + 10) {
        particles[index] = createParticle();
      }

      if (p.y < -10) p.y = currentHeight + 10;
      if (p.y > currentHeight + 10) p.y = -10;
    });

    // Draw accumulation effect at filter line
    const gradient = ctx.createLinearGradient(filterX - 40, 0, filterX, 0);
    gradient.addColorStop(0, 'rgba(40, 40, 40, 0)');
    gradient.addColorStop(0.7, 'rgba(40, 40, 40, 0.03)');
    gradient.addColorStop(1, 'rgba(40, 40, 40, 0.08)');
    ctx.fillStyle = gradient;
    ctx.fillRect(filterX - 40, 0, 40, currentHeight);

    animationId = requestAnimationFrame(animate);
  }

  // Use ResizeObserver to track actual canvas size from CSS
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        const needsReinit = particles.length === 0 ||
          Math.abs(width - currentWidth) > 50 ||
          Math.abs(height - currentHeight) > 50;
        resize(width, height);
        if (needsReinit) {
          init();
        }
      }
    }
  });

  resizeObserver.observe(canvas);

  // Start animation
  animate();

  // Return cleanup function
  return function cleanup() {
    isRunning = false;
    cancelAnimationFrame(animationId);
    resizeObserver.disconnect();
  };
}
