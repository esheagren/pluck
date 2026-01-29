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

    /// Continuously tracked last external (non-Pluckk) frontmost app
    private var lastExternalAppPID: pid_t?
    private var lastExternalAppName: String?

    private init() {
        // Start tracking frontmost app changes
        startTrackingFrontmostApp()
    }

    /// Continuously monitors frontmost app and remembers the last non-Pluckk app
    private func startTrackingFrontmostApp() {
        // Observe app activation changes
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.updateLastExternalApp()
        }

        // Also do an initial check
        updateLastExternalApp()
    }

    private func updateLastExternalApp() {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else { return }

        let bundleId = frontApp.bundleIdentifier ?? ""
        let myBundleId = Bundle.main.bundleIdentifier ?? ""

        // Only track non-Pluckk apps
        if bundleId != myBundleId {
            lastExternalAppPID = frontApp.processIdentifier
            lastExternalAppName = frontApp.localizedName
            print("WindowResizer: Tracking external app: '\(lastExternalAppName ?? "unknown")' (PID: \(lastExternalAppPID ?? 0))")
        }
    }

    /// Call this BEFORE expanding the panel to capture the current frontmost window
    /// Uses the continuously tracked last external app since Pluckk may already be frontmost
    func captureTargetWindow() {
        print("WindowResizer: === captureTargetWindow START ===")
        print("WindowResizer: Last tracked external app: '\(lastExternalAppName ?? "none")' (PID: \(lastExternalAppPID ?? 0))")

        var targetPID: pid_t?
        var targetName: String?

        // First try: use tracked external app
        if let pid = lastExternalAppPID {
            targetPID = pid
            targetName = lastExternalAppName
            print("WindowResizer: Using tracked app")
        } else {
            // Fallback: find an active external app from running applications
            print("WindowResizer: No tracked app, searching running applications...")
            if let found = findActiveExternalApp() {
                targetPID = found.pid
                targetName = found.name
                print("WindowResizer: Found fallback app: '\(found.name)' (PID: \(found.pid))")
            }
        }

        guard let pid = targetPID else {
            print("WindowResizer: FAIL - No external app found")
            capturedWindowElement = nil
            capturedAppPID = nil
            return
        }

        print("WindowResizer: Capturing window for '\(targetName ?? "unknown")' (PID: \(pid))")

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
            print("WindowResizer: SUCCESS - Captured window for '\(targetName ?? "unknown")'")
        } else {
            print("WindowResizer: FAIL - Could not get focused window, AX error: \(windowResult.rawValue)")
            capturedWindowElement = nil
            capturedAppPID = nil
        }

        // Final state check
        print("WindowResizer: === captureTargetWindow END === captured=\(capturedWindowElement != nil), pid=\(capturedAppPID ?? 0)")
    }

    /// Fallback: find an active external app that has a window
    private func findActiveExternalApp() -> (pid: pid_t, name: String)? {
        let myBundleId = Bundle.main.bundleIdentifier ?? ""

        // Get all running apps that are regular apps (not background)
        let runningApps = NSWorkspace.shared.runningApplications.filter {
            $0.activationPolicy == .regular &&
            $0.bundleIdentifier != myBundleId &&
            !$0.isTerminated
        }

        print("WindowResizer: Found \(runningApps.count) regular external apps")

        // Try each app to find one with a focusable window
        for app in runningApps {
            let pid = app.processIdentifier
            let appElement = AXUIElementCreateApplication(pid)

            var focusedWindow: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(
                appElement,
                kAXFocusedWindowAttribute as CFString,
                &focusedWindow
            )

            if result == .success && focusedWindow != nil {
                let name = app.localizedName ?? "unknown"
                print("WindowResizer: App '\(name)' has a focused window")
                return (pid, name)
            }
        }

        return nil
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
