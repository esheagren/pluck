import { useEffect, useRef, type JSX } from 'react';
import type { SandAnimationProps, Particle } from '../types';

export default function SandAnimation({
  className = '',
  filterPosition = 0.65,
  speed = 1,
  opacity = 1,
  darkMode = false,
}: SandAnimationProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];

    // Reduce particles on mobile for better scroll performance
    const isMobile = window.innerWidth < 768;

    // Light mode colors (dark gray particles)
    const lightColors = [
      `rgba(60, 60, 60, ${0.6 * opacity})`,
      `rgba(70, 70, 70, ${0.5 * opacity})`,
      `rgba(50, 50, 50, ${0.6 * opacity})`,
      `rgba(80, 80, 80, ${0.45 * opacity})`,
    ];

    // Dark mode colors (cream/ochre particles)
    const darkColors = [
      `rgba(220, 215, 200, ${0.5 * opacity})`,  // dull white/cream
      `rgba(200, 185, 160, ${0.45 * opacity})`, // warm cream
      `rgba(180, 165, 140, ${0.5 * opacity})`,  // ochre/tan
      `rgba(210, 200, 180, ${0.4 * opacity})`,  // light ochre
    ];

    // Configuration
    const config = {
      particleCount: isMobile ? 300 : 800,
      minSize: 1.5,
      maxSize: 3,
      minSpeed: 2 * speed,
      maxSpeed: 4 * speed,
      filterPosition: filterPosition, // configurable filter position
      passThrough: 0.03, // only 3% of particles pass through
      colors: darkMode ? darkColors : lightColors,
    };

    // Resize handler
    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    // Create a particle
    const createParticle = (xPosition: number | null = null): Particle => {
      const height = canvas.height / (window.devicePixelRatio || 1);
      // Width is calculated but currently not needed for particle creation
      // const width = canvas.width / (window.devicePixelRatio || 1);

      // Determine if this particle will pass through the filter
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
        // Slight vertical drift (very subtle)
        verticalDrift: (Math.random() - 0.5) * 0.15,
      };
    };

    // Initialize particles
    const init = (): void => {
      particles = [];
      const width = canvas.width / (window.devicePixelRatio || 1);

      for (let i = 0; i < config.particleCount; i++) {
        // Distribute particles across the left portion initially
        const startX = Math.random() * width * config.filterPosition;
        particles.push(createParticle(startX));
      }
    };

    // Animation loop
    const animate = (): void => {
      const height = canvas.height / (window.devicePixelRatio || 1);
      const width = canvas.width / (window.devicePixelRatio || 1);
      const filterX = width * config.filterPosition;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw the filter line (very subtle vertical line)
      ctx.strokeStyle = darkMode ? 'rgba(200, 190, 170, 0.1)' : 'rgba(60, 60, 60, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(filterX, 0);
      ctx.lineTo(filterX, height);
      ctx.stroke();

      // Update and draw particles
      particles.forEach((p, index) => {
        if (!p.stopped) {
          // Move horizontally (left to right)
          p.x += p.speed;
          // Very subtle vertical movement
          p.y += p.verticalDrift;

          // Check if particle hits the filter
          if (p.x >= filterX && !p.willPassThrough) {
            p.stopped = true;
            p.x = filterX - p.size;
            p.fadeOut = 1;
          }
        } else {
          // Fade out stopped particles
          p.fadeOut -= 0.008;
          if (p.fadeOut <= 0) {
            // Reset particle
            particles[index] = createParticle();
          }
        }

        // Draw particle
        const currentOpacity = p.stopped ? p.opacity * p.fadeOut : p.opacity;
        if (currentOpacity > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = currentOpacity;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Reset particle if it goes off screen right
        if (p.x > width + 10) {
          particles[index] = createParticle();
        }

        // Wrap vertically
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      });

      // Draw accumulation effect at filter line (subtle pile-up)
      const gradient = ctx.createLinearGradient(filterX - 40, 0, filterX, 0);
      if (darkMode) {
        gradient.addColorStop(0, 'rgba(200, 190, 170, 0)');
        gradient.addColorStop(0.7, 'rgba(200, 190, 170, 0.03)');
        gradient.addColorStop(1, 'rgba(200, 190, 170, 0.08)');
      } else {
        gradient.addColorStop(0, 'rgba(40, 40, 40, 0)');
        gradient.addColorStop(0.7, 'rgba(40, 40, 40, 0.03)');
        gradient.addColorStop(1, 'rgba(40, 40, 40, 0.08)');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(filterX - 40, 0, 40, height);

      animationId = requestAnimationFrame(animate);
    };

    // Initialize
    resize();
    init();
    animate();

    // Use ResizeObserver instead of window resize for more reliable size detection on mobile
    const resizeObserver = new ResizeObserver(() => {
      resize();
      init();
    });
    resizeObserver.observe(canvas);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [filterPosition, speed, opacity, darkMode]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    />
  );
}
