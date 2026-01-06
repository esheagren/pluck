import { useEffect, useRef } from 'react'

export default function SandAnimation({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let particles = []

    // Configuration
    const config = {
      particleCount: 150,
      minSize: 1,
      maxSize: 2.5,
      minSpeed: 0.3,
      maxSpeed: 1.2,
      drift: 0.3,
      sieveLines: 5,
      sieveGap: 0.15, // percentage of height between sieve lines
      sievePauseChance: 0.02, // chance to briefly pause at sieve line
      sievePauseDuration: 30, // frames to pause
      colors: [
        'rgba(217, 199, 175, 0.6)', // light sand
        'rgba(194, 178, 158, 0.5)', // medium sand
        'rgba(168, 152, 132, 0.4)', // darker sand
        'rgba(210, 186, 145, 0.5)', // golden sand
      ]
    }

    // Resize handler
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    // Create a particle
    const createParticle = (yPosition = null) => {
      const height = canvas.height / (window.devicePixelRatio || 1)
      const width = canvas.width / (window.devicePixelRatio || 1)

      return {
        x: Math.random() * width,
        y: yPosition !== null ? yPosition : -10 - Math.random() * 100,
        size: config.minSize + Math.random() * (config.maxSize - config.minSize),
        speed: config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed),
        drift: (Math.random() - 0.5) * config.drift,
        driftSpeed: 0.01 + Math.random() * 0.02,
        driftOffset: Math.random() * Math.PI * 2,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        opacity: 0.3 + Math.random() * 0.5,
        pauseTimer: 0,
        paused: false,
      }
    }

    // Initialize particles
    const init = () => {
      particles = []
      const height = canvas.height / (window.devicePixelRatio || 1)

      for (let i = 0; i < config.particleCount; i++) {
        // Distribute particles throughout the canvas initially
        particles.push(createParticle(Math.random() * height))
      }
    }

    // Calculate sieve line positions
    const getSieveLines = () => {
      const height = canvas.height / (window.devicePixelRatio || 1)
      const lines = []
      const startOffset = 0.2 // Start 20% down

      for (let i = 0; i < config.sieveLines; i++) {
        lines.push(height * (startOffset + i * config.sieveGap))
      }
      return lines
    }

    // Animation loop
    let frame = 0
    const animate = () => {
      const height = canvas.height / (window.devicePixelRatio || 1)
      const width = canvas.width / (window.devicePixelRatio || 1)
      const sieveLines = getSieveLines()

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw subtle sieve lines (very faint)
      ctx.strokeStyle = 'rgba(180, 165, 145, 0.08)'
      ctx.lineWidth = 1
      sieveLines.forEach(y => {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      })

      // Update and draw particles
      particles.forEach((p, index) => {
        // Handle pause state (simulating catching on sieve)
        if (p.paused) {
          p.pauseTimer--
          if (p.pauseTimer <= 0) {
            p.paused = false
          }
        } else {
          // Check if particle should pause at a sieve line
          sieveLines.forEach(lineY => {
            if (p.y >= lineY - 1 && p.y <= lineY + 1 && Math.random() < config.sievePauseChance) {
              p.paused = true
              p.pauseTimer = Math.random() * config.sievePauseDuration
              p.y = lineY
            }
          })

          if (!p.paused) {
            // Update position with gentle sine wave drift
            p.y += p.speed
            p.x += Math.sin(frame * p.driftSpeed + p.driftOffset) * p.drift
          }
        }

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity * (p.paused ? 0.8 : 1)
        ctx.fill()
        ctx.globalAlpha = 1

        // Reset particle if it falls off screen
        if (p.y > height + 10) {
          particles[index] = createParticle()
        }

        // Wrap horizontally
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10
      })

      frame++
      animationId = requestAnimationFrame(animate)
    }

    // Initialize
    resize()
    init()
    animate()

    // Handle resize
    window.addEventListener('resize', () => {
      resize()
      init()
    })

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
