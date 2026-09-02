import AppKit
import SwiftUI

/// A compact card floating just above the Dock, horizontally centred — the same spot
/// as Wispr Flow's pill — on whichever screen the mouse is on. Collapsed it is a short
/// pill-shaped handle; expanded it is a ~340×560 card. It never spans the screen.
class PluckkPanel: NSPanel {
    // Shared instance for easy access from SwiftUI views
    static var shared: PluckkPanel?

    private let collapsedWidth: CGFloat = 120
    private let collapsedHeight: CGFloat = 12
    private let minExpandedWidth: CGFloat = 280
    private let maxExpandedWidth: CGFloat = 500
    private let expandedHeight: CGFloat = 560
    private let bottomMargin: CGFloat = 8
    private(set) var expandedWidth: CGFloat = 340

    private(set) var isExpanded = false
    private var hostingView: NSHostingView<SidebarView>?

    /// Screen the panel currently sits on; compared by frame because NSScreen objects are recreated.
    private var currentScreenFrame: NSRect = .zero
    private var mouseMonitor: Any?

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

        // Panel configuration. The style mask must be borderless BEFORE the frame is set:
        // NSPanel() starts out titled, and a titled window clamps a 12pt-tall frame to a
        // zero-height content rect, which then becomes the whole frame once borderless.
        level = .floating
        styleMask = [.borderless, .nonactivatingPanel]
        setFrame(frame(width: collapsedWidth, height: collapsedHeight, on: screenUnderMouse()), display: true)
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
        // The panel's size is decided here, never by SwiftUI: otherwise the hosting view
        // resizes the window to the content's ideal size, which is 0×0 for the collapsed pill.
        hostingView?.sizingOptions = []
        hostingView?.frame = contentView?.bounds ?? .zero
        hostingView?.autoresizingMask = [.width, .height]
        contentView = hostingView

        // Show the panel
        orderFrontRegardless()
        print("PluckkPanel: collapsed at \(frame)")

        // Monitor for screen changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenParametersChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )

        // Follow the mouse across displays (like Wispr Flow). Only acts when the cursor
        // crosses to a different screen, so the cost is one rect check per move event.
        mouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: .mouseMoved) { [weak self] _ in
            self?.followMouseIfScreenChanged()
        }
    }

    // MARK: - Placement

    /// The screen the mouse cursor is on, falling back to the main screen.
    private func screenUnderMouse() -> NSScreen? {
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? NSScreen.main
    }

    /// Frame for a panel of the given size: horizontally centred on `screen`, resting just
    /// above the Dock (the visible area excludes the menu bar and Dock).
    private func frame(width: CGFloat, height: CGFloat, on screen: NSScreen?) -> NSRect {
        guard let screen else { return NSRect(x: 0, y: 0, width: width, height: height) }
        currentScreenFrame = screen.frame
        let area = screen.visibleFrame
        let w = min(width, area.width)
        let h = min(height, area.height - bottomMargin)
        return NSRect(x: area.midX - w / 2, y: area.minY + bottomMargin, width: w, height: h)
    }

    private func currentFrame(on screen: NSScreen?) -> NSRect {
        isExpanded
            ? frame(width: expandedWidth, height: expandedHeight, on: screen)
            : frame(width: collapsedWidth, height: collapsedHeight, on: screen)
    }

    private func followMouseIfScreenChanged() {
        guard let screen = screenUnderMouse(), screen.frame != currentScreenFrame else { return }
        setFrame(currentFrame(on: screen), display: true)
    }

    @objc private func screenParametersChanged() {
        setFrame(currentFrame(on: screenUnderMouse()), display: true)
    }

    // MARK: - Expand / collapse

    func expand() {
        guard !isExpanded else { return }
        isExpanded = true

        if pushesWindowAside {
            // Account for the collapsed strip width that's already there
            WindowResizer.shared.makeRoomForPanel(panelWidth: expandedWidth)
        }

        // Always open on the screen the cursor is on, even if the handle was elsewhere.
        let screen = screenUnderMouse()
        if screen?.frame != currentScreenFrame {
            setFrame(frame(width: collapsedWidth, height: collapsedHeight, on: screen), display: false)
        }
        let newFrame = frame(width: expandedWidth, height: expandedHeight, on: screen)

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

        let newFrame = frame(width: collapsedWidth, height: collapsedHeight, on: screenUnderMouse())

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
        setFrame(frame(width: expandedWidth, height: expandedHeight, on: screenUnderMouse()), display: true)
        updateHostingView()
    }
}
