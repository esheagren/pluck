import AppKit
import ApplicationServices

class SelectionReader {

    /// Gets the currently selected text from the frontmost application using Accessibility API
    func getSelectedText() -> String? {
        guard let frontApp = NSWorkspace.shared.frontmostApplication,
              let pid = frontApp.processIdentifier as pid_t? else {
            return nil
        }

        let appElement = AXUIElementCreateApplication(pid)

        // Get the focused element
        var focusedElement: CFTypeRef?
        let focusResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedUIElementAttribute as CFString,
            &focusedElement
        )

        guard focusResult == .success,
              let focused = focusedElement,
              let focusedAX = focused as? AXUIElement else {
            return nil
        }

        // Try to get selected text directly
        var selectedText: CFTypeRef?
        let selectResult = AXUIElementCopyAttributeValue(
            focusedAX,
            kAXSelectedTextAttribute as CFString,
            &selectedText
        )

        if selectResult == .success,
           let text = selectedText as? String,
           !text.isEmpty {
            return text
        }

        // Fallback: try selected text range method
        return trySelectedTextRange(from: focusedAX)
    }

    /// Alternative method using text range
    private func trySelectedTextRange(from element: AXUIElement) -> String? {
        var selectedRange: CFTypeRef?
        let rangeResult = AXUIElementCopyAttributeValue(
            element,
            kAXSelectedTextRangeAttribute as CFString,
            &selectedRange
        )

        guard rangeResult == .success else {
            return nil
        }

        var selectedText: CFTypeRef?
        let textResult = AXUIElementCopyParameterizedAttributeValue(
            element,
            kAXStringForRangeParameterizedAttribute as CFString,
            selectedRange!,
            &selectedText
        )

        if textResult == .success, let text = selectedText as? String {
            return text
        }

        return nil
    }

    /// Gets text from the clipboard
    func getClipboardText() -> String? {
        let pasteboard = NSPasteboard.general
        return pasteboard.string(forType: .string)
    }

    /// Gets image from the clipboard
    func getClipboardImage() -> NSImage? {
        let pasteboard = NSPasteboard.general

        // Check for image types in order of preference
        let imageTypes: [NSPasteboard.PasteboardType] = [
            .tiff,
            .png,
            NSPasteboard.PasteboardType("public.jpeg"),
            NSPasteboard.PasteboardType("com.apple.pict")
        ]

        for type in imageTypes {
            if let data = pasteboard.data(forType: type),
               let image = NSImage(data: data) {
                return image
            }
        }

        // Try reading as file URL (e.g., screenshot file)
        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
           let url = urls.first,
           let image = NSImage(contentsOf: url) {
            return image
        }

        return nil
    }

    /// Gets source context (app name and window title) from frontmost application
    func getSourceContext() -> SourceContext {
        guard let frontApp = NSWorkspace.shared.frontmostApplication else {
            return SourceContext(appName: "Unknown", windowTitle: "")
        }

        let appName = frontApp.localizedName ?? "Unknown"
        let pid = frontApp.processIdentifier
        let appElement = AXUIElementCreateApplication(pid)

        // Get focused window title
        var focusedWindow: CFTypeRef?
        let windowResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindow
        )

        var windowTitle = ""
        if windowResult == .success,
           let window = focusedWindow,
           let windowAX = window as? AXUIElement {
            var title: CFTypeRef?
            let titleResult = AXUIElementCopyAttributeValue(
                windowAX,
                kAXTitleAttribute as CFString,
                &title
            )
            if titleResult == .success, let titleString = title as? String {
                windowTitle = titleString
            }
        }

        return SourceContext(appName: appName, windowTitle: windowTitle)
    }

    /// Simulates Cmd+C to copy selection (fallback method)
    func simulateCopy() {
        let source = CGEventSource(stateID: .hidSystemState)

        // Key codes
        let cmdKeyCode: CGKeyCode = 0x37  // Command
        let cKeyCode: CGKeyCode = 0x08    // C

        // Cmd down
        let cmdDown = CGEvent(keyboardEventSource: source, virtualKey: cmdKeyCode, keyDown: true)
        cmdDown?.flags = .maskCommand
        cmdDown?.post(tap: .cghidEventTap)

        // C down
        let cDown = CGEvent(keyboardEventSource: source, virtualKey: cKeyCode, keyDown: true)
        cDown?.flags = .maskCommand
        cDown?.post(tap: .cghidEventTap)

        // Brief delay
        usleep(10000) // 10ms

        // C up
        let cUp = CGEvent(keyboardEventSource: source, virtualKey: cKeyCode, keyDown: false)
        cUp?.flags = .maskCommand
        cUp?.post(tap: .cghidEventTap)

        // Cmd up
        let cmdUp = CGEvent(keyboardEventSource: source, virtualKey: cmdKeyCode, keyDown: false)
        cmdUp?.post(tap: .cghidEventTap)

        // Wait for clipboard to update
        usleep(50000) // 50ms
    }

    /// Gets selected text, falling back to clipboard simulation if needed
    func getSelectedTextWithFallback() -> String? {
        // First try direct Accessibility API
        if let text = getSelectedText(), !text.isEmpty {
            return text
        }

        // Save current clipboard
        let pasteboard = NSPasteboard.general
        let oldContents = pasteboard.string(forType: .string)

        // Simulate Cmd+C
        simulateCopy()

        // Get new clipboard contents
        let newContents = pasteboard.string(forType: .string)

        // Restore old clipboard if it changed
        if let old = oldContents, old != newContents {
            pasteboard.clearContents()
            pasteboard.setString(old, forType: .string)
        }

        return newContents
    }
}
