import SwiftUI

struct AmbientStripView: View {
    enum State {
        case idle
        case generating
        case ready
        case syncing
    }

    let state: State

    @SwiftUI.State private var particles: [Particle] = []
    @SwiftUI.State private var animationTimer: Timer?

    private let particleCount = 60
    private let baseSpeed: CGFloat = 0.5

    var body: some View {
        GeometryReader { geometry in
            Canvas { context, size in
                // Draw subtle background
                let bgGradient = Gradient(colors: [
                    Color.black.opacity(0.3),
                    Color.black.opacity(0.4)
                ])
                context.fill(
                    Path(CGRect(origin: .zero, size: size)),
                    with: .linearGradient(bgGradient, startPoint: .leading, endPoint: .trailing)
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

                // Draw edge highlight
                let edgeGradient = Gradient(colors: [
                    stateColor.opacity(0.1),
                    stateColor.opacity(0.02)
                ])
                let edgeRect = CGRect(x: 0, y: 0, width: 3, height: size.height)
                context.fill(
                    Path(edgeRect),
                    with: .linearGradient(edgeGradient, startPoint: .leading, endPoint: .trailing)
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
        }
    }

    private var stateColor: Color {
        switch state {
        case .idle: return .gray
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
                size: CGFloat.random(in: 1...2.5),
                speed: CGFloat.random(in: 0.3...1.0),
                opacity: Double.random(in: 0.2...0.5),
                color: particleColor,
                direction: Bool.random() ? 1 : -1
            )
        }
    }

    private var particleColor: Color {
        switch state {
        case .idle:
            return [Color(white: 0.7), Color(white: 0.8), Color(white: 0.75)].randomElement()!
        case .generating:
            return [Color.blue.opacity(0.8), Color.cyan.opacity(0.7), Color(white: 0.8)].randomElement()!
        case .ready:
            return [Color.green.opacity(0.7), Color.mint.opacity(0.6), Color(white: 0.8)].randomElement()!
        case .syncing:
            return [Color.orange.opacity(0.7), Color.yellow.opacity(0.6), Color(white: 0.8)].randomElement()!
        }
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
            // Move particle vertically
            particles[i].y += particles[i].speed * animationSpeed * CGFloat(particles[i].direction)

            // Add slight horizontal drift
            particles[i].x += CGFloat.random(in: -0.1...0.1)
            particles[i].x = max(0, min(size.width, particles[i].x))

            // Wrap around vertically
            if particles[i].y > size.height + 5 {
                particles[i].y = -5
                particles[i].x = CGFloat.random(in: 0...size.width)
                particles[i].color = particleColor
            } else if particles[i].y < -5 {
                particles[i].y = size.height + 5
                particles[i].x = CGFloat.random(in: 0...size.width)
                particles[i].color = particleColor
            }

            // Subtle opacity pulsing
            particles[i].opacity += Double.random(in: -0.01...0.01)
            particles[i].opacity = max(0.15, min(0.5, particles[i].opacity))
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
            AmbientStripView(state: .idle)
                .frame(width: 10, height: 200)
        }
        VStack {
            Text("Generating")
            AmbientStripView(state: .generating)
                .frame(width: 10, height: 200)
        }
        VStack {
            Text("Ready")
            AmbientStripView(state: .ready)
                .frame(width: 10, height: 200)
        }
        VStack {
            Text("Syncing")
            AmbientStripView(state: .syncing)
                .frame(width: 10, height: 200)
        }
    }
    .padding()
    .background(Color.black)
}
