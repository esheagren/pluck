// Sand Animation - Canvas particle effect
// Converted from React component to vanilla JS

export function initSandAnimation(canvas, options = {}) {
  const {
    filterPosition = 0.65,
    speed = 1,
    opacity = 1
  } = options;

  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  let animationId;
  let particles = [];
  let isRunning = true;

  // Configuration
  const config = {
    particleCount: 800,
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

  // Resize handler
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Fallback to window dimensions if rect is empty
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  // Create a particle
  function createParticle(xPosition = null) {
    const height = canvas.height / (window.devicePixelRatio || 1);
    const width = canvas.width / (window.devicePixelRatio || 1);

    const willPassThrough = Math.random() < config.passThrough;

    return {
      x: xPosition !== null ? xPosition : -5 - Math.random() * 50,
      y: Math.random() * height,
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
    const width = canvas.width / (window.devicePixelRatio || 1);

    for (let i = 0; i < config.particleCount; i++) {
      const startX = Math.random() * width * config.filterPosition;
      particles.push(createParticle(startX));
    }
  }

  // Animation loop
  function animate() {
    if (!isRunning) return;

    const height = canvas.height / (window.devicePixelRatio || 1);
    const width = canvas.width / (window.devicePixelRatio || 1);
    const filterX = width * config.filterPosition;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw the filter line (very subtle vertical line)
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(filterX, 0);
    ctx.lineTo(filterX, height);
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

      if (p.x > width + 10) {
        particles[index] = createParticle();
      }

      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;
    });

    // Draw accumulation effect at filter line
    const gradient = ctx.createLinearGradient(filterX - 40, 0, filterX, 0);
    gradient.addColorStop(0, 'rgba(40, 40, 40, 0)');
    gradient.addColorStop(0.7, 'rgba(40, 40, 40, 0.03)');
    gradient.addColorStop(1, 'rgba(40, 40, 40, 0.08)');
    ctx.fillStyle = gradient;
    ctx.fillRect(filterX - 40, 0, 40, height);

    animationId = requestAnimationFrame(animate);
  }

  // Handle resize
  function handleResize() {
    resize();
    init();
  }

  // Initialize
  resize();
  init();
  animate();

  window.addEventListener('resize', handleResize);

  // Return cleanup function
  return function cleanup() {
    isRunning = false;
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', handleResize);
  };
}
