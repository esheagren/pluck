import AppKit
import ApplicationServices

/// Manages resizing of external application windows to make room for Pluckk panel
class WindowResizer {
    static let shared = WindowResizer()

    /// Check if we have accessibility permissions (required for window resizing)
    var hasAccessibilityPermission: Bool {
        return AXIsProcessTrusted()
    }

    /// Stored original frame of the window we resized
    private var originalFrame: CGRect?
    /// The PID of the app whose window we resized
    private var resizedAppPID: pid_t?
    /// The window element we resized (for verification)
    private var resizedWindowElement: AXUIElement?
    /// Whether AXEnhancedUserInterface was enabled (for Chrome/Electron apps)
    private var wasEnhancedUIEnabled: Bool?
    /// The app element for AXEnhancedUserInterface restoration
    private var resizedAppElement: AXUIElement?
    /// Whether the window was in full-screen/tiled mode before we resized it
    private var wasInFullScreenMode: Bool = false

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

        // Also do an initial check - but if nothing found, scan all apps
        updateLastExternalApp()

        // If still no tracked app, find the most recently active one
        if lastExternalAppPID == nil {
            print("WindowResizer: No frontmost app on init, scanning for active apps...")
            if let found = findActiveExternalApp() {
                lastExternalAppPID = found.pid
                lastExternalAppName = found.name
                print("WindowResizer: Found active app on init: '\(found.name)' (PID: \(found.pid))")
            }
        }
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
        print("")
        print("╔════════════════════════════════════════════════════════════╗")
        print("║ WindowResizer: captureTargetWindow START                   ║")
        print("╠════════════════════════════════════════════════════════════╣")
        print("║ Last tracked external app: '\(lastExternalAppName ?? "none")'")
        print("║ Last tracked PID: \(lastExternalAppPID ?? 0)")
        print("╚════════════════════════════════════════════════════════════╝")

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

        // Use kAXWindowsAttribute instead of kAXFocusedWindowAttribute
        // This works for background apps that don't have a "focused" window
        print("🔍 WindowResizer: Getting main window for app...")
        if let window = getMainWindow(for: appElement) {
            capturedWindowElement = window
            capturedAppPID = pid

            // Get window frame for logging
            if let frame = getWindowFrame(window) {
                print("✅ WindowResizer: Captured window for '\(targetName ?? "unknown")'")
                print("   Window frame: (\(frame.origin.x), \(frame.origin.y)) \(frame.width)x\(frame.height)")
            } else {
                print("✅ WindowResizer: Captured window for '\(targetName ?? "unknown")' (couldn't read frame)")
            }
        } else {
            print("❌ WindowResizer: Could not get any window for app")
            capturedWindowElement = nil
            capturedAppPID = nil
        }

        print("╔════════════════════════════════════════════════════════════╗")
        print("║ WindowResizer: captureTargetWindow END                     ║")
        print("║ Captured: \(capturedWindowElement != nil ? "YES" : "NO"), PID: \(capturedAppPID ?? 0)")
        print("╚════════════════════════════════════════════════════════════╝")
        print("")
    }

    /// Gets the main/largest visible window for an app using kAXWindowsAttribute
    /// This works for background apps unlike kAXFocusedWindowAttribute
    private func getMainWindow(for appElement: AXUIElement) -> AXUIElement? {
        // First try: kAXMainWindowAttribute (some apps expose this)
        var mainWindow: CFTypeRef?
        let mainResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXMainWindowAttribute as CFString,
            &mainWindow
        )
        if mainResult == .success, let window = mainWindow {
            print("WindowResizer: Found main window via kAXMainWindowAttribute")
            // Force cast is safe here - AX API guarantees this is an AXUIElement
            return (window as! AXUIElement)
        }

        // Second try: kAXFocusedWindowAttribute (works if app was recently focused)
        var focusedWindow: CFTypeRef?
        let focusedResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindow
        )
        if focusedResult == .success, let window = focusedWindow {
            print("WindowResizer: Found window via kAXFocusedWindowAttribute")
            // Force cast is safe here - AX API guarantees this is an AXUIElement
            return (window as! AXUIElement)
        }

        // Third try: kAXWindowsAttribute - get all windows and pick the best one
        var windowsValue: CFTypeRef?
        let windowsResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXWindowsAttribute as CFString,
            &windowsValue
        )

        guard windowsResult == .success,
              let windows = windowsValue as? [AXUIElement],
              !windows.isEmpty else {
            print("WindowResizer: kAXWindowsAttribute failed or returned empty, error: \(windowsResult.rawValue)")
            return nil
        }

        print("WindowResizer: Found \(windows.count) windows via kAXWindowsAttribute")

        // Get screen bounds to filter out off-screen windows
        let screenFrame = NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1920, height: 1080)
        let maxReasonableWidth = screenFrame.width * 2  // Allow for multi-monitor but filter crazy values
        let maxReasonableHeight = screenFrame.height * 2

        // Filter to visible, standard windows and pick the largest ON-SCREEN window
        var bestWindow: AXUIElement?
        var bestArea: CGFloat = 0

        for window in windows {
            // Check if it's a standard window (not a utility panel, dialog, etc.)
            if !isStandardWindow(window) {
                continue
            }

            // Get window frame
            guard let frame = getWindowFrame(window) else {
                continue
            }

            // Filter out windows that are too small
            guard frame.width > 100 && frame.height > 100 else {
                print("WindowResizer: Skipping tiny window: \(frame.width)x\(frame.height)")
                continue
            }

            // Filter out windows that are completely off-screen (negative coordinates way off)
            if frame.origin.x < -1000 || frame.origin.y < -1000 {
                print("WindowResizer: Skipping off-screen window at (\(frame.origin.x), \(frame.origin.y))")
                continue
            }

            // Filter out windows that are absurdly large (like Finder desktop)
            if frame.width > maxReasonableWidth || frame.height > maxReasonableHeight {
                print("WindowResizer: Skipping oversized window: \(frame.width)x\(frame.height)")
                continue
            }

            let area = frame.width * frame.height
            if area > bestArea {
                bestArea = area
                bestWindow = window
            }
        }

        if let window = bestWindow {
            print("WindowResizer: Selected window with area \(bestArea)")
            return window
        }

        // Fallback: just return the first window if filtering failed
        print("WindowResizer: No suitable window found via filtering, using first window")
        return windows.first
    }

    /// Checks if a window is a standard window (not a utility panel, sheet, etc.)
    private func isStandardWindow(_ window: AXUIElement) -> Bool {
        // Check subrole - standard windows have AXStandardWindow subrole
        var subroleValue: CFTypeRef?
        let subroleResult = AXUIElementCopyAttributeValue(
            window,
            kAXSubroleAttribute as CFString,
            &subroleValue
        )

        if subroleResult == .success, let subrole = subroleValue as? String {
            // Accept standard windows and dialogs
            let validSubroles = ["AXStandardWindow", "AXDialog", "AXFloatingWindow"]
            if validSubroles.contains(subrole) {
                return true
            }
            print("WindowResizer: Skipping window with subrole: \(subrole)")
            return false
        }

        // If we can't determine subrole, assume it's standard
        return true
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

        // Try each app to find one with any window (using kAXWindowsAttribute)
        for app in runningApps {
            let pid = app.processIdentifier
            let appElement = AXUIElementCreateApplication(pid)

            // Use kAXWindowsAttribute to check for any windows
            var windowsValue: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(
                appElement,
                kAXWindowsAttribute as CFString,
                &windowsValue
            )

            if result == .success,
               let windows = windowsValue as? [AXUIElement],
               !windows.isEmpty {
                let name = app.localizedName ?? "unknown"
                print("WindowResizer: App '\(name)' has \(windows.count) window(s)")
                return (pid, name)
            }
        }

        return nil
    }

    /// Shrinks the previously captured window to make room for Pluckk panel
    /// - Parameter panelWidth: The width of the Pluckk panel to make room for
    func makeRoomForPanel(panelWidth: CGFloat) {
        print("")
        print("╔════════════════════════════════════════════════════════════╗")
        print("║ WindowResizer: makeRoomForPanel START                      ║")
        print("╠════════════════════════════════════════════════════════════╣")
        print("║ Panel width to make room for: \(panelWidth)")
        print("║ Accessibility permission: \(hasAccessibilityPermission)")
        print("║ Captured window element: \(capturedWindowElement != nil ? "YES" : "NO")")
        print("║ Captured app PID: \(capturedAppPID ?? 0)")
        print("╚════════════════════════════════════════════════════════════╝")

        // Check accessibility permission first
        guard hasAccessibilityPermission else {
            print("⚠️ WindowResizer: ABORT - No accessibility permission!")
            print("   Grant in System Settings > Privacy & Security > Accessibility")
            return
        }

        guard let windowElement = capturedWindowElement,
              let pid = capturedAppPID else {
            print("⚠️ WindowResizer: ABORT - No captured window!")
            print("   capturedWindowElement: \(capturedWindowElement != nil)")
            print("   capturedAppPID: \(capturedAppPID ?? 0)")
            print("   Did you call captureTargetWindow() first?")
            return
        }

        // Get the app name for better logging
        var appName = "Unknown"
        if let app = NSRunningApplication(processIdentifier: pid) {
            appName = app.localizedName ?? "Unknown"
        }
        print("📱 WindowResizer: Target app: '\(appName)' (PID: \(pid))")

        // Check if window is resizable
        print("🔍 WindowResizer: Checking if window is resizable...")
        if !isWindowResizable(windowElement) {
            print("⚠️ WindowResizer: Window is NOT resizable, skipping")
            return
        }
        print("✅ WindowResizer: Window IS resizable")

        // Get current window frame
        print("🔍 WindowResizer: Getting current window frame...")
        guard let currentFrame = getWindowFrame(windowElement) else {
            print("⚠️ WindowResizer: Could not get window frame!")
            return
        }

        print("📐 WindowResizer: Current window frame:")
        print("   Origin: (\(currentFrame.origin.x), \(currentFrame.origin.y))")
        print("   Size: \(currentFrame.width) x \(currentFrame.height)")

        // Check if window is zoomed (maximized) - this can prevent resizing
        let isZoomed = isWindowZoomed(windowElement)
        print("🔍 WindowResizer: Window zoomed state: \(isZoomed)")

        // Check if window is at full screen width (another sign of maximized state)
        let screenWidth = NSScreen.main?.frame.width ?? 0
        let isFullWidth = abs(currentFrame.width - screenWidth) < 10
        print("🔍 WindowResizer: Window at full screen width: \(isFullWidth) (\(currentFrame.width) vs \(screenWidth))")

        // Check for full screen attribute
        var fullScreenValue: CFTypeRef?
        let fsResult = AXUIElementCopyAttributeValue(windowElement, "AXFullScreen" as CFString, &fullScreenValue)
        var isInFullScreen = false
        if fsResult == .success, let isFullScreen = fullScreenValue as? Bool {
            isInFullScreen = isFullScreen
            print("🔍 WindowResizer: AXFullScreen attribute: \(isFullScreen)")
        }

        // List all window attributes for debugging (look for tile/snap related ones)
        var attrNames: CFArray?
        if AXUIElementCopyAttributeNames(windowElement, &attrNames) == .success,
           let names = attrNames as? [String] {
            let relevantAttrs = names.filter {
                $0.contains("Size") || $0.contains("Position") || $0.contains("Zoom") ||
                $0.contains("Full") || $0.contains("Tile") || $0.contains("Split")
            }
            if !relevantAttrs.isEmpty {
                print("🔍 WindowResizer: Relevant attributes: \(relevantAttrs)")
            }
        }

        // If window is in full-screen/tiled mode, we need special handling
        if isInFullScreen {
            print("⚠️ WindowResizer: Window is in FULL-SCREEN/TILED mode")
            print("   This mode blocks external resizing. Attempting to exit...")

            // Remember that it was in full-screen so we can restore it
            wasInFullScreenMode = true

            // Exit full-screen mode
            let exitResult = AXUIElementSetAttributeValue(
                windowElement,
                "AXFullScreen" as CFString,
                false as CFBoolean
            )

            if exitResult == .success {
                print("✅ WindowResizer: Exited full-screen mode")
                usleep(500000) // 500ms for animation to complete

                // After exiting full-screen, the window will be at some arbitrary size
                // We need to resize it to fill the screen minus the panel
                guard let screen = NSScreen.main else { return }
                let menuBarHeight: CGFloat = 37  // Approximate menu bar height

                // Calculate the frame that fills the screen minus the panel
                let targetFrame = CGRect(
                    x: 0,
                    y: menuBarHeight,
                    width: screen.frame.width - panelWidth,
                    height: screen.frame.height - menuBarHeight
                )

                print("📐 WindowResizer: Resizing to fill screen minus panel: \(targetFrame)")

                // Set the window to this frame
                if setWindowFrame(windowElement, frame: targetFrame) {
                    print("✅ WindowResizer: Window resized to make room for panel")

                    if verifyWindowResize(windowElement, expectedFrame: targetFrame, tolerance: 100) {
                        print("✅ WindowResizer: Resize verified!")
                    } else {
                        print("⚠️ WindowResizer: Resize may not have worked perfectly")
                    }
                }

                // We're done - the full-screen exit + resize worked
                print("╔════════════════════════════════════════════════════════════╗")
                print("║ WindowResizer: makeRoomForPanel END (full-screen handled)  ║")
                print("╚════════════════════════════════════════════════════════════╝")
                print("")
                return
            } else {
                print("⚠️ WindowResizer: Failed to exit full-screen: \(axErrorDescription(exitResult))")
                wasInFullScreenMode = false
            }
        }

        // If window appears maximized but NOT full-screen, try other methods
        if isZoomed || isFullWidth {
            print("⚠️ WindowResizer: Window appears maximized (but not full-screen)")

            // List available actions for debugging
            listWindowActions(windowElement)

            // Try raising the window first (may help break tiled state)
            print("   Trying to raise window...")
            raiseWindow(windowElement)
            usleep(50000) // 50ms

            // Try clicking zoom button to un-maximize
            if isZoomed {
                print("   Trying zoom button method...")
                if unzoomWindow(windowElement) {
                    // Re-read the frame after un-zooming
                    if let newFrame = getWindowFrame(windowElement) {
                        print("   After un-zoom, new frame: (\(newFrame.origin.x), \(newFrame.origin.y)) \(newFrame.width)x\(newFrame.height)")
                        // Update originalFrame to the un-zoomed state
                        originalFrame = newFrame
                    }
                }
            }
        }

        // Get screen bounds
        guard let screen = NSScreen.main else {
            print("WindowResizer: No main screen")
            return
        }
        let screenFrame = screen.frame
        print("WindowResizer: Screen frame: \(screenFrame)")

        // Store original frame for restoration (before any modifications)
        originalFrame = currentFrame
        resizedAppPID = pid
        resizedWindowElement = windowElement

        // Get the working frame (may be different if we un-zoomed)
        var workingFrame = currentFrame
        if let updatedFrame = getWindowFrame(windowElement), updatedFrame != currentFrame {
            print("📐 WindowResizer: Working frame updated to: (\(updatedFrame.origin.x), \(updatedFrame.origin.y)) \(updatedFrame.width)x\(updatedFrame.height)")
            workingFrame = updatedFrame
        }

        // Calculate new width (shrink by panel width)
        let newWidth = workingFrame.width - panelWidth
        guard newWidth > 200 else {
            // Don't make window too small
            print("WindowResizer: Window would be too small (\(newWidth)), skipping resize")
            originalFrame = nil
            resizedAppPID = nil
            resizedWindowElement = nil
            return
        }

        // Calculate new frame: keep left edge pinned, only reduce width
        let newFrame = CGRect(
            x: workingFrame.origin.x,      // Keep left edge pinned
            y: workingFrame.origin.y,      // Keep vertical position
            width: newWidth,
            height: workingFrame.height
        )

        print("📐 WindowResizer: Target window frame:")
        print("   Origin: (\(newFrame.origin.x), \(newFrame.origin.y)) [SAME]")
        print("   Size: \(newFrame.width) x \(newFrame.height) [width reduced by \(panelWidth)]")

        // Handle AXEnhancedUserInterface for Chrome/Electron apps
        let appElement = AXUIElementCreateApplication(pid)
        resizedAppElement = appElement
        wasEnhancedUIEnabled = getEnhancedUserInterface(for: appElement)

        if wasEnhancedUIEnabled == true {
            print("🔧 WindowResizer: Disabling AXEnhancedUserInterface for resize")
            setEnhancedUserInterface(for: appElement, enabled: false)
            // Small delay to let the change take effect
            usleep(50000) // 50ms
        }

        print("🚀 WindowResizer: Calling setWindowFrame...")
        let success = setWindowFrame(windowElement, frame: newFrame)

        // Re-enable AXEnhancedUserInterface after resize
        if wasEnhancedUIEnabled == true {
            // Slight delay before re-enabling
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                if let appElement = self?.resizedAppElement {
                    print("WindowResizer: Re-enabling AXEnhancedUserInterface")
                    self?.setEnhancedUserInterface(for: appElement, enabled: true)
                }
            }
        }

        if success {
            print("✅ WindowResizer: setWindowFrame returned success")
            // Verify the resize actually worked
            print("🔍 WindowResizer: Verifying resize...")
            if verifyWindowResize(windowElement, expectedFrame: newFrame) {
                print("✅ WindowResizer: Resize VERIFIED - window moved as expected!")
            } else {
                print("⚠️ WindowResizer: Resize verification FAILED - trying fallback method...")

                // FALLBACK: Try moving window slightly to break any "snapped" state
                print("🔧 WindowResizer: Attempting to break snapped state by moving window...")

                // Move window 1 pixel right, then back
                let nudgedPosition = CGPoint(x: workingFrame.origin.x + 1, y: workingFrame.origin.y)
                setWindowPosition(windowElement, position: nudgedPosition)
                usleep(50000) // 50ms

                // Now try the full resize again
                print("🔧 WindowResizer: Retrying resize after nudge...")
                let retrySuccess = setWindowFrame(windowElement, frame: newFrame)

                if retrySuccess && verifyWindowResize(windowElement, expectedFrame: newFrame) {
                    print("✅ WindowResizer: Fallback resize VERIFIED!")
                } else {
                    print("❌ WindowResizer: Fallback also failed - window may not support external resizing")

                    // Last resort: try AppleScript
                    print("🔧 WindowResizer: Last resort - trying AppleScript...")
                    if resizeWindowViaAppleScript(pid: pid, newBounds: newFrame) {
                        usleep(200000) // 200ms for AppleScript to take effect

                        if let finalFrame = getWindowFrame(windowElement) {
                            let widthDiff = abs(finalFrame.width - newFrame.width)
                            if widthDiff < 50 {
                                print("✅ WindowResizer: AppleScript approach worked! Final width: \(finalFrame.width)")
                            } else {
                                print("❌ WindowResizer: AppleScript didn't work either. Window width: \(finalFrame.width)")
                            }
                        }
                    } else {
                        print("❌ WindowResizer: AppleScript execution failed")
                    }
                }
            }
        } else {
            print("❌ WindowResizer: setWindowFrame FAILED")
            originalFrame = nil
            resizedAppPID = nil
            resizedWindowElement = nil
            resizedAppElement = nil
            wasEnhancedUIEnabled = nil
        }
        print("╔════════════════════════════════════════════════════════════╗")
        print("║ WindowResizer: makeRoomForPanel END                        ║")
        print("╚════════════════════════════════════════════════════════════╝")
        print("")
    }

    /// Restores the previously resized window to its original size
    func restoreWindow() {
        print("")
        print("╔════════════════════════════════════════════════════════════╗")
        print("║ WindowResizer: restoreWindow START                         ║")
        print("╠════════════════════════════════════════════════════════════╣")
        print("║ wasInFullScreenMode: \(wasInFullScreenMode)")
        print("║ resizedWindowElement: \(resizedWindowElement != nil ? "YES" : "NO")")
        print("║ resizedAppPID: \(resizedAppPID ?? 0)")
        print("╚════════════════════════════════════════════════════════════╝")

        // Special case: if window was in full-screen mode, just re-enter it
        if wasInFullScreenMode, let windowElement = resizedWindowElement {
            print("🔧 WindowResizer: Window was in full-screen mode, re-entering...")

            let result = AXUIElementSetAttributeValue(
                windowElement,
                "AXFullScreen" as CFString,
                true as CFBoolean
            )

            if result == .success {
                print("✅ WindowResizer: Re-entered full-screen mode")
            } else {
                print("⚠️ WindowResizer: Failed to re-enter full-screen: \(axErrorDescription(result))")
            }

            clearStoredState()
            return
        }

        guard let originalFrame = originalFrame,
              let pid = resizedAppPID else {
            print("WindowResizer: No window to restore")
            return
        }

        print("WindowResizer: Restoring window for PID \(pid) to frame \(originalFrame)")

        let appElement = AXUIElementCreateApplication(pid)

        // Handle AXEnhancedUserInterface for Chrome/Electron apps
        let currentEnhancedUI = getEnhancedUserInterface(for: appElement)
        if currentEnhancedUI == true {
            print("WindowResizer: Disabling AXEnhancedUserInterface for restore")
            setEnhancedUserInterface(for: appElement, enabled: false)
            usleep(50000) // 50ms
        }

        var restored = false

        // First try: use the stored window element if still valid
        if let storedWindow = resizedWindowElement {
            if setWindowFrame(storedWindow, frame: originalFrame) {
                print("WindowResizer: Successfully restored window using stored element")
                restored = true
            }
        }

        // Fallback: find the window using kAXWindowsAttribute
        if !restored, let window = getMainWindow(for: appElement) {
            if setWindowFrame(window, frame: originalFrame) {
                print("WindowResizer: Successfully restored window to original frame \(originalFrame)")
                restored = true
            } else {
                print("WindowResizer: Failed to restore window")
            }
        } else if !restored {
            print("WindowResizer: Could not find window to restore")
        }

        // Re-enable AXEnhancedUserInterface after restore
        if currentEnhancedUI == true {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                guard let self = self else { return }
                print("WindowResizer: Re-enabling AXEnhancedUserInterface")
                self.setEnhancedUserInterface(for: appElement, enabled: true)
            }
        }

        clearStoredState()
    }

    private func clearStoredState() {
        self.originalFrame = nil
        self.resizedAppPID = nil
        self.resizedWindowElement = nil
        self.capturedWindowElement = nil
        self.capturedAppPID = nil
        self.wasEnhancedUIEnabled = nil
        self.resizedAppElement = nil
        self.wasInFullScreenMode = false
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
        // Force cast is safe - AX API guarantees this is an AXValue for position attributes
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
        // Force cast is safe - AX API guarantees this is an AXValue for size attributes
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
            print("WindowResizer: Failed to set size, error: \(axErrorDescription(result))")
            return false
        }

        return true
    }

    /// Sets window position
    @discardableResult
    private func setWindowPosition(_ window: AXUIElement, position: CGPoint) -> Bool {
        var mutablePosition = position
        guard let positionValue = AXValueCreate(.cgPoint, &mutablePosition) else {
            print("WindowResizer: Failed to create position AXValue")
            return false
        }

        let result = AXUIElementSetAttributeValue(
            window,
            kAXPositionAttribute as CFString,
            positionValue
        )

        if result != .success {
            print("WindowResizer: Failed to set position, error: \(axErrorDescription(result))")
            return false
        }

        return true
    }

    /// Sets both position and size using the size-position-size order
    /// This approach is used by Rectangle (popular macOS window manager) and handles
    /// edge cases where setting size first may be constrained by current position
    @discardableResult
    private func setWindowFrame(_ window: AXUIElement, frame: CGRect) -> Bool {
        let size = frame.size
        let position = frame.origin

        print("   [setWindowFrame] Target: position=(\(position.x), \(position.y)), size=\(size.width)x\(size.height)")

        // Step 1: Set size first (may be constrained by current position)
        print("   [setWindowFrame] Step 1: Setting size to \(size.width)x\(size.height)...")
        var sizeResult = setWindowSize(window, size: size)
        print("   [setWindowFrame] Step 1 result: \(sizeResult ? "✅ SUCCESS" : "❌ FAILED")")

        // Step 2: Set position (now window can move to correct location)
        print("   [setWindowFrame] Step 2: Setting position to (\(position.x), \(position.y))...")
        let positionResult = setWindowPosition(window, position: position)
        print("   [setWindowFrame] Step 2 result: \(positionResult ? "✅ SUCCESS" : "❌ FAILED")")

        // Step 3: Set size again (now that position is correct, size may be different)
        print("   [setWindowFrame] Step 3: Setting size again to \(size.width)x\(size.height)...")
        sizeResult = setWindowSize(window, size: size)
        print("   [setWindowFrame] Step 3 result: \(sizeResult ? "✅ SUCCESS" : "❌ FAILED")")

        // Consider success if either operation worked - some apps may constrain one dimension
        // (e.g., apps with minimum window sizes may reject size changes but accept position)
        let overallSuccess = positionResult || sizeResult
        print("   [setWindowFrame] Overall result: \(overallSuccess ? "✅ SUCCESS" : "❌ FAILED")")
        return overallSuccess
    }

    // MARK: - AXEnhancedUserInterface Helpers (for Chrome/Electron apps)

    /// Gets the current AXEnhancedUserInterface state for an app
    /// Chrome and Electron apps use this for smooth animations which can conflict with resize
    private func getEnhancedUserInterface(for appElement: AXUIElement) -> Bool? {
        var value: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            appElement,
            "AXEnhancedUserInterface" as CFString,
            &value
        )

        if result == .success, let boolValue = value as? Bool {
            print("WindowResizer: AXEnhancedUserInterface = \(boolValue)")
            return boolValue
        } else if result == .attributeUnsupported || result == .noValue {
            // App doesn't support this attribute - that's fine
            return nil
        } else {
            print("WindowResizer: Could not get AXEnhancedUserInterface, error: \(axErrorDescription(result))")
            return nil
        }
    }

    /// Sets the AXEnhancedUserInterface state for an app
    private func setEnhancedUserInterface(for appElement: AXUIElement, enabled: Bool) {
        let result = AXUIElementSetAttributeValue(
            appElement,
            "AXEnhancedUserInterface" as CFString,
            enabled as CFBoolean
        )

        if result != .success && result != .attributeUnsupported {
            print("WindowResizer: Failed to set AXEnhancedUserInterface to \(enabled), error: \(axErrorDescription(result))")
        }
    }

    // MARK: - Window Action Helpers

    /// Lists all available actions on a window element (for debugging)
    private func listWindowActions(_ window: AXUIElement) {
        var actionsRef: CFArray?
        let result = AXUIElementCopyActionNames(window, &actionsRef)

        if result == .success, let actions = actionsRef as? [String] {
            print("   [WindowActions] Available actions: \(actions)")
        } else {
            print("   [WindowActions] Could not get actions: \(axErrorDescription(result))")
        }
    }

    /// Tries to perform AXRaise action to bring window to front (may help break tiled state)
    @discardableResult
    private func raiseWindow(_ window: AXUIElement) -> Bool {
        let result = AXUIElementPerformAction(window, kAXRaiseAction as CFString)
        if result == .success {
            print("   [raiseWindow] Successfully raised window")
            return true
        } else {
            print("   [raiseWindow] Failed: \(axErrorDescription(result))")
            return false
        }
    }

    // MARK: - Zoom State Helpers

    /// Checks if a window is in "zoomed" (maximized) state
    private func isWindowZoomed(_ window: AXUIElement) -> Bool {
        var zoomedValue: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            window,
            "AXZoomed" as CFString,
            &zoomedValue
        )

        if result == .success, let zoomed = zoomedValue as? Bool {
            return zoomed
        }
        return false
    }

    /// Un-zooms a window by clicking its zoom button (green button)
    /// Returns true if successfully un-zoomed
    @discardableResult
    private func unzoomWindow(_ window: AXUIElement) -> Bool {
        // Get the zoom button
        var zoomButtonValue: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            window,
            kAXZoomButtonAttribute as CFString,
            &zoomButtonValue
        )

        guard result == .success, let zoomButton = zoomButtonValue else {
            print("   [unzoomWindow] Could not get zoom button")
            return false
        }

        // Press the zoom button
        let pressResult = AXUIElementPerformAction(
            zoomButton as! AXUIElement,
            kAXPressAction as CFString
        )

        if pressResult == .success {
            print("   [unzoomWindow] Successfully pressed zoom button")
            // Give the window time to animate
            usleep(200000) // 200ms
            return true
        } else {
            print("   [unzoomWindow] Failed to press zoom button: \(axErrorDescription(pressResult))")
            return false
        }
    }

    // MARK: - Verification Helpers

    /// Checks if a window's size attribute is settable
    private func isWindowResizable(_ window: AXUIElement) -> Bool {
        var settable: DarwinBoolean = false
        let result = AXUIElementIsAttributeSettable(
            window,
            kAXSizeAttribute as CFString,
            &settable
        )

        if result == .success {
            let isSettable = settable.boolValue
            print("WindowResizer: Window resizable = \(isSettable)")
            return isSettable
        } else {
            print("WindowResizer: Could not check if window is resizable, error: \(axErrorDescription(result))")
            // Assume resizable if we can't check
            return true
        }
    }

    /// Verifies that the window resize actually worked by reading the frame back
    private func verifyWindowResize(_ window: AXUIElement, expectedFrame: CGRect, tolerance: CGFloat = 50) -> Bool {
        // Small delay to let the resize take effect
        usleep(50000) // 50ms

        guard let actualFrame = getWindowFrame(window) else {
            print("WindowResizer: Verification failed - could not read frame")
            return false
        }

        let widthDiff = abs(actualFrame.width - expectedFrame.width)
        let heightDiff = abs(actualFrame.height - expectedFrame.height)
        let xDiff = abs(actualFrame.origin.x - expectedFrame.origin.x)
        let yDiff = abs(actualFrame.origin.y - expectedFrame.origin.y)

        let success = widthDiff <= tolerance && heightDiff <= tolerance &&
                      xDiff <= tolerance && yDiff <= tolerance

        if !success {
            print("WindowResizer: Verification failed - expected \(expectedFrame), got \(actualFrame)")
            print("WindowResizer: Differences - width: \(widthDiff), height: \(heightDiff), x: \(xDiff), y: \(yDiff)")
        }

        return success
    }

    // MARK: - AppleScript Fallback

    /// Checks if we have Automation permission for System Events
    private func hasAutomationPermission() -> Bool {
        // Try a simple AppleScript that requires System Events access
        let testScript = """
        tell application "System Events"
            return name of first process
        end tell
        """

        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: testScript) {
            _ = scriptObject.executeAndReturnError(&error)
            return error == nil
        }
        return false
    }

    /// Requests Automation permission by triggering the system prompt
    func requestAutomationPermission() {
        print("WindowResizer: Requesting Automation permission for System Events...")

        // This script will trigger the permission prompt if not already granted
        let script = """
        tell application "System Events"
            return name of first application process
        end tell
        """

        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: script) {
            _ = scriptObject.executeAndReturnError(&error)
            if let error = error {
                print("WindowResizer: Automation permission not granted: \(error)")
            } else {
                print("WindowResizer: Automation permission granted!")
            }
        }
    }

    /// Resizes a window using AppleScript when Accessibility API fails
    /// This can work for tiled/snapped windows that resist AX manipulation
    private func resizeWindowViaAppleScript(pid: pid_t, newBounds: CGRect) -> Bool {
        // Get the app name from PID
        guard let app = NSRunningApplication(processIdentifier: pid) else {
            print("   [AppleScript] Could not find app for PID \(pid)")
            return false
        }

        guard let appName = app.localizedName else {
            print("   [AppleScript] App has no name")
            return false
        }

        // Note: AppleScript uses different coordinate system - origin is top-left
        // We need to convert from Cocoa coordinates (bottom-left origin)
        let screenHeight = NSScreen.main?.frame.height ?? 1000

        // Convert y coordinate: Cocoa y=37 from bottom means AppleScript y = screenHeight - 37 - windowHeight
        // But for bounds {x1, y1, x2, y2}, we use top-left and bottom-right corners
        let x1 = Int(newBounds.origin.x)
        let y1 = Int(screenHeight - newBounds.origin.y - newBounds.height)  // Convert to screen coords (top-left origin)
        let x2 = Int(newBounds.origin.x + newBounds.width)
        let y2 = Int(screenHeight - newBounds.origin.y)

        print("   [AppleScript] App: '\(appName)', bounds: {\(x1), \(y1), \(x2), \(y2)}")

        // Build AppleScript to resize the frontmost window of the app
        let script = """
        tell application "System Events"
            tell process "\(appName)"
                if exists window 1 then
                    set position of window 1 to {\(x1), \(y1)}
                    set size of window 1 to {\(Int(newBounds.width)), \(Int(newBounds.height))}
                    return true
                else
                    return false
                end if
            end tell
        end tell
        """

        print("   [AppleScript] Executing script...")

        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: script) {
            let result = scriptObject.executeAndReturnError(&error)

            if let error = error {
                print("   [AppleScript] Error: \(error)")
                return false
            }

            print("   [AppleScript] Result: \(result.booleanValue)")
            return result.booleanValue
        }

        print("   [AppleScript] Failed to create script object")
        return false
    }

    /// Translates AXError codes to readable descriptions
    private func axErrorDescription(_ error: AXError) -> String {
        switch error {
        case .success: return "success"
        case .failure: return "failure"
        case .illegalArgument: return "illegalArgument"
        case .invalidUIElement: return "invalidUIElement"
        case .invalidUIElementObserver: return "invalidUIElementObserver"
        case .cannotComplete: return "cannotComplete"
        case .attributeUnsupported: return "attributeUnsupported"
        case .actionUnsupported: return "actionUnsupported"
        case .notificationUnsupported: return "notificationUnsupported"
        case .notImplemented: return "notImplemented"
        case .notificationAlreadyRegistered: return "notificationAlreadyRegistered"
        case .notificationNotRegistered: return "notificationNotRegistered"
        case .apiDisabled: return "apiDisabled"
        case .noValue: return "noValue"
        case .parameterizedAttributeUnsupported: return "parameterizedAttributeUnsupported"
        case .notEnoughPrecision: return "notEnoughPrecision"
        @unknown default: return "unknown(\(error.rawValue))"
        }
    }
}
