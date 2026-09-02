import Carbon
import AppKit

class DoubleCmdDetector {
    private var lastCmdReleaseTime: Date?
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?

    private let threshold: TimeInterval = 0.3 // 300ms between taps
    private var cmdWasPressed = false
    private var watchdog: Timer?

    var onDoubleTap: (() -> Void)?

    func start() {
        // Create event tap to monitor modifier key changes.
        // Listen-only: we never modify or swallow events, and passive taps are not
        // switched off by the system when the main thread is briefly busy (an active
        // tap is disabled after ~1s of unresponsiveness — which is what made the
        // shortcut die after the first use).
        let eventMask = (1 << CGEventType.flagsChanged.rawValue)

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: CGEventMask(eventMask),
            callback: { (proxy, type, event, refcon) -> Unmanaged<CGEvent>? in
                guard let refcon = refcon else {
                    return Unmanaged.passUnretained(event)
                }
                let detector = Unmanaged<DoubleCmdDetector>.fromOpaque(refcon).takeUnretainedValue()
                switch type {
                case .tapDisabledByTimeout, .tapDisabledByUserInput:
                    // The system turned us off; turn back on or ⌘⌘ is dead until relaunch.
                    detector.reenable(reason: "\(type)")
                case .flagsChanged:
                    detector.handleFlagsChanged(event)
                default:
                    break
                }
                return Unmanaged.passUnretained(event)
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

        // Belt and braces: if the tap is ever found disabled, re-arm it.
        watchdog = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            guard let self, let tap = self.eventTap, !CGEvent.tapIsEnabled(tap: tap) else { return }
            self.reenable(reason: "watchdog")
        }
    }

    private func reenable(reason: String) {
        guard let tap = eventTap else { return }
        CGEvent.tapEnable(tap: tap, enable: true)
        cmdWasPressed = false
        lastCmdReleaseTime = nil
        print("DoubleCmdDetector: event tap re-enabled (\(reason))")
    }

    func stop() {
        watchdog?.invalidate()
        watchdog = nil
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
