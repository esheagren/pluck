import SwiftUI

/// Pluckk logo - hand plucking icon matching the extension's icon.svg
struct PluckkLogo: View {
    var size: CGFloat = 64

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 128

            // Background circle with gradient
            let circleRect = CGRect(x: 4 * scale, y: 4 * scale, width: 120 * scale, height: 120 * scale)
            let gradient = Gradient(colors: [
                Color(hex: "2d3436"),
                Color(hex: "1a1a1a")
            ])
            context.fill(
                Path(ellipseIn: circleRect),
                with: .linearGradient(
                    gradient,
                    startPoint: CGPoint(x: 4 * scale, y: 4 * scale),
                    endPoint: CGPoint(x: 124 * scale, y: 124 * scale)
                )
            )

            // Draw hand with fingers
            var handPath = Path()

            // Thumb
            handPath.move(to: CGPoint(x: 45 * scale, y: 75 * scale))
            handPath.addQuadCurve(
                to: CGPoint(x: 52 * scale, y: 50 * scale),
                control: CGPoint(x: 40 * scale, y: 60 * scale)
            )

            // Index finger
            handPath.move(to: CGPoint(x: 55 * scale, y: 80 * scale))
            handPath.addLine(to: CGPoint(x: 55 * scale, y: 55 * scale))
            handPath.addQuadCurve(
                to: CGPoint(x: 58 * scale, y: 42 * scale),
                control: CGPoint(x: 55 * scale, y: 45 * scale)
            )

            // Middle finger
            handPath.move(to: CGPoint(x: 68 * scale, y: 80 * scale))
            handPath.addLine(to: CGPoint(x: 68 * scale, y: 48 * scale))
            handPath.addQuadCurve(
                to: CGPoint(x: 72 * scale, y: 35 * scale),
                control: CGPoint(x: 68 * scale, y: 38 * scale)
            )

            // Ring finger
            handPath.move(to: CGPoint(x: 80 * scale, y: 80 * scale))
            handPath.addLine(to: CGPoint(x: 80 * scale, y: 52 * scale))
            handPath.addQuadCurve(
                to: CGPoint(x: 83 * scale, y: 40 * scale),
                control: CGPoint(x: 80 * scale, y: 42 * scale)
            )

            // Pinky
            handPath.move(to: CGPoint(x: 90 * scale, y: 78 * scale))
            handPath.addLine(to: CGPoint(x: 90 * scale, y: 58 * scale))
            handPath.addQuadCurve(
                to: CGPoint(x: 92 * scale, y: 48 * scale),
                control: CGPoint(x: 90 * scale, y: 50 * scale)
            )

            // Palm base
            handPath.move(to: CGPoint(x: 42 * scale, y: 80 * scale))
            handPath.addQuadCurve(
                to: CGPoint(x: 55 * scale, y: 100 * scale),
                control: CGPoint(x: 42 * scale, y: 95 * scale)
            )
            handPath.addLine(to: CGPoint(x: 85 * scale, y: 100 * scale))
            handPath.addQuadCurve(
                to: CGPoint(x: 95 * scale, y: 80 * scale),
                control: CGPoint(x: 95 * scale, y: 95 * scale)
            )

            context.stroke(
                handPath,
                with: .color(.white),
                style: StrokeStyle(lineWidth: 5 * scale, lineCap: .round, lineJoin: .round)
            )

            // Pluck action lines
            var actionLines = Path()

            actionLines.move(to: CGPoint(x: 48 * scale, y: 38 * scale))
            actionLines.addLine(to: CGPoint(x: 42 * scale, y: 32 * scale))

            actionLines.move(to: CGPoint(x: 55 * scale, y: 35 * scale))
            actionLines.addLine(to: CGPoint(x: 52 * scale, y: 28 * scale))

            actionLines.move(to: CGPoint(x: 62 * scale, y: 33 * scale))
            actionLines.addLine(to: CGPoint(x: 62 * scale, y: 25 * scale))

            context.stroke(
                actionLines,
                with: .color(.white),
                style: StrokeStyle(lineWidth: 3 * scale, lineCap: .round, lineJoin: .round)
            )
        }
        .frame(width: size, height: size)
    }
}

/// Animated logo text with shimmer effect
struct PluckkLogoText: View {
    @State private var shimmerOffset: CGFloat = -1

    var body: some View {
        Text("Pluckk")
            .font(.system(size: PluckkTheme.FontSize.display, weight: .semibold))
            .foregroundStyle(
                LinearGradient(
                    colors: [
                        Color(hex: "2d3436"),
                        PluckkTheme.accent,
                        Color(hex: "2d3436")
                    ],
                    startPoint: UnitPoint(x: shimmerOffset, y: 0.5),
                    endPoint: UnitPoint(x: shimmerOffset + 0.5, y: 0.5)
                )
            )
            .onAppear {
                withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: false)) {
                    shimmerOffset = 1.5
                }
            }
    }
}

#Preview {
    VStack(spacing: 20) {
        PluckkLogo(size: 64)
        PluckkLogo(size: 128)
        PluckkLogoText()
    }
    .padding()
    .background(Color.black)
}
