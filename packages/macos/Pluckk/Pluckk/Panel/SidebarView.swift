import SwiftUI

struct SidebarView: View {
    let isExpanded: Bool
    @ObservedObject private var appState = AppState.shared
    @Environment(\.colorScheme) var colorScheme

    private var backgroundColor: Color {
        colorScheme == .dark ? PluckkTheme.Dark.background : PluckkTheme.Light.background
    }

    private var surfaceColor: Color {
        colorScheme == .dark ? PluckkTheme.Dark.surface : PluckkTheme.Light.surface
    }

    private var borderColor: Color {
        colorScheme == .dark ? PluckkTheme.Dark.border : PluckkTheme.Light.border
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

            // Always-visible thin strip with sand animation
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
        VStack(spacing: 0) {
            // Header with tabs
            headerView
                .padding(.horizontal, PluckkTheme.Spacing.lg)
                .padding(.top, PluckkTheme.Spacing.lg)
                .padding(.bottom, PluckkTheme.Spacing.md)

            // Divider
            Rectangle()
                .fill(borderColor)
                .frame(height: 1)

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
        .background(backgroundColor)
    }

    private var headerView: some View {
        HStack(spacing: PluckkTheme.Spacing.xxs) {
            // View switcher tabs
            HStack(spacing: PluckkTheme.Spacing.xxs) {
                headerButton(view: .generate, icon: "plus.circle", label: "Create")
                headerButton(view: .browse, icon: "rectangle.stack", label: "Browse")
                headerButton(view: .review, icon: "brain", label: "Review")
            }

            Spacer()

            // Settings button
            Button(action: { appState.currentView = .settings }) {
                Image(systemName: "gear")
                    .font(.system(size: 14))
                    .foregroundColor(appState.currentView == .settings ? textPrimary : textSecondary)
            }
            .buttonStyle(.plain)

            // Collapse button
            Button(action: collapse) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(textSecondary)
            }
            .buttonStyle(.plain)
            .padding(.leading, PluckkTheme.Spacing.sm)
        }
    }

    private func headerButton(view: PanelView, icon: String, label: String) -> some View {
        let isSelected = appState.currentView == view

        return Button(action: { appState.currentView = view }) {
            HStack(spacing: PluckkTheme.Spacing.xxs) {
                Image(systemName: icon)
                    .font(.system(size: PluckkTheme.FontSize.tiny))
                Text(label)
                    .font(.system(size: PluckkTheme.FontSize.tiny, weight: .medium))
            }
            .padding(.horizontal, PluckkTheme.Spacing.sm)
            .padding(.vertical, PluckkTheme.Spacing.xxs)
            .background(
                isSelected
                    ? (colorScheme == .dark
                        ? PluckkTheme.Dark.surfaceSecondary
                        : PluckkTheme.Light.surfaceSecondary)
                    : Color.clear
            )
            .foregroundColor(isSelected ? textPrimary : textSecondary)
            .cornerRadius(PluckkTheme.Radius.medium)
        }
        .buttonStyle(.plain)
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
