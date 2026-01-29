import Foundation

/// Centralized configuration for Pluckk macOS app
/// Note: These are publishable keys protected by Supabase RLS policies
enum Config {
    // MARK: - API URLs
    static let backendURL = "https://pluckk-api.vercel.app"
    static let supabaseURL = "https://grjkoedivfrjlbtfskif.supabase.co"
    static let mochiAPIURL = "https://app.mochi.cards/api"

    // MARK: - Supabase
    /// Supabase anon/publishable key - safe to include in client apps
    /// Protected by Row Level Security policies on the database
    static let supabaseAnonKey = "sb_publishable_E1Is2auN23lNbPWDPzbgYw_RxERFa0W"

    // MARK: - App Info
    static let appVersion = "1.0.0"
    static let bundleIdentifier = "com.pluckk.app"

    // MARK: - Usage Limits
    static let freeTierMonthlyLimit = 20
}
