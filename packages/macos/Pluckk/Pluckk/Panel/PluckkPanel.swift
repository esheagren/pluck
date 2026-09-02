import AppKit
import SwiftUI

/// A compact card that hugs the right edge of the screen, vertically centred — the
/// same neighbourhood as Wispr Flow's pill. Collapsed it is a short pill-sized handle;
/// expanded it is a ~340×560 card. It never spans the full screen height.
class PluckkPanel: NSPanel {
    // Shared instance for easy access from SwiftUI views
    static var shared: PluckkPanel?

    private let collapsedWidth: CGFloat = 10
    private let collapsedHeight: CGFloat = 120
    private let minExpandedWidth: CGFloat = 280
    private let maxExpandedWidth: CGFloat = 500
    private let expandedHeight: CGFloat = 560
    private(set) var expandedWidth: CGFloat = 340

    private(set) var isExpanded = false
    private var hostingView: NSHostingView<SidebarView>?

    /// Off by default: the panel floats over the active app. Turning it on shoves the
    /// frontmost window aside (and pulls it out of full screen), which is intrusive on
    /// narrow or portrait displays.
    static let pushWindowAsideKey = "pushWindowAside"
    private var pushesWindowAside: Bool { UserDefaults.standard.bool(forKey: Self.pushWindowAsideKey) }

    override init(contentRect: NSRect, styleMask style: NSWindow.StyleMask, backing backingStoreType: NSWindow.BackingStoreType, defer flag: Bool) {
        super.init(contentRect: contentRect, styleMask: style, backing: backingStoreType, defer: flag)
    }

    // Allow panel to become key window for button clicks
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    func setup() {
        // Set shared instance for access from SwiftUI views
        PluckkPanel.shared = self

        setFrame(frame(width: collapsedWidth, height: collapsedHeight), display: true)

        // Panel configuration
        level = .floating
        styleMask = [.borderless, .nonactivatingPanel]
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        hidesOnDeactivate = false
        isFloatingPanel = true
        becomesKeyOnlyIfNeeded = false  // Allow becoming key to receive clicks
        acceptsMouseMovedEvents = true

        // Allow panel to appear on all spaces and work with full-screen apps
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]

        // Set up content view
        let sidebarView = SidebarView(isExpanded: isExpanded, panelWidth: expandedWidth)
        hostingView = NSHostingView(rootView: sidebarView)
        hostingView?.frame = contentView?.bounds ?? .zero
        hostingView?.autoresizingMask = [.width, .height]
        contentView = hostingView

        // Show the panel
        orderFrontRegardless()

        // Monitor for screen changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenParametersChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    /// Frame for a panel of the given size: flush with the right edge of the main screen,
    /// vertically centred in the visible area (below the menu bar, above the Dock).
    private func frame(width: CGFloat, height: CGFloat) -> NSRect {
        guard let screen = NSScreen.main else { return NSRect(x: 0, y: 0, width: width, height: height) }
        let area = screen.visibleFrame
        let h = min(height, area.height)
        return NSRect(x: area.maxX - width, y: area.midY - h / 2, width: width, height: h)
    }

    @objc private func screenParametersChanged() {
        repositionToActiveScreen()
    }

    private func repositionToActiveScreen() {
        let target = isExpanded
            ? frame(width: expandedWidth, height: expandedHeight)
            : frame(width: collapsedWidth, height: collapsedHeight)
        setFrame(target, display: true)
    }

    func expand() {
        guard !isExpanded else { return }
        isExpanded = true

        if pushesWindowAside {
            // Account for the collapsed strip width that's already there
            WindowResizer.shared.makeRoomForPanel(panelWidth: expandedWidth - collapsedWidth)
        }

        let newFrame = frame(width: expandedWidth, height: expandedHeight)

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            self.animator().setFrame(newFrame, display: true)
        } completionHandler: {
            // Make panel key so buttons receive clicks
            self.makeKey()
        }

        updateHostingView()
    }

    func collapse() {
        guard isExpanded else { return }
        isExpanded = false

        // No-op unless expand() resized a window
        WindowResizer.shared.restoreWindow()

        let newFrame = frame(width: collapsedWidth, height: collapsedHeight)

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.2
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            self.animator().setFrame(newFrame, display: true)
        }

        // Reset state when collapsing
        AppState.shared.reset()
        updateHostingView()
    }

    func toggle() {
        if isExpanded {
            collapse()
        } else {
            expand()
        }
    }

    private func updateHostingView() {
        hostingView?.rootView = SidebarView(isExpanded: isExpanded, panelWidth: expandedWidth)
    }

    func resize(to width: CGFloat) {
        guard isExpanded else { return }

        expandedWidth = min(max(width, minExpandedWidth), maxExpandedWidth)
        setFrame(frame(width: expandedWidth, height: expandedHeight), display: true)
        updateHostingView()
    }
}
