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
        print("WindowResizer: === captureTargetWindow START ===")

        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            print("WindowResizer: FAIL - No frontmost application")
            capturedWindowElement = nil
            capturedAppPID = nil
            return
        }

        let appName = frontApp.localizedName ?? "unknown"
        let bundleId = frontApp.bundleIdentifier ?? "no-bundle-id"
        let myBundleId = Bundle.main.bundleIdentifier ?? "no-bundle-id"

        print("WindowResizer: Frontmost: '\(appName)' (\(bundleId))")
        print("WindowResizer: My bundle: \(myBundleId)")

        // Don't capture our own app
        if bundleId == myBundleId {
            print("WindowResizer: FAIL - Frontmost is Pluckk itself")
            capturedWindowElement = nil
            capturedAppPID = nil
            return
        }

        let pid = frontApp.processIdentifier
        print("WindowResizer: Getting window for PID \(pid)")

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
            print("WindowResizer: SUCCESS - Captured window for '\(appName)'")
        } else {
            print("WindowResizer: FAIL - Could not get focused window, AX error: \(windowResult.rawValue)")
            capturedWindowElement = nil
            capturedAppPID = nil
        }

        // Final state check
        print("WindowResizer: === captureTargetWindow END === captured=\(capturedWindowElement != nil), pid=\(capturedAppPID ?? 0)")
    }

    /// Shrinks the previously captured window to make room for Pluckk panel
    /// - Parameter panelWidth: The width of the Pluckk panel to make room for
    func makeRoomForPanel(panelWidth: CGFloat) {
        print("WindowResizer: === makeRoomForPanel START === width=\(panelWidth)")
        print("WindowResizer: State check - capturedWindowElement=\(capturedWindowElement != nil), capturedAppPID=\(capturedAppPID ?? 0)")

        guard let windowElement = capturedWindowElement,
              let pid = capturedAppPID else {
            print("WindowResizer: ABORT - No captured window (element=\(capturedWindowElement != nil), pid=\(capturedAppPID ?? 0))")
            return
        }

        print("WindowResizer: Using captured window PID=\(pid)")

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

        // Only change the width - don't touch position
        let newSize = CGSize(width: newWidth, height: currentFrame.height)

        let success = setWindowSize(windowElement, size: newSize)
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
            let originalSize = CGSize(width: originalFrame.width, height: originalFrame.height)
            let success = setWindowSize(windowElement, size: originalSize)
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
    private func setWindowSize(_ window: AXUIElement, size: CGSize) -> Bool {
        var mutableSize = size
        guard let sizeValue = AXValueCreate(.cgSize, &mutableSize) else {
            print("WindowResizer: Failed to create size AXValue")
            return false
        }

        let result = AXUIElementSetAttributeValue(
            window,
            kAXSizeAttribute as CFString,
            sizeValue
        )

        if result != .success {
            print("WindowResizer: Failed to set size, error: \(result.rawValue)")
            return false
        }

        return true
    }
}
