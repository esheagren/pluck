import SwiftUI

struct SidebarView: View {
    let isExpanded: Bool
    @ObservedObject private var appState = AppState.shared

    var body: some View {
        HStack(spacing: 0) {
            if isExpanded {
                expandedContent
                    .frame(width: 330)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }

            // Always-visible thin strip
            AmbientStripView(state: stripState)
                .frame(width: 10)
        }
        .frame(maxHeight: .infinity)
        .animation(.easeInOut(duration: 0.25), value: isExpanded)
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
            // Header
            headerView
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 12)

            Divider()

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
        .background(.ultraThinMaterial)
    }

    private var headerView: some View {
        HStack {
            // View switcher
            HStack(spacing: 4) {
                headerButton(view: .generate, icon: "plus.circle", label: "Create")
                headerButton(view: .browse, icon: "rectangle.stack", label: "Browse")
                headerButton(view: .review, icon: "brain", label: "Review")
            }

            Spacer()

            // Settings button
            Button(action: { appState.currentView = .settings }) {
                Image(systemName: "gear")
                    .font(.system(size: 14))
                    .foregroundColor(appState.currentView == .settings ? .accentColor : .secondary)
            }
            .buttonStyle(.plain)

            // Collapse button
            Button(action: collapse) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .padding(.leading, 8)
        }
    }

    private func headerButton(view: PanelView, icon: String, label: String) -> some View {
        Button(action: { appState.currentView = view }) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 11))
                Text(label)
                    .font(.system(size: 11, weight: .medium))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(appState.currentView == view ? Color.accentColor.opacity(0.15) : Color.clear)
            .foregroundColor(appState.currentView == view ? .accentColor : .secondary)
            .cornerRadius(6)
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
}
