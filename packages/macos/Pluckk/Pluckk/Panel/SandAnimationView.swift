import SwiftUI

/// Full-panel sand animation background matching the Chrome extension's sand-animation.ts
/// Particles move horizontally left-to-right with a filter line where they accumulate
struct SandAnimationView: View {
    @Environment(\.colorScheme) var colorScheme
    @SwiftUI.State private var particles: [SandParticle] = []
    @SwiftUI.State private var animationTimer: Timer?

    // Configuration matching extension
    private let particleCount = 200
    private let filterPosition: CGFloat = 0.98  // 98% across for thin strip effect
    private let minSize: CGFloat = 1.5
    private let maxSize: CGFloat = 3
    private let minSpeed: CGFloat = 0.6
    private let maxSpeed: CGFloat = 1.2
    private let passThrough: CGFloat = 0.03  // 3% chance to pass filter

    var body: some View {
        GeometryReader { geometry in
            Canvas { context, size in
                // Draw particles
                for particle in particles {
                    let opacity = particle.stopped
                        ? particle.opacity * particle.fadeOut
                        : particle.opacity

                    if opacity > 0 {
                        let rect = CGRect(
                            x: particle.x - particle.size / 2,
                            y: particle.y - particle.size / 2,
                            width: particle.size,
                            height: particle.size
                        )
                        context.opacity = opacity
                        context.fill(
                            Path(ellipseIn: rect),
                            with: .color(particle.color)
                        )
                        context.opacity = 1
                    }
                }

                // Draw subtle filter line
                let filterX = size.width * filterPosition
                let lineColor = colorScheme == .dark
                    ? Color(red: 200/255, green: 190/255, blue: 170/255).opacity(0.1)
                    : Color(red: 60/255, green: 60/255, blue: 60/255).opacity(0.1)

                var linePath = Path()
                linePath.move(to: CGPoint(x: filterX, y: 0))
                linePath.addLine(to: CGPoint(x: filterX, y: size.height))
                context.stroke(linePath, with: .color(lineColor), lineWidth: 1)

                // Draw accumulation gradient near filter line
                let gradientWidth: CGFloat = 40
                let gradientColors: [Color]
                if colorScheme == .dark {
                    gradientColors = [
                        Color(red: 200/255, green: 190/255, blue: 170/255).opacity(0),
                        Color(red: 200/255, green: 190/255, blue: 170/255).opacity(0.03),
                        Color(red: 200/255, green: 190/255, blue: 170/255).opacity(0.08)
                    ]
                } else {
                    gradientColors = [
                        Color(red: 40/255, green: 40/255, blue: 40/255).opacity(0),
                        Color(red: 40/255, green: 40/255, blue: 40/255).opacity(0.03),
                        Color(red: 40/255, green: 40/255, blue: 40/255).opacity(0.08)
                    ]
                }

                let gradientRect = CGRect(
                    x: filterX - gradientWidth,
                    y: 0,
                    width: gradientWidth,
                    height: size.height
                )
                context.fill(
                    Path(gradientRect),
                    with: .linearGradient(
                        Gradient(colors: gradientColors),
                        startPoint: CGPoint(x: filterX - gradientWidth, y: 0),
                        endPoint: CGPoint(x: filterX, y: 0)
                    )
                )
            }
            .onAppear {
                initializeParticles(in: geometry.size)
                startAnimation(in: geometry.size)
            }
            .onDisappear {
                animationTimer?.invalidate()
                animationTimer = nil
            }
            .onChange(of: geometry.size) { newSize in
                initializeParticles(in: newSize)
                startAnimation(in: newSize)  // Fix: restart timer with new size
            }
            .onChange(of: colorScheme) { _ in
                reinitializeParticleColors()
            }
        }
    }

    private func initializeParticles(in size: CGSize) {
        guard size.width > 0 && size.height > 0 else { return }

        let filterX = size.width * filterPosition

        particles = (0..<particleCount).map { _ in
            let startX = CGFloat.random(in: -50...(filterX * 0.8))
            return createParticle(startX: startX, height: size.height)
        }
    }

    private func createParticle(startX: CGFloat?, height: CGFloat) -> SandParticle {
        let willPassThrough = CGFloat.random(in: 0...1) < passThrough

        return SandParticle(
            x: startX ?? (-5 - CGFloat.random(in: 0...50)),
            y: CGFloat.random(in: 0...height),
            size: CGFloat.random(in: minSize...maxSize),
            speed: CGFloat.random(in: minSpeed...maxSpeed),
            color: randomParticleColor(),
            opacity: Double.random(in: 0.4...0.9),
            willPassThrough: willPassThrough,
            stopped: false,
            fadeOut: 1.0,
            verticalDrift: (CGFloat.random(in: 0...1) - 0.5) * 0.15
        )
    }

    private func randomParticleColor() -> Color {
        if colorScheme == .dark {
            // Warm ochre/cream particles for dark mode
            let colors: [(r: Double, g: Double, b: Double)] = [
                (220, 215, 200),  // cream
                (200, 185, 160),  // warm cream
                (180, 165, 140),  // ochre/tan
                (210, 200, 180)   // light ochre
            ]
            let c = colors.randomElement()!
            return Color(red: c.r/255, green: c.g/255, blue: c.b/255)
        } else {
            // Gray particles for light mode
            let colors: [(r: Double, g: Double, b: Double)] = [
                (60, 60, 60),
                (70, 70, 70),
                (50, 50, 50),
                (80, 80, 80)
            ]
            let c = colors.randomElement()!
            return Color(red: c.r/255, green: c.g/255, blue: c.b/255)
        }
    }

    private func reinitializeParticleColors() {
        for i in particles.indices {
            particles[i].color = randomParticleColor()
        }
    }

    private func startAnimation(in size: CGSize) {
        animationTimer?.invalidate()
        animationTimer = Timer.scheduledTimer(withTimeInterval: 1.0/30.0, repeats: true) { [self] _ in
            updateParticles(in: size)
        }
    }

    private func updateParticles(in size: CGSize) {
        guard size.width > 0 && size.height > 0 else { return }

        let filterX = size.width * filterPosition

        for i in particles.indices {
            if !particles[i].stopped {
                // Move horizontally
                particles[i].x += particles[i].speed
                // Vertical drift
                particles[i].y += particles[i].verticalDrift

                // Check if hit filter line
                if particles[i].x >= filterX && !particles[i].willPassThrough {
                    particles[i].stopped = true
                    particles[i].x = filterX - particles[i].size
                    particles[i].fadeOut = 1.0
                }
            } else {
                // Fade out stopped particles
                particles[i].fadeOut -= 0.008
                if particles[i].fadeOut <= 0 {
                    // Respawn particle
                    particles[i] = createParticle(startX: nil, height: size.height)
                }
            }

            // Respawn if passed through and went off screen
            if particles[i].x > size.width + 10 {
                particles[i] = createParticle(startX: nil, height: size.height)
            }

            // Wrap vertically
            if particles[i].y < -10 {
                particles[i].y = size.height + 10
            }
            if particles[i].y > size.height + 10 {
                particles[i].y = -10
            }
        }
    }
}

private struct SandParticle {
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var speed: CGFloat
    var color: Color
    var opacity: Double
    var willPassThrough: Bool
    var stopped: Bool
    var fadeOut: Double
    var verticalDrift: CGFloat
}

#Preview {
    SandAnimationView()
        .frame(width: 400, height: 600)
        .background(Color(hex: "0f0f0f"))
        .preferredColorScheme(.dark)
}
