import SwiftUI

struct SidebarView: View {
    let isExpanded: Bool
    var panelWidth: CGFloat = 340
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
                    .frame(width: panelWidth)
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
        HStack(spacing: 0) {
            // Glowing silver border on far left edge
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.6),
                            Color.white.opacity(0.3),
                            Color.white.opacity(0.1)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: 1)
                .shadow(color: Color.white.opacity(0.5), radius: 2, x: 0, y: 0)

            // Main content area with resize handle overlaid
            ZStack(alignment: .leading) {
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

                // Resize handle overlaid on left edge (on top of animation)
                ResizeHandle()
            }
        }
    }
}

// MARK: - Resize Handle

struct ResizeHandle: View {
    @Environment(\.colorScheme) var colorScheme
    @State private var isHovering = false
    @State private var isDragging = false
    @GestureState private var dragOffset: CGFloat = 0

    private var handleColor: Color {
        if isDragging {
            return colorScheme == .dark ? Color.white.opacity(0.5) : Color.black.opacity(0.4)
        } else if isHovering {
            return colorScheme == .dark ? Color.white.opacity(0.35) : Color.black.opacity(0.25)
        } else {
            return colorScheme == .dark ? Color.white.opacity(0.2) : Color.black.opacity(0.15)
        }
    }

    var body: some View {
        // Invisible hit area with visible pill indicator
        Color.clear
            .frame(width: 12)
            .contentShape(Rectangle())
            .overlay(
                // Vertical pill indicator
                RoundedRectangle(cornerRadius: 2)
                    .fill(handleColor)
                    .frame(width: 4, height: 40)
            )
            .onHover { hovering in
                isHovering = hovering
                if hovering {
                    NSCursor.resizeLeftRight.push()
                } else {
                    NSCursor.pop()
                }
            }
            .gesture(
                DragGesture()
                    .onChanged { value in
                        isDragging = true
                        // Calculate new width based on drag
                        // Dragging left (negative x) = wider panel
                        // Dragging right (positive x) = narrower panel
                        if let panel = PluckkPanel.shared {
                            let currentWidth = panel.expandedWidth
                            let newWidth = currentWidth - value.translation.width
                            panel.resize(to: newWidth)
                        }
                    }
                    .onEnded { _ in
                        isDragging = false
                    }
            )
    }
}

#Preview {
    SidebarView(isExpanded: true, panelWidth: 340)
        .frame(width: 340, height: 600)
        .preferredColorScheme(.dark)
}
