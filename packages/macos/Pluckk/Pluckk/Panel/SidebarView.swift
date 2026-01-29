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
                // Full expanded panel (strip transforms into this)
                expandedContent
                    .frame(width: 340)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                // Thin strip only when collapsed
                AmbientStripView(state: stripState)
                    .frame(width: 10)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
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
            // allowsHitTesting(false) ensures clicks pass through to buttons
            SandAnimationView()
                .allowsHitTesting(false)

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
            Button {
                collapsePanel()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(textSecondary)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .onHover { hovering in
                if hovering {
                    NSCursor.pointingHand.push()
                } else {
                    NSCursor.pop()
                }
            }
        }
    }

    private func collapsePanel() {
        PluckkPanel.shared?.collapse()
    }
}

#Preview {
    SidebarView(isExpanded: true)
        .frame(width: 340, height: 600)
        .preferredColorScheme(.dark)
}
