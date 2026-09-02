import AppKit
import SwiftUI

/// A compact landscape card (3:2 by default) that stays wherever the user drags it.
/// Collapsed it is a short pill-shaped handle centred under the card's last position.
/// Position and size persist across launches; nothing moves automatically.
class PluckkPanel: NSPanel {
    // Shared instance for easy access from SwiftUI views
    static var shared: PluckkPanel?

    private let collapsedWidth: CGFloat = 120
    private let collapsedHeight: CGFloat = 12
    private let minExpandedWidth: CGFloat = 440
    private let maxExpandedWidth: CGFloat = 900
    private let minExpandedHeight: CGFloat = 280
    private let maxExpandedHeight: CGFloat = 900
    private let bottomMargin: CGFloat = 8
    private(set) var expandedWidth: CGFloat = 600
    private(set) var expandedHeight: CGFloat = 400

    /// Bottom-left corner of the expanded card, once the user has placed it.
    private var savedOrigin: NSPoint?

    private(set) var isExpanded = false
    private var hostingView: NSHostingView<SidebarView>?

    private enum Keys {
        static let originX = "panelOriginX", originY = "panelOriginY"
        static let width = "panelWidth", height = "panelHeight"
    }

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
        restorePlacement()

        // Panel configuration. The style mask must be borderless BEFORE the frame is set:
        // NSPanel() starts out titled, and a titled window clamps a 12pt-tall frame to a
        // zero-height content rect, which then becomes the whole frame once borderless.
        level = .floating
        styleMask = [.borderless, .nonactivatingPanel]
        setFrame(collapsedFrame(), display: true)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        hidesOnDeactivate = false
        isFloatingPanel = true
        becomesKeyOnlyIfNeeded = false  // Allow becoming key to receive clicks
        acceptsMouseMovedEvents = true
        isMovableByWindowBackground = false  // moved only via the grip bar

        // Allow panel to appear on all spaces and work with full-screen apps
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]

        // Set up content view
        let sidebarView = SidebarView(isExpanded: isExpanded, panelWidth: expandedWidth)
        hostingView = NSHostingView(rootView: sidebarView)
        // The panel's size is decided here, never by SwiftUI.
        hostingView?.sizingOptions = []
        hostingView?.frame = contentView?.bounds ?? .zero
        hostingView?.autoresizingMask = [.width, .height]
        contentView = hostingView

        // Show the panel
        orderFrontRegardless()

        // Keep the card on a screen if displays are added/removed
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenParametersChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    // MARK: - Placement

    private func restorePlacement() {
        let d = UserDefaults.standard
        if d.object(forKey: Keys.width) != nil {
            expandedWidth = clampWidth(CGFloat(d.double(forKey: Keys.width)))
            expandedHeight = clampHeight(CGFloat(d.double(forKey: Keys.height)))
        }
        if d.object(forKey: Keys.originX) != nil {
            savedOrigin = NSPoint(x: d.double(forKey: Keys.originX), y: d.double(forKey: Keys.originY))
        }
    }

    private func savePlacement() {
        let d = UserDefaults.standard
        d.set(Double(expandedWidth), forKey: Keys.width)
        d.set(Double(expandedHeight), forKey: Keys.height)
        if let o = savedOrigin {
            d.set(Double(o.x), forKey: Keys.originX)
            d.set(Double(o.y), forKey: Keys.originY)
        }
    }

    private func clampWidth(_ w: CGFloat) -> CGFloat { min(max(w, minExpandedWidth), maxExpandedWidth) }
    private func clampHeight(_ h: CGFloat) -> CGFloat { min(max(h, minExpandedHeight), maxExpandedHeight) }

    /// Screen containing the point, else the one under the mouse, else the main screen.
    private func screen(containing point: NSPoint?) -> NSScreen? {
        if let point, let s = NSScreen.screens.first(where: { NSMouseInRect(point, $0.frame, false) }) { return s }
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? NSScreen.main
    }

    /// Keep a frame entirely inside the visible area of the screen it belongs to.
    private func clamped(_ rect: NSRect, to screen: NSScreen?) -> NSRect {
        guard let area = screen?.visibleFrame else { return rect }
        var r = rect
        r.size.width = min(r.width, area.width)
        r.size.height = min(r.height, area.height)
        r.origin.x = min(max(r.minX, area.minX), area.maxX - r.width)
        r.origin.y = min(max(r.minY, area.minY), area.maxY - r.height)
        return r
    }

    /// Where the card goes: its saved spot, or bottom-centre of the cursor's screen the first time.
    private func expandedFrame() -> NSRect {
        let size = NSSize(width: expandedWidth, height: expandedHeight)
        if let origin = savedOrigin {
            let centre = NSPoint(x: origin.x + size.width / 2, y: origin.y + size.height / 2)
            return clamped(NSRect(origin: origin, size: size), to: screen(containing: centre))
        }
        let s = screen(containing: nil)
        let area = s?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let rect = NSRect(x: area.midX - size.width / 2, y: area.minY + bottomMargin, width: size.width, height: size.height)
        return clamped(rect, to: s)
    }

    /// The pill sits centred along the bottom edge of where the card opens.
    private func collapsedFrame() -> NSRect {
        let card = expandedFrame()
        return NSRect(x: card.midX - collapsedWidth / 2, y: card.minY, width: collapsedWidth, height: collapsedHeight)
    }

    @objc private func screenParametersChanged() {
        setFrame(isExpanded ? expandedFrame() : collapsedFrame(), display: true)
    }

    /// Called by the grip bar after the user finished dragging the card.
    func userMovedPanel() {
        guard isExpanded else { return }
        savedOrigin = frame.origin
        savePlacement()
    }

    // MARK: - Expand / collapse

    func expand() {
        guard !isExpanded else { return }
        isExpanded = true

        if pushesWindowAside {
            WindowResizer.shared.makeRoomForPanel(panelWidth: expandedWidth)
        }

        let newFrame = expandedFrame()

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

        let newFrame = collapsedFrame()

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

    // MARK: - Resizing (left edge → width, bottom edge → height; the top-right corner stays put)

    func resize(to width: CGFloat) {
        guard isExpanded else { return }
        let newWidth = clampWidth(width)
        var f = frame
        f.origin.x += f.width - newWidth
        f.size.width = newWidth
        expandedWidth = newWidth
        savedOrigin = f.origin
        setFrame(f, display: true)
        savePlacement()
        updateHostingView()
    }

    func resizeHeight(to height: CGFloat) {
        guard isExpanded else { return }
        let newHeight = clampHeight(height)
        var f = frame
        f.origin.y += f.height - newHeight
        f.size.height = newHeight
        expandedHeight = newHeight
        savedOrigin = f.origin
        setFrame(f, display: true)
        savePlacement()
    }
}
