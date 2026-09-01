import Foundation
import AuthenticationServices
import Security

/// Sign-in for the thin client (2026-09 port off Supabase).
///
/// Flow: ASWebAuthenticationSession opens `pluckk.app/auth/desktop` → the web app
/// runs its normal Google sign-in → its callback page redirects to
/// `pluckk://auth/callback#token=pk_…` → we keep the opaque Pluckk bearer token in
/// the Keychain. No refresh tokens: the token lives until revoked; a 401 signs out.
class AuthManager: NSObject, ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var accessToken: String?
    @Published var isLoading = false
    @Published var error: String?

    private let keychainService = Config.bundleIdentifier
    private let tokenKey = "pluckkToken"

    private var webAuthSession: ASWebAuthenticationSession?
    private var presentationContextProvider: AuthPresentationContextProvider?

    override private init() {
        super.init()
        // One-time cleanup of Supabase-era Keychain entries.
        deleteFromKeychain(key: "accessToken")
        deleteFromKeychain(key: "refreshToken")
        loadStoredToken()
    }

    // MARK: - Public

    func signInWithGoogle() {
        isLoading = true
        error = nil

        guard let authURL = URL(string: Config.authStartURL) else {
            error = "Failed to construct auth URL"
            isLoading = false
            return
        }

        presentationContextProvider = AuthPresentationContextProvider()
        webAuthSession = ASWebAuthenticationSession(
            url: authURL,
            callbackURLScheme: Config.authCallbackScheme
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
        if let token = accessToken {
            Task { await PluckkAPI.shared.revokeToken(token) }
        }
        deleteFromKeychain(key: tokenKey)
        accessToken = nil
        isAuthenticated = false
        AppState.shared.isAuthenticated = false
        AppState.shared.user = nil
    }

    /// Called by PluckkAPI when the server answers 401: the token is dead.
    @MainActor
    func handleUnauthorized() {
        print("AuthManager: token rejected by API, signing out")
        deleteFromKeychain(key: tokenKey)
        accessToken = nil
        isAuthenticated = false
        AppState.shared.isAuthenticated = false
        AppState.shared.user = nil
    }

    // MARK: - Private

    private func handleAuthCallback(callbackURL: URL?, error: Error?) {
        isLoading = false

        if let error = error {
            if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue { return }
            self.error = error.localizedDescription
            return
        }
        guard let url = callbackURL, let fragment = url.fragment else {
            self.error = "No auth data in callback"
            return
        }

        let params = parseFragment(fragment)
        guard let token = params["token"], token.hasPrefix("pk_") else {
            self.error = params["error"] ?? "No token in callback"
            return
        }

        accessToken = token
        saveToKeychain(key: tokenKey, value: token)
        isAuthenticated = true
        AppState.shared.isAuthenticated = true

        Task { await fetchUserProfile() }
    }

    private func parseFragment(_ fragment: String) -> [String: String] {
        var params: [String: String] = [:]
        for pair in fragment.split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1)
            if kv.count == 2 {
                params[String(kv[0])] = String(kv[1]).removingPercentEncoding ?? String(kv[1])
            }
        }
        return params
    }

    private func loadStoredToken() {
        if let token = loadFromKeychain(key: tokenKey) {
            accessToken = token
            isAuthenticated = true
            AppState.shared.isAuthenticated = true
            Task { await fetchUserProfile() }
        }
    }

    @MainActor
    private func fetchUserProfile() async {
        guard let token = accessToken else { return }
        do {
            let user = try await PluckkAPI.shared.fetchUser(token: token)
            AppState.shared.user = user
            if let mochiKey = user.mochiApiKey, !mochiKey.isEmpty {
                AppState.shared.mochiEnabled = true
                AppState.shared.mochiApiKey = mochiKey
                AppState.shared.mochiDeckId = user.mochiDeckId
            }
        } catch {
            print("AuthManager: Failed to fetch user profile: \(error.localizedDescription)")
        }
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
        SecItemDelete(query as CFDictionary)
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
        if let keyWindow = NSApplication.shared.keyWindow { return keyWindow }
        if let firstWindow = NSApplication.shared.windows.first { return firstWindow }
        return NSWindow(contentRect: .zero, styleMask: [], backing: .buffered, defer: false)
    }
}
