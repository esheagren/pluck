import Foundation
import AuthenticationServices
import Security

class AuthManager: NSObject, ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var accessToken: String?
    @Published var isLoading = false
    @Published var error: String?

    private let keychainService = Config.bundleIdentifier
    private let tokenKey = "accessToken"
    private let refreshTokenKey = "refreshToken"

    private var webAuthSession: ASWebAuthenticationSession?
    private var presentationContextProvider: AuthPresentationContextProvider?

    override private init() {
        super.init()
        loadStoredToken()
    }

    // MARK: - Public Methods

    func signInWithGoogle() {
        isLoading = true
        error = nil

        // Build OAuth URL for Supabase Google auth
        var components = URLComponents(string: "\(Config.supabaseURL)/auth/v1/authorize")!
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: "pluckk://auth/callback")
        ]

        guard let authURL = components.url else {
            error = "Failed to construct auth URL"
            isLoading = false
            return
        }

        presentationContextProvider = AuthPresentationContextProvider()

        webAuthSession = ASWebAuthenticationSession(
            url: authURL,
            callbackURLScheme: "pluckk"
        ) { [weak self] callbackURL, authError in
            DispatchQueue.main.async {
                self?.handleAuthCallback(callbackURL: callbackURL, error: authError)
            }
        }

        webAuthSession?.presentationContextProvider = presentationContextProvider
        webAuthSession?.prefersEphemeralWebBrowserSession = false
        webAuthSession?.start()
    }

    func signOut() {
        deleteFromKeychain(key: tokenKey)
        deleteFromKeychain(key: refreshTokenKey)
        accessToken = nil
        isAuthenticated = false
        AppState.shared.isAuthenticated = false
        AppState.shared.user = nil
    }

    func handleURLCallback(_ url: URL) {
        handleAuthCallback(callbackURL: url, error: nil)
    }

    /// Refresh the access token using the stored refresh token
    /// Returns the new access token on success, nil on failure
    /// Only signs out on auth failures (401/403), not on network errors
    @MainActor
    func refreshAccessToken() async -> String? {
        guard let refreshToken = loadFromKeychain(key: refreshTokenKey) else {
            print("AuthManager: No refresh token available, signing out")
            signOut()
            return nil
        }

        let url = URL(string: "\(Config.supabaseURL)/auth/v1/token?grant_type=refresh_token")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")

        let body: [String: String] = ["refresh_token": refreshToken]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                print("AuthManager: Token refresh - invalid response")
                return nil // Network error, don't sign out
            }

            // Sign out only on authentication failures
            if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
                print("AuthManager: Refresh token invalid (status \(httpResponse.statusCode)), signing out")
                signOut()
                return nil
            }

            // Other errors (5xx, etc.) - don't sign out, just return nil
            guard httpResponse.statusCode == 200 else {
                print("AuthManager: Token refresh failed with status: \(httpResponse.statusCode)")
                return nil
            }

            struct RefreshResponse: Decodable {
                let access_token: String
                let refresh_token: String?
            }

            let refreshResponse = try JSONDecoder().decode(RefreshResponse.self, from: data)

            // Update stored tokens
            self.accessToken = refreshResponse.access_token
            saveToKeychain(key: tokenKey, value: refreshResponse.access_token)

            if let newRefreshToken = refreshResponse.refresh_token {
                saveToKeychain(key: refreshTokenKey, value: newRefreshToken)
            }

            print("AuthManager: Token refreshed successfully")
            return refreshResponse.access_token

        } catch {
            // Network errors - don't sign out
            print("AuthManager: Token refresh network error: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - Private Methods

    private func handleAuthCallback(callbackURL: URL?, error: Error?) {
        isLoading = false

        if let error = error {
            // User cancelled is not an error we need to show
            if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                return
            }
            self.error = error.localizedDescription
            return
        }

        guard let url = callbackURL else {
            self.error = "No callback URL received"
            return
        }

        // Parse the callback URL for tokens
        // Supabase returns: pluckk://auth/callback#access_token=...&refresh_token=...
        guard let fragment = url.fragment else {
            self.error = "No auth data in callback"
            return
        }

        let params = parseFragment(fragment)

        guard let accessToken = params["access_token"] else {
            self.error = "No access token in callback"
            return
        }

        // Store tokens
        self.accessToken = accessToken
        saveToKeychain(key: tokenKey, value: accessToken)

        if let refreshToken = params["refresh_token"] {
            saveToKeychain(key: refreshTokenKey, value: refreshToken)
        }

        isAuthenticated = true
        AppState.shared.isAuthenticated = true

        // Fetch user profile
        Task {
            await fetchUserProfile()
        }
    }

    private func parseFragment(_ fragment: String) -> [String: String] {
        var params: [String: String] = [:]
        let pairs = fragment.split(separator: "&")
        for pair in pairs {
            let keyValue = pair.split(separator: "=", maxSplits: 1)
            if keyValue.count == 2 {
                let key = String(keyValue[0])
                let value = String(keyValue[1]).removingPercentEncoding ?? String(keyValue[1])
                params[key] = value
            }
        }
        return params
    }

    private func loadStoredToken() {
        if let token = loadFromKeychain(key: tokenKey) {
            accessToken = token
            isAuthenticated = true
            AppState.shared.isAuthenticated = true

            // Validate token and fetch profile
            Task {
                await fetchUserProfile()
            }
        }
    }

    @MainActor
    private func fetchUserProfile() async {
        guard let token = accessToken else { return }

        do {
            let user = try await PluckkAPI.shared.fetchUser(token: token)
            AppState.shared.user = user

            // Update settings from user profile
            if let mochiKey = user.mochiApiKey, !mochiKey.isEmpty {
                AppState.shared.mochiEnabled = true
                AppState.shared.mochiApiKey = mochiKey
                AppState.shared.mochiDeckId = user.mochiDeckId
            }

            if let status = user.subscriptionStatus {
                AppState.shared.subscriptionStatus = SubscriptionStatus(rawValue: status) ?? .free
            }

            if let remaining = user.cardsGeneratedThisMonth {
                let limit = 20
                AppState.shared.usageRemaining = max(0, limit - remaining)
            }
        } catch {
            // Token might be expired
            print("AuthManager: Failed to fetch user profile: \(error.localizedDescription)")
            print("AuthManager: Full error: \(error)")
            // Could attempt token refresh here
        }
        print("AuthManager: fetchUserProfile completed, user set: \(AppState.shared.user != nil)")
    }

    // MARK: - Keychain

    private func saveToKeychain(key: String, value: String) {
        let data = value.data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        // Delete any existing item
        SecItemDelete(query as CFDictionary)

        // Add new item
        SecItemAdd(query as CFDictionary, nil)
    }

    private func loadFromKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecSuccess, let data = result as? Data {
            return String(data: data, encoding: .utf8)
        }

        return nil
    }

    private func deleteFromKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Presentation Context Provider

private class AuthPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let keyWindow = NSApplication.shared.keyWindow {
            return keyWindow
        }
        if let firstWindow = NSApplication.shared.windows.first {
            return firstWindow
        }
        // Fallback: create a minimal window
        return NSWindow(contentRect: .zero, styleMask: [], backing: .buffered, defer: false)
    }
}
