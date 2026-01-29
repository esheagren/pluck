import AppKit
import ApplicationServices

/// Manages resizing of external application windows to make room for Pluckk panel
class WindowResizer {
    static let shared = WindowResizer()

    /// Stored original frame of the window we resized
    private var originalFrame: CGRect?
    /// The PID of the app whose window we resized
    private var resizedAppPID: pid_t?
    /// The window element we resized (for verification)
    private var resizedWindowElement: AXUIElement?

    private init() {}

    /// Shrinks the frontmost window to make room for Pluckk panel
    /// - Parameter panelWidth: The width of the Pluckk panel to make room for
    func makeRoomForPanel(panelWidth: CGFloat) {
        guard let frontApp = NSWorkspace.shared.frontmostApplication,
              frontApp.bundleIdentifier != Bundle.main.bundleIdentifier else {
            // Don't resize our own app
            return
        }

        let pid = frontApp.processIdentifier
        let appElement = AXUIElementCreateApplication(pid)

        // Get the focused window
        var focusedWindow: CFTypeRef?
        let windowResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindow
        )

        guard windowResult == .success,
              let window = focusedWindow else {
            print("WindowResizer: Could not get focused window")
            return
        }

        let windowElement = window as! AXUIElement

        // Get current window frame
        guard let currentFrame = getWindowFrame(windowElement) else {
            print("WindowResizer: Could not get window frame")
            return
        }

        // Get screen bounds to check if window is on the right edge
        guard let screen = NSScreen.main else { return }
        let screenFrame = screen.frame

        // Only resize if window extends to (or near) the right edge
        let windowRightEdge = currentFrame.origin.x + currentFrame.width
        let screenRightEdge = screenFrame.origin.x + screenFrame.width
        let threshold: CGFloat = 50 // Within 50px of right edge

        guard screenRightEdge - windowRightEdge < threshold else {
            print("WindowResizer: Window not near right edge, skipping resize")
            return
        }

        // Store original frame for restoration
        originalFrame = currentFrame
        resizedAppPID = pid
        resizedWindowElement = windowElement

        // Calculate new width (shrink by panel width)
        let newWidth = currentFrame.width - panelWidth
        guard newWidth > 200 else {
            // Don't make window too small
            print("WindowResizer: Window would be too small, skipping resize")
            originalFrame = nil
            resizedAppPID = nil
            resizedWindowElement = nil
            return
        }

        // Set new frame (keep position, reduce width)
        let newFrame = CGRect(
            x: currentFrame.origin.x,
            y: currentFrame.origin.y,
            width: newWidth,
            height: currentFrame.height
        )

        setWindowFrame(windowElement, frame: newFrame)
        print("WindowResizer: Resized window from \(currentFrame.width) to \(newWidth)")
    }

    /// Restores the previously resized window to its original size
    func restoreWindow() {
        guard let originalFrame = originalFrame,
              let pid = resizedAppPID else {
            return
        }

        // Try to find the same window again
        let appElement = AXUIElementCreateApplication(pid)

        var focusedWindow: CFTypeRef?
        let windowResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindow
        )

        if windowResult == .success, let window = focusedWindow {
            let windowElement = window as! AXUIElement
            setWindowFrame(windowElement, frame: originalFrame)
            print("WindowResizer: Restored window to original size \(originalFrame.width)")
        }

        // Clear stored state
        self.originalFrame = nil
        self.resizedAppPID = nil
        self.resizedWindowElement = nil
    }

    // MARK: - Private Helpers

    private func getWindowFrame(_ window: AXUIElement) -> CGRect? {
        // Get position
        var positionValue: CFTypeRef?
        let posResult = AXUIElementCopyAttributeValue(
            window,
            kAXPositionAttribute as CFString,
            &positionValue
        )

        guard posResult == .success,
              let posValue = positionValue else {
            return nil
        }

        var position = CGPoint.zero
        if !AXValueGetValue(posValue as! AXValue, .cgPoint, &position) {
            return nil
        }

        // Get size
        var sizeValue: CFTypeRef?
        let sizeResult = AXUIElementCopyAttributeValue(
            window,
            kAXSizeAttribute as CFString,
            &sizeValue
        )

        guard sizeResult == .success,
              let szValue = sizeValue else {
            return nil
        }

        var size = CGSize.zero
        if !AXValueGetValue(szValue as! AXValue, .cgSize, &size) {
            return nil
        }

        return CGRect(origin: position, size: size)
    }

    private func setWindowFrame(_ window: AXUIElement, frame: CGRect) {
        // Set position
        var position = frame.origin
        if let positionValue = AXValueCreate(.cgPoint, &position) {
            AXUIElementSetAttributeValue(
                window,
                kAXPositionAttribute as CFString,
                positionValue
            )
        }

        // Set size
        var size = frame.size
        if let sizeValue = AXValueCreate(.cgSize, &size) {
            AXUIElementSetAttributeValue(
                window,
                kAXSizeAttribute as CFString,
                sizeValue
            )
        }
    }
}
