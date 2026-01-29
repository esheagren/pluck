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
        print("WindowResizer: makeRoomForPanel called with width \(panelWidth)")

        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            print("WindowResizer: No frontmost application")
            return
        }

        print("WindowResizer: Frontmost app: \(frontApp.localizedName ?? "unknown") (\(frontApp.bundleIdentifier ?? "no bundle id"))")

        // Don't resize our own app
        if frontApp.bundleIdentifier == Bundle.main.bundleIdentifier {
            print("WindowResizer: Frontmost is Pluckk, skipping")
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
            print("WindowResizer: Could not get focused window, error: \(windowResult.rawValue)")
            return
        }

        let windowElement = window as! AXUIElement

        // Get current window frame
        guard let currentFrame = getWindowFrame(windowElement) else {
            print("WindowResizer: Could not get window frame")
            return
        }

        print("WindowResizer: Current window frame: \(currentFrame)")

        // Get screen bounds
        guard let screen = NSScreen.main else {
            print("WindowResizer: No main screen")
            return
        }
        let screenFrame = screen.frame
        print("WindowResizer: Screen frame: \(screenFrame)")

        // Store original frame for restoration
        originalFrame = currentFrame
        resizedAppPID = pid
        resizedWindowElement = windowElement

        // Calculate new width (shrink by panel width)
        let newWidth = currentFrame.width - panelWidth
        guard newWidth > 200 else {
            // Don't make window too small
            print("WindowResizer: Window would be too small (\(newWidth)), skipping resize")
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

        let success = setWindowFrame(windowElement, frame: newFrame)
        if success {
            print("WindowResizer: Successfully resized window from \(currentFrame.width) to \(newWidth)")
        } else {
            print("WindowResizer: Failed to resize window")
            originalFrame = nil
            resizedAppPID = nil
            resizedWindowElement = nil
        }
    }

    /// Restores the previously resized window to its original size
    func restoreWindow() {
        print("WindowResizer: restoreWindow called")

        guard let originalFrame = originalFrame,
              let pid = resizedAppPID else {
            print("WindowResizer: No window to restore")
            return
        }

        print("WindowResizer: Restoring window for PID \(pid) to frame \(originalFrame)")

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
            let success = setWindowFrame(windowElement, frame: originalFrame)
            if success {
                print("WindowResizer: Successfully restored window to original size \(originalFrame.width)")
            } else {
                print("WindowResizer: Failed to restore window")
            }
        } else {
            print("WindowResizer: Could not find window to restore, error: \(windowResult.rawValue)")
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

    @discardableResult
    private func setWindowFrame(_ window: AXUIElement, frame: CGRect) -> Bool {
        var success = true

        // Set size first (some apps behave better this way)
        var size = frame.size
        if let sizeValue = AXValueCreate(.cgSize, &size) {
            let sizeResult = AXUIElementSetAttributeValue(
                window,
                kAXSizeAttribute as CFString,
                sizeValue
            )
            if sizeResult != .success {
                print("WindowResizer: Failed to set size, error: \(sizeResult.rawValue)")
                success = false
            }
        } else {
            print("WindowResizer: Failed to create size AXValue")
            success = false
        }

        // Set position
        var position = frame.origin
        if let positionValue = AXValueCreate(.cgPoint, &position) {
            let posResult = AXUIElementSetAttributeValue(
                window,
                kAXPositionAttribute as CFString,
                positionValue
            )
            if posResult != .success {
                print("WindowResizer: Failed to set position, error: \(posResult.rawValue)")
                success = false
            }
        } else {
            print("WindowResizer: Failed to create position AXValue")
            success = false
        }

        return success
    }
}
