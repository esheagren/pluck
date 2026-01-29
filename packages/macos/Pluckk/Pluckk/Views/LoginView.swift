import SwiftUI

struct LoginView: View {
    @ObservedObject private var authManager = AuthManager.shared
    @Environment(\.colorScheme) var colorScheme

    private var textPrimary: Color {
        colorScheme == .dark ? PluckkTheme.Dark.textPrimary : PluckkTheme.Light.textPrimary
    }

    private var textSecondary: Color {
        colorScheme == .dark ? PluckkTheme.Dark.textSecondary : PluckkTheme.Light.textSecondary
    }

    private var textMuted: Color {
        colorScheme == .dark ? PluckkTheme.Dark.textMuted : PluckkTheme.Light.textMuted
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Welcome text above logo
            Text("Welcome to")
                .font(.system(size: PluckkTheme.FontSize.body))
                .foregroundColor(textSecondary)
                .padding(.bottom, PluckkTheme.Spacing.md)

            // Logo - using the actual PNG from extension
            if let logoImage = NSImage(named: "icon-128") {
                Image(nsImage: logoImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 64, height: 64)
                    .opacity(0.8)
            } else {
                // Fallback
                PluckkLogo(size: 64)
                    .opacity(0.8)
            }

            // App name below logo
            Text("Pluckk")
                .font(.system(size: PluckkTheme.FontSize.title, weight: .semibold))
                .foregroundColor(textPrimary)
                .padding(.top, PluckkTheme.Spacing.md)

            Spacer()

            // Sign in section
            VStack(spacing: PluckkTheme.Spacing.md) {
                Button(action: { authManager.signInWithGoogle() }) {
                    HStack(spacing: PluckkTheme.Spacing.sm) {
                        // Google "G" logo (4-color version)
                        googleLogo
                            .frame(width: 16, height: 16)

                        Text("Sign In")
                            .font(.system(size: PluckkTheme.FontSize.body, weight: .medium))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, PluckkTheme.Spacing.md)
                    .background(Color.white)
                    .foregroundColor(Color(hex: "2d3436"))
                    .cornerRadius(PluckkTheme.Radius.large)
                }
                .buttonStyle(.plain)
                .disabled(authManager.isLoading)
                .shadow(color: Color.black.opacity(0.1), radius: 2, x: 0, y: 1)

                if authManager.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .tint(textSecondary)
                }

                if let error = authManager.error {
                    Text(error)
                        .font(.system(size: PluckkTheme.FontSize.smaller))
                        .foregroundColor(PluckkTheme.Light.error)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, PluckkTheme.Spacing.xl)
            .padding(.bottom, PluckkTheme.Spacing.xxl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // Google "G" logo - 4 color version matching extension
    private var googleLogo: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 24

            // Blue part (top-right arc)
            var bluePath = Path()
            bluePath.move(to: CGPoint(x: 22.56 * scale, y: 12.25 * scale))
            bluePath.addLine(to: CGPoint(x: 22.41 * scale, y: 9.85 * scale))
            bluePath.addLine(to: CGPoint(x: 12 * scale, y: 9.85 * scale))
            bluePath.addLine(to: CGPoint(x: 12 * scale, y: 14.23 * scale))
            bluePath.addLine(to: CGPoint(x: 18.71 * scale, y: 14.23 * scale))
            bluePath.addCurve(
                to: CGPoint(x: 12 * scale, y: 19.15 * scale),
                control1: CGPoint(x: 18.27 * scale, y: 17.18 * scale),
                control2: CGPoint(x: 15.73 * scale, y: 19.15 * scale)
            )
            bluePath.addCurve(
                to: CGPoint(x: 4.85 * scale, y: 12 * scale),
                control1: CGPoint(x: 8.06 * scale, y: 19.15 * scale),
                control2: CGPoint(x: 4.85 * scale, y: 15.94 * scale)
            )
            bluePath.addCurve(
                to: CGPoint(x: 12 * scale, y: 4.85 * scale),
                control1: CGPoint(x: 4.85 * scale, y: 8.06 * scale),
                control2: CGPoint(x: 8.06 * scale, y: 4.85 * scale)
            )
            bluePath.addCurve(
                to: CGPoint(x: 15.54 * scale, y: 6.1 * scale),
                control1: CGPoint(x: 13.37 * scale, y: 4.85 * scale),
                control2: CGPoint(x: 14.56 * scale, y: 5.18 * scale)
            )
            bluePath.addLine(to: CGPoint(x: 19.07 * scale, y: 2.69 * scale))
            bluePath.addCurve(
                to: CGPoint(x: 12 * scale, y: 0 * scale),
                control1: CGPoint(x: 17.42 * scale, y: 0.97 * scale),
                control2: CGPoint(x: 14.96 * scale, y: 0 * scale)
            )
            bluePath.addCurve(
                to: CGPoint(x: 0 * scale, y: 12 * scale),
                control1: CGPoint(x: 5.37 * scale, y: 0 * scale),
                control2: CGPoint(x: 0 * scale, y: 5.37 * scale)
            )
            bluePath.addCurve(
                to: CGPoint(x: 12 * scale, y: 24 * scale),
                control1: CGPoint(x: 0 * scale, y: 18.63 * scale),
                control2: CGPoint(x: 5.37 * scale, y: 24 * scale)
            )
            bluePath.addCurve(
                to: CGPoint(x: 22.56 * scale, y: 12.25 * scale),
                control1: CGPoint(x: 17.73 * scale, y: 24 * scale),
                control2: CGPoint(x: 22.56 * scale, y: 18.6 * scale)
            )
            bluePath.closeSubpath()

            context.fill(bluePath, with: .color(Color(hex: "4285F4")))
        }
    }
}

#Preview {
    LoginView()
        .frame(width: 320, height: 500)
        .background(Color(hex: "0f0f0f"))
        .preferredColorScheme(.dark)
}
