import Foundation

/// Centralized configuration for the Pluckk macOS app.
/// The app is a thin capture client: it holds no database credentials and
/// talks only to the Pluckk API with a bearer token obtained via the web app.
enum Config {
    // MARK: - URLs
    static let backendURL = "https://pluckk-api.vercel.app"
    static let webappURL = "https://pluckk.app"

    /// The web app runs the Google sign-in and hands the Pluckk token back on
    /// the `pluckk://` scheme (see AuthManager). Registered in Info.plist.
    static let authStartURL = "\(webappURL)/auth/desktop"
    static let authCallbackScheme = "pluckk"

    // MARK: - App Info
    static let appVersion = "1.1.0"
    static let bundleIdentifier = "com.pluckk.app"
}
