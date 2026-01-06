import { useEffect, useRef } from 'react'

export default function SandAnimation({ className = '', filterPosition = 0.65 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let particles = []

    // Configuration
    const config = {
      particleCount: 800,
      minSize: 1.5,
      maxSize: 3,
      minSpeed: 2,
      maxSpeed: 4,
      filterPosition: filterPosition, // configurable filter position
      passThrough: 0.03, // only 3% of particles pass through
      colors: [
        'rgba(60, 60, 60, 0.6)',
        'rgba(70, 70, 70, 0.5)',
        'rgba(50, 50, 50, 0.6)',
        'rgba(80, 80, 80, 0.45)',
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
    const createParticle = (xPosition = null) => {
      const height = canvas.height / (window.devicePixelRatio || 1)
      const width = canvas.width / (window.devicePixelRatio || 1)
      const filterX = width * config.filterPosition

      // Determine if this particle will pass through the filter
      const willPassThrough = Math.random() < config.passThrough

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
      }
    }

    // Initialize particles
    const init = () => {
      particles = []
      const width = canvas.width / (window.devicePixelRatio || 1)

      for (let i = 0; i < config.particleCount; i++) {
        // Distribute particles across the left portion initially
        const startX = Math.random() * width * config.filterPosition
        particles.push(createParticle(startX))
      }
    }

    // Animation loop
    const animate = () => {
      const height = canvas.height / (window.devicePixelRatio || 1)
      const width = canvas.width / (window.devicePixelRatio || 1)
      const filterX = width * config.filterPosition

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw the filter line (very subtle vertical line)
      ctx.strokeStyle = 'rgba(60, 60, 60, 0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(filterX, 0)
      ctx.lineTo(filterX, height)
      ctx.stroke()

      // Update and draw particles
      particles.forEach((p, index) => {
        if (!p.stopped) {
          // Move horizontally (left to right)
          p.x += p.speed
          // Very subtle vertical movement
          p.y += p.verticalDrift

          // Check if particle hits the filter
          if (p.x >= filterX && !p.willPassThrough) {
            p.stopped = true
            p.x = filterX - p.size
            p.fadeOut = 1
          }
        } else {
          // Fade out stopped particles
          p.fadeOut -= 0.008
          if (p.fadeOut <= 0) {
            // Reset particle
            particles[index] = createParticle()
          }
        }

        // Draw particle
        const currentOpacity = p.stopped ? p.opacity * p.fadeOut : p.opacity
        if (currentOpacity > 0) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.globalAlpha = currentOpacity
          ctx.fill()
          ctx.globalAlpha = 1
        }

        // Reset particle if it goes off screen right
        if (p.x > width + 10) {
          particles[index] = createParticle()
        }

        // Wrap vertically
        if (p.y < -10) p.y = height + 10
        if (p.y > height + 10) p.y = -10
      })

      // Draw accumulation effect at filter line (subtle pile-up)
      const gradient = ctx.createLinearGradient(filterX - 40, 0, filterX, 0)
      gradient.addColorStop(0, 'rgba(40, 40, 40, 0)')
      gradient.addColorStop(0.7, 'rgba(40, 40, 40, 0.03)')
      gradient.addColorStop(1, 'rgba(40, 40, 40, 0.08)')
      ctx.fillStyle = gradient
      ctx.fillRect(filterX - 40, 0, 40, height)

      animationId = requestAnimationFrame(animate)
    }

    // Initialize
    resize()
    init()
    animate()

    // Handle resize
    const handleResize = () => {
      resize()
      init()
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [filterPosition])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
