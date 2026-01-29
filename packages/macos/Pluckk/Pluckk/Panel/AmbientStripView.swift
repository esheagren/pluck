import SwiftUI

/// Sand/particle animation strip that matches the Chrome extension's sand-animation.ts
/// Uses warm ochre tones in dark mode, gray tones in light mode
struct AmbientStripView: View {
    enum State {
        case idle
        case generating
        case ready
        case syncing
    }

    let state: State

    @Environment(\.colorScheme) var colorScheme
    @SwiftUI.State private var particles: [Particle] = []
    @SwiftUI.State private var animationTimer: Timer?

    private let particleCount = 80
    private let baseSpeed: CGFloat = 0.4

    var body: some View {
        GeometryReader { geometry in
            Canvas { context, size in
                // Draw background - matches extension's dark theme
                let bgColor = colorScheme == .dark
                    ? PluckkTheme.Dark.surface
                    : PluckkTheme.Light.surfaceSecondary
                context.fill(
                    Path(CGRect(origin: .zero, size: size)),
                    with: .color(bgColor)
                )

                // Draw particles
                for particle in particles {
                    let rect = CGRect(
                        x: particle.x,
                        y: particle.y,
                        width: particle.size,
                        height: particle.size
                    )
                    context.fill(
                        Path(ellipseIn: rect),
                        with: .color(particle.color.opacity(particle.opacity))
                    )
                }

                // Draw subtle edge highlight based on state
                let edgeGradient = Gradient(colors: [
                    stateColor.opacity(0.15),
                    stateColor.opacity(0.02)
                ])
                let edgeRect = CGRect(x: 0, y: 0, width: 2, height: size.height)
                context.fill(
                    Path(edgeRect),
                    with: .linearGradient(
                        edgeGradient,
                        startPoint: CGPoint(x: 0, y: size.height / 2),
                        endPoint: CGPoint(x: 2, y: size.height / 2)
                    )
                )
            }
            .onAppear {
                initializeParticles(in: geometry.size)
                startAnimation(in: geometry.size)
            }
            .onDisappear {
                animationTimer?.invalidate()
            }
            .onChange(of: geometry.size) { newSize in
                initializeParticles(in: newSize)
            }
            .onChange(of: colorScheme) { _ in
                // Reinitialize particles with new colors when theme changes
                initializeParticles(in: geometry.size)
            }
        }
    }

    private var stateColor: Color {
        switch state {
        case .idle: return colorScheme == .dark ? PluckkTheme.accentLight : Color.gray
        case .generating: return .blue
        case .ready: return .green
        case .syncing: return .orange
        }
    }

    private var animationSpeed: CGFloat {
        switch state {
        case .idle: return baseSpeed
        case .generating: return baseSpeed * 2.5
        case .ready: return baseSpeed * 0.7
        case .syncing: return baseSpeed * 2
        }
    }

    private func initializeParticles(in size: CGSize) {
        guard size.height > 0 else { return }

        particles = (0..<particleCount).map { _ in
            Particle(
                x: CGFloat.random(in: 0...size.width),
                y: CGFloat.random(in: 0...size.height),
                size: CGFloat.random(in: 1.5...3),
                speed: CGFloat.random(in: 0.3...1.0),
                opacity: Double.random(in: 0.3...0.6),
                color: randomParticleColor(),
                direction: Bool.random() ? 1 : -1
            )
        }
    }

    /// Returns particle colors matching the extension's sand animation
    /// Dark mode: warm ochre/cream tones
    /// Light mode: gray tones
    private func randomParticleColor() -> Color {
        let colors: [Color]

        if colorScheme == .dark {
            // Warm ochre/cream particles for dark mode (matches extension)
            colors = [
                Color(red: 220/255, green: 215/255, blue: 200/255), // cream
                Color(red: 200/255, green: 185/255, blue: 160/255), // warm cream
                Color(red: 180/255, green: 165/255, blue: 140/255), // ochre/tan
                Color(red: 210/255, green: 200/255, blue: 180/255), // light ochre
                PluckkTheme.accentLight                               // brand accent
            ]
        } else {
            // Gray particles for light mode (matches extension)
            colors = [
                Color(white: 0.24),  // dark gray
                Color(white: 0.28),  // slightly lighter
                Color(white: 0.20),  // darker
                Color(white: 0.31)   // lighter
            ]
        }

        return colors.randomElement() ?? colors[0]
    }

    private func startAnimation(in size: CGSize) {
        animationTimer?.invalidate()
        animationTimer = Timer.scheduledTimer(withTimeInterval: 1.0/30.0, repeats: true) { _ in
            updateParticles(in: size)
        }
    }

    private func updateParticles(in size: CGSize) {
        guard size.height > 0 else { return }

        for i in particles.indices {
            // Move particle vertically (like sand falling)
            particles[i].y += particles[i].speed * animationSpeed * CGFloat(particles[i].direction)

            // Add slight horizontal drift for organic movement
            particles[i].x += CGFloat.random(in: -0.15...0.15)
            particles[i].x = max(0, min(size.width, particles[i].x))

            // Wrap around vertically
            if particles[i].y > size.height + 5 {
                particles[i].y = -5
                particles[i].x = CGFloat.random(in: 0...size.width)
                particles[i].color = randomParticleColor()
                particles[i].opacity = Double.random(in: 0.3...0.6)
            } else if particles[i].y < -5 {
                particles[i].y = size.height + 5
                particles[i].x = CGFloat.random(in: 0...size.width)
                particles[i].color = randomParticleColor()
                particles[i].opacity = Double.random(in: 0.3...0.6)
            }

            // Subtle opacity pulsing
            particles[i].opacity += Double.random(in: -0.015...0.015)
            particles[i].opacity = max(0.2, min(0.6, particles[i].opacity))
        }
    }
}

private struct Particle {
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var speed: CGFloat
    var opacity: Double
    var color: Color
    var direction: Int
}

#Preview {
    HStack(spacing: 20) {
        VStack {
            Text("Idle")
                .foregroundColor(.white)
            AmbientStripView(state: .idle)
                .frame(width: 10, height: 200)
        }
        VStack {
            Text("Generating")
                .foregroundColor(.white)
            AmbientStripView(state: .generating)
                .frame(width: 10, height: 200)
        }
        VStack {
            Text("Ready")
                .foregroundColor(.white)
            AmbientStripView(state: .ready)
                .frame(width: 10, height: 200)
        }
        VStack {
            Text("Syncing")
                .foregroundColor(.white)
            AmbientStripView(state: .syncing)
                .frame(width: 10, height: 200)
        }
    }
    .padding()
    .background(Color(hex: "0f0f0f"))
    .preferredColorScheme(.dark)
}
