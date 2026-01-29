import AppKit
import SwiftUI

class PluckkPanel: NSPanel {
    private let collapsedWidth: CGFloat = 10
    private let expandedWidth: CGFloat = 340

    private(set) var isExpanded = false
    private var hostingView: NSHostingView<SidebarView>?

    override init(contentRect: NSRect, styleMask style: NSWindow.StyleMask, backing backingStoreType: NSWindow.BackingStoreType, defer flag: Bool) {
        super.init(contentRect: contentRect, styleMask: style, backing: backingStoreType, defer: flag)
    }

    // Allow panel to become key window for button clicks
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    func setup() {
        guard let screen = NSScreen.main else { return }
        let screenFrame = screen.visibleFrame

        // Initial frame - collapsed on right edge
        let frame = NSRect(
            x: screenFrame.maxX - collapsedWidth,
            y: screenFrame.minY,
            width: collapsedWidth,
            height: screenFrame.height
        )

        setFrame(frame, display: true)

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
        let sidebarView = SidebarView(isExpanded: isExpanded)
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

    @objc private func screenParametersChanged() {
        repositionToActiveScreen()
    }

    private func repositionToActiveScreen() {
        guard let screen = NSScreen.main else { return }
        let screenFrame = screen.visibleFrame
        let currentWidth = isExpanded ? expandedWidth : collapsedWidth

        let newFrame = NSRect(
            x: screenFrame.maxX - currentWidth,
            y: screenFrame.minY,
            width: currentWidth,
            height: screenFrame.height
        )

        setFrame(newFrame, display: true)
    }

    func expand() {
        guard !isExpanded else { return }
        isExpanded = true

        guard let screen = NSScreen.main else { return }
        let screenFrame = screen.visibleFrame

        let newFrame = NSRect(
            x: screenFrame.maxX - expandedWidth,
            y: screenFrame.minY,
            width: expandedWidth,
            height: screenFrame.height
        )

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

        guard let screen = NSScreen.main else { return }
        let screenFrame = screen.visibleFrame

        let newFrame = NSRect(
            x: screenFrame.maxX - collapsedWidth,
            y: screenFrame.minY,
            width: collapsedWidth,
            height: screenFrame.height
        )

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
        hostingView?.rootView = SidebarView(isExpanded: isExpanded)
    }
}
