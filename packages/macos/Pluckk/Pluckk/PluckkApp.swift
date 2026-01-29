import SwiftUI

@main
struct PluckkApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        // No main window - we use the panel and menu bar
        Settings {
            EmptyView()
        }
    }
}
