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

            // Logo and title
            VStack(spacing: PluckkTheme.Spacing.sm) {
                PluckkLogo(size: 64)

                Text("Pluckk")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(textPrimary)

                Text("Create flashcards from anywhere")
                    .font(.system(size: PluckkTheme.FontSize.small, weight: .regular))
                    .foregroundColor(textSecondary)
            }

            Spacer()

            // Sign in section
            VStack(spacing: PluckkTheme.Spacing.md) {
                Button(action: { authManager.signInWithGoogle() }) {
                    HStack(spacing: PluckkTheme.Spacing.sm) {
                        // Google "G" logo
                        googleLogo
                            .frame(width: 18, height: 18)

                        Text("Sign in with Google")
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

            Spacer()

            // Footer with branding
            VStack(spacing: PluckkTheme.Spacing.xs) {
                Text("Your cards sync with pluckk.com")
                    .font(.system(size: PluckkTheme.FontSize.tiny))
                    .foregroundColor(textMuted)

                HStack(spacing: PluckkTheme.Spacing.xxs) {
                    PluckkLogo(size: 14)
                    Text("Pluckk")
                        .font(.system(size: PluckkTheme.FontSize.tiny, weight: .medium))
                        .foregroundColor(textSecondary)
                }
            }
            .padding(.bottom, PluckkTheme.Spacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // Google "G" logo
    private var googleLogo: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 24

            var path = Path()

            // Google G shape
            path.move(to: CGPoint(x: 22.56 * scale, y: 12.25 * scale))
            path.addCurve(
                to: CGPoint(x: 12 * scale, y: 24 * scale),
                control1: CGPoint(x: 22.56 * scale, y: 18.6 * scale),
                control2: CGPoint(x: 17.73 * scale, y: 24 * scale)
            )
            path.addCurve(
                to: CGPoint(x: 0 * scale, y: 12 * scale),
                control1: CGPoint(x: 5.37 * scale, y: 24 * scale),
                control2: CGPoint(x: 0 * scale, y: 18.63 * scale)
            )
            path.addCurve(
                to: CGPoint(x: 12 * scale, y: 0 * scale),
                control1: CGPoint(x: 0 * scale, y: 5.37 * scale),
                control2: CGPoint(x: 5.37 * scale, y: 0 * scale)
            )
            path.addCurve(
                to: CGPoint(x: 19.07 * scale, y: 2.69 * scale),
                control1: CGPoint(x: 14.96 * scale, y: 0 * scale),
                control2: CGPoint(x: 17.42 * scale, y: 0.97 * scale)
            )
            path.addLine(to: CGPoint(x: 15.54 * scale, y: 6.1 * scale))
            path.addCurve(
                to: CGPoint(x: 12 * scale, y: 4.85 * scale),
                control1: CGPoint(x: 14.56 * scale, y: 5.18 * scale),
                control2: CGPoint(x: 13.37 * scale, y: 4.85 * scale)
            )
            path.addCurve(
                to: CGPoint(x: 4.85 * scale, y: 12 * scale),
                control1: CGPoint(x: 8.06 * scale, y: 4.85 * scale),
                control2: CGPoint(x: 4.85 * scale, y: 8.06 * scale)
            )
            path.addCurve(
                to: CGPoint(x: 12 * scale, y: 19.15 * scale),
                control1: CGPoint(x: 4.85 * scale, y: 15.94 * scale),
                control2: CGPoint(x: 8.06 * scale, y: 19.15 * scale)
            )
            path.addCurve(
                to: CGPoint(x: 18.71 * scale, y: 14.23 * scale),
                control1: CGPoint(x: 15.73 * scale, y: 19.15 * scale),
                control2: CGPoint(x: 18.27 * scale, y: 17.18 * scale)
            )
            path.addLine(to: CGPoint(x: 12 * scale, y: 14.23 * scale))
            path.addLine(to: CGPoint(x: 12 * scale, y: 9.85 * scale))
            path.addLine(to: CGPoint(x: 22.41 * scale, y: 9.85 * scale))
            path.addCurve(
                to: CGPoint(x: 22.56 * scale, y: 12.25 * scale),
                control1: CGPoint(x: 22.5 * scale, y: 10.59 * scale),
                control2: CGPoint(x: 22.56 * scale, y: 11.39 * scale)
            )
            path.closeSubpath()

            // Multi-color Google G
            context.fill(path, with: .color(Color(hex: "4285f4")))

            // Simplified - just show blue G for now
        }
    }
}

#Preview {
    LoginView()
        .frame(width: 320, height: 500)
        .background(Color(hex: "0f0f0f"))
}
