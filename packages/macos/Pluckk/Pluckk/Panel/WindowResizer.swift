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

    /// Captured target window (captured before panel expands)
    private var capturedWindowElement: AXUIElement?
    private var capturedAppPID: pid_t?

    private init() {}

    /// Call this BEFORE expanding the panel to capture the current frontmost window
    func captureTargetWindow() {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            print("WindowResizer: captureTargetWindow - No frontmost application")
            capturedWindowElement = nil
            capturedAppPID = nil
            return
        }

        // Don't capture our own app
        if frontApp.bundleIdentifier == Bundle.main.bundleIdentifier {
            print("WindowResizer: captureTargetWindow - Frontmost is Pluckk, not capturing")
            capturedWindowElement = nil
            capturedAppPID = nil
            return
        }

        print("WindowResizer: captureTargetWindow - Capturing \(frontApp.localizedName ?? "unknown")")

        let pid = frontApp.processIdentifier
        let appElement = AXUIElementCreateApplication(pid)

        var focusedWindow: CFTypeRef?
        let windowResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindow
        )

        if windowResult == .success, let window = focusedWindow {
            capturedWindowElement = (window as! AXUIElement)
            capturedAppPID = pid
            print("WindowResizer: captureTargetWindow - Successfully captured window")
        } else {
            print("WindowResizer: captureTargetWindow - Could not get focused window, error: \(windowResult.rawValue)")
            capturedWindowElement = nil
            capturedAppPID = nil
        }
    }

    /// Shrinks the previously captured window to make room for Pluckk panel
    /// - Parameter panelWidth: The width of the Pluckk panel to make room for
    func makeRoomForPanel(panelWidth: CGFloat) {
        print("WindowResizer: makeRoomForPanel called with width \(panelWidth)")

        guard let windowElement = capturedWindowElement,
              let pid = capturedAppPID else {
            print("WindowResizer: No captured window to resize")
            return
        }

        print("WindowResizer: Using previously captured window (PID: \(pid))")

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
