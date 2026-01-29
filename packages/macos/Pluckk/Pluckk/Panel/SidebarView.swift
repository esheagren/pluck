import SwiftUI

struct SidebarView: View {
    let isExpanded: Bool
    @ObservedObject private var appState = AppState.shared
    @Environment(\.colorScheme) var colorScheme

    private var backgroundColor: Color {
        colorScheme == .dark ? PluckkTheme.Dark.background : PluckkTheme.Light.background
    }

    private var textPrimary: Color {
        colorScheme == .dark ? PluckkTheme.Dark.textPrimary : PluckkTheme.Light.textPrimary
    }

    private var textSecondary: Color {
        colorScheme == .dark ? PluckkTheme.Dark.textSecondary : PluckkTheme.Light.textSecondary
    }

    var body: some View {
        HStack(spacing: 0) {
            if isExpanded {
                expandedContent
                    .frame(width: 330)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }

            // Always-visible thin strip with ambient animation
            AmbientStripView(state: stripState)
                .frame(width: 10)
        }
        .frame(maxHeight: .infinity)
        .animation(.easeInOut(duration: PluckkTheme.Animation.slow), value: isExpanded)
    }

    private var stripState: AmbientStripView.State {
        if appState.isGenerating {
            return .generating
        } else if !appState.generatedCards.isEmpty {
            return .ready
        }
        return .idle
    }

    @ViewBuilder
    private var expandedContent: some View {
        ZStack {
            // Background color
            backgroundColor.ignoresSafeArea()

            // Sand animation background (full panel)
            SandAnimationView()

            // Content
            VStack(spacing: 0) {
                // Header matching extension design
                headerView
                    .padding(.horizontal, PluckkTheme.Spacing.lg)
                    .padding(.top, PluckkTheme.Spacing.lg)
                    .padding(.bottom, PluckkTheme.Spacing.md)

                // Main content based on current view
                Group {
                    switch appState.currentView {
                    case .generate:
                        if appState.isAuthenticated {
                            CardGenerationView()
                        } else {
                            LoginView()
                        }
                    case .browse:
                        if appState.isAuthenticated {
                            CardBrowserView()
                        } else {
                            LoginView()
                        }
                    case .review:
                        if appState.isAuthenticated {
                            ReviewSessionView()
                        } else {
                            LoginView()
                        }
                    case .settings:
                        SettingsView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private var headerView: some View {
        HStack {
            // Logo text matching extension
            Text("Pluckk")
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(textPrimary)

            Spacer()

            // Close/collapse button (X icon like extension)
            Button(action: collapse) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(textSecondary)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
    }

    private func collapse() {
        if let appDelegate = NSApp.delegate as? AppDelegate {
            appDelegate.panel.collapse()
        }
    }
}

#Preview {
    SidebarView(isExpanded: true)
        .frame(width: 340, height: 600)
        .preferredColorScheme(.dark)
}
