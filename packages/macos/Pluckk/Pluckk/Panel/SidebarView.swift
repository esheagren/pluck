import SwiftUI

struct SidebarView: View {
    let isExpanded: Bool
    @ObservedObject private var appState = AppState.shared
    @Environment(\.colorScheme) var colorScheme

    private var backgroundColor: Color {
        colorScheme == .dark ? PluckkTheme.Dark.background : PluckkTheme.Light.background
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
}

#Preview {
    SidebarView(isExpanded: true)
        .frame(width: 340, height: 600)
        .preferredColorScheme(.dark)
}
