import AppKit
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    var panel: PluckkPanel!
    var statusItem: NSStatusItem!
    var doubleCmdDetector: DoubleCmdDetector!
    var selectionReader: SelectionReader!

    @ObservedObject var appState = AppState.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Check accessibility permissions
        if !checkAccessibilityPermissions() {
            showPermissionsWindow()
        }

        setupPanel()
        setupMenuBar()
        setupDoubleCmdDetector()
        selectionReader = SelectionReader()

        // Hide dock icon (we're a menu bar app)
        NSApp.setActivationPolicy(.accessory)
    }

    func applicationWillTerminate(_ notification: Notification) {
        doubleCmdDetector?.stop()
    }

    // MARK: - Setup

    private func setupPanel() {
        panel = PluckkPanel()
        panel.setup()
    }

    private func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "rectangle.stack.fill", accessibilityDescription: "Pluckk")
            button.action = #selector(menuBarClicked)
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
    }

    private func setupDoubleCmdDetector() {
        doubleCmdDetector = DoubleCmdDetector()
        doubleCmdDetector.onDoubleTap = { [weak self] in
            self?.handleDoubleTap()
        }
        doubleCmdDetector.start()
    }

    // MARK: - Actions

    @objc private func menuBarClicked(_ sender: NSStatusBarButton) {
        guard let event = NSApp.currentEvent else { return }

        if event.type == .rightMouseUp {
            showContextMenu()
        } else {
            togglePanel()
        }
    }

    private func showContextMenu() {
        let menu = NSMenu()

        menu.addItem(NSMenuItem(title: "Browse Cards", action: #selector(showBrowse), keyEquivalent: "b"))
        menu.addItem(NSMenuItem(title: "Review Due Cards", action: #selector(showReview), keyEquivalent: "r"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Settings...", action: #selector(showSettings), keyEquivalent: ","))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Pluckk", action: #selector(quit), keyEquivalent: "q"))

        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    @objc private func showBrowse() {
        appState.currentView = .browse
        WindowResizer.shared.captureTargetWindow()
        panel.expand()
    }

    @objc private func showReview() {
        appState.currentView = .review
        WindowResizer.shared.captureTargetWindow()
        panel.expand()
    }

    @objc private func showSettings() {
        appState.currentView = .settings
        WindowResizer.shared.captureTargetWindow()
        panel.expand()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    private func togglePanel() {
        if panel.isExpanded {
            panel.collapse()
        } else {
            WindowResizer.shared.captureTargetWindow()
            panel.expand()
        }
    }

    private func handleDoubleTap() {
        print("AppDelegate: handleDoubleTap called, panel.isExpanded=\(panel.isExpanded)")

        // If panel is expanded, collapse it
        if panel.isExpanded {
            print("AppDelegate: Panel is expanded, collapsing")
            panel.collapse()
            return
        }

        // Capture the target window BEFORE we do anything else
        // This ensures we get the right window before Pluckk takes focus
        print("AppDelegate: About to capture target window")
        WindowResizer.shared.captureTargetWindow()
        print("AppDelegate: Capture complete, continuing with content detection")

        // Try to get selected text via Accessibility API
        if let selectedText = selectionReader.getSelectedText(), !selectedText.isEmpty {
            let context = selectionReader.getSourceContext()
            appState.capturedContent = .text(selectedText)
            appState.sourceContext = context
            appState.currentView = .generate
            panel.expand()
            return
        }

        // Check clipboard for image
        if let image = selectionReader.getClipboardImage() {
            let context = selectionReader.getSourceContext()
            appState.capturedContent = .image(image)
            appState.sourceContext = context
            appState.currentView = .generate
            panel.expand()
            return
        }

        // Check clipboard for text
        if let clipboardText = selectionReader.getClipboardText(), !clipboardText.isEmpty {
            let context = selectionReader.getSourceContext()
            appState.capturedContent = .text(clipboardText)
            appState.sourceContext = context
            appState.currentView = .generate
            panel.expand()
            return
        }

        // Nothing captured - show panel with prompt
        appState.capturedContent = nil
        appState.currentView = .generate
        print("AppDelegate: About to expand panel")
        panel.expand()
        print("AppDelegate: Panel expand called")
    }

    // MARK: - Permissions

    private func checkAccessibilityPermissions() -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): false] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    private func showPermissionsWindow() {
        let alert = NSAlert()
        alert.messageText = "Accessibility Permission Required"
        alert.informativeText = "Pluckk needs accessibility permission to capture text selections and detect the double-tap ⌘ shortcut.\n\nClick 'Open Settings' to grant permission, then restart Pluckk."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Open Settings")
        alert.addButton(withTitle: "Later")

        let response = alert.runModal()
        if response == .alertFirstButtonReturn {
            // Request permission (this will show the system prompt)
            let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
            _ = AXIsProcessTrustedWithOptions(options)
        }
    }
}
