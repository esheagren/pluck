import Carbon
import AppKit

class DoubleCmdDetector {
    private var lastCmdReleaseTime: Date?
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?

    private let threshold: TimeInterval = 0.3 // 300ms between taps
    private var cmdWasPressed = false

    var onDoubleTap: (() -> Void)?

    func start() {
        // Create event tap to monitor modifier key changes
        let eventMask = (1 << CGEventType.flagsChanged.rawValue)

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: CGEventMask(eventMask),
            callback: { (proxy, type, event, refcon) -> Unmanaged<CGEvent>? in
                guard let refcon = refcon else {
                    return Unmanaged.passRetained(event)
                }
                let detector = Unmanaged<DoubleCmdDetector>.fromOpaque(refcon).takeUnretainedValue()
                detector.handleFlagsChanged(event)
                return Unmanaged.passRetained(event)
            },
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        ) else {
            print("Failed to create event tap - accessibility permissions may be required")
            return
        }

        self.eventTap = tap

        runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
    }

    func stop() {
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: false)
        }
        if let source = runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetCurrent(), source, .commonModes)
        }
        eventTap = nil
        runLoopSource = nil
    }

    private func handleFlagsChanged(_ event: CGEvent) {
        let flags = event.flags

        // Check modifier state
        let cmdPressed = flags.contains(.maskCommand)
        let shiftPressed = flags.contains(.maskShift)
        let ctrlPressed = flags.contains(.maskControl)
        let optionPressed = flags.contains(.maskAlternate)

        // Only interested in pure Command key (no other modifiers)
        let otherModifiers = shiftPressed || ctrlPressed || optionPressed

        if cmdPressed && !otherModifiers {
            // Command key pressed alone
            cmdWasPressed = true
        } else if !cmdPressed && cmdWasPressed && !otherModifiers {
            // Command key released (was pressed, now released, no other modifiers held)
            cmdWasPressed = false
            handleCmdRelease()
        } else if otherModifiers {
            // Other modifier pressed - reset state
            cmdWasPressed = false
            lastCmdReleaseTime = nil
        }
    }

    private func handleCmdRelease() {
        let now = Date()

        if let lastRelease = lastCmdReleaseTime {
            let interval = now.timeIntervalSince(lastRelease)

            if interval < threshold {
                // Double tap detected
                lastCmdReleaseTime = nil
                DispatchQueue.main.async { [weak self] in
                    self?.onDoubleTap?()
                }
                return
            }
        }

        // Record this release for potential double-tap
        lastCmdReleaseTime = now
    }
}
