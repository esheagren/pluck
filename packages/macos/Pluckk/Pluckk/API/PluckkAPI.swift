import Foundation
import AppKit

class PluckkAPI {
    static let shared = PluckkAPI()

    private let baseURL = Config.backendURL
    private let supabaseURL = Config.supabaseURL
    private let supabaseKey = Config.supabaseAnonKey
    private let timeout: TimeInterval = 60

    private init() {}

    // MARK: - User

    struct UserMeResponse: Decodable {
        let user: UserInfo
        let subscription: SubscriptionInfo?
        let usage: UsageInfo?
        let settings: SettingsInfo?

        struct UserInfo: Decodable {
            let id: String
            let email: String?
            let username: String?
            let displayName: String?
        }

        struct SubscriptionInfo: Decodable {
            let status: String?
            let isPro: Bool?
        }

        struct UsageInfo: Decodable {
            let cardsThisMonth: Int?
            let limit: Int?
            let remaining: RemainingValue?

            enum RemainingValue: Decodable {
                case number(Int)
                case unlimited

                init(from decoder: Decoder) throws {
                    let container = try decoder.singleValueContainer()
                    if let num = try? container.decode(Int.self) {
                        self = .number(num)
                    } else if let str = try? container.decode(String.self), str == "unlimited" {
                        self = .unlimited
                    } else {
                        self = .number(0)
                    }
                }
            }
        }

        struct SettingsInfo: Decodable {
            let mochiApiKey: String?
            let mochiDeckId: String?
        }
    }

    func fetchUser(token: String) async throws -> User {
        return try await executeWithTokenRefresh(token: token) { currentToken in
            let url = URL(string: "\(self.baseURL)/api/user/me")!
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.setValue("Bearer \(currentToken)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = self.timeout

            let (data, response) = try await URLSession.shared.data(for: request)
            try self.validateResponse(response, data: data)

            // Debug: print raw response
            if let jsonString = String(data: data, encoding: .utf8) {
                print("PluckkAPI: /api/user/me response: \(jsonString.prefix(500))")
            }

            let meResponse: UserMeResponse
            do {
                meResponse = try JSONDecoder().decode(UserMeResponse.self, from: data)
            } catch let decodingError as DecodingError {
                switch decodingError {
                case .keyNotFound(let key, let context):
                    print("PluckkAPI: Decoding error - missing key '\(key.stringValue)' at path: \(context.codingPath)")
                case .typeMismatch(let type, let context):
                    print("PluckkAPI: Decoding error - type mismatch for \(type) at path: \(context.codingPath)")
                case .valueNotFound(let type, let context):
                    print("PluckkAPI: Decoding error - value not found for \(type) at path: \(context.codingPath)")
                case .dataCorrupted(let context):
                    print("PluckkAPI: Decoding error - data corrupted at path: \(context.codingPath)")
                @unknown default:
                    print("PluckkAPI: Unknown decoding error: \(decodingError)")
                }
                throw decodingError
            } catch {
                print("PluckkAPI: Other error: \(error)")
                throw error
            }

            // Map to User model
            return User(
                id: meResponse.user.id,
                email: meResponse.user.email ?? "",
                username: meResponse.user.username,
                displayName: meResponse.user.displayName,
                subscriptionStatus: meResponse.subscription?.status,
                mochiApiKey: meResponse.settings?.mochiApiKey,
                mochiDeckId: meResponse.settings?.mochiDeckId,
                cardsGeneratedThisMonth: meResponse.usage?.cardsThisMonth
            )
        }
    }

    func updateUser(token: String, updates: [String: Any]) async throws -> User {
        let url = URL(string: "\(baseURL)/api/user/me")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: updates)
        request.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)

        return try JSONDecoder().decode(User.self, from: data)
    }

    // MARK: - Card Generation

    struct GenerateCardsRequest: Encodable {
        let selection: String
        let context: String
        let url: String
        let title: String
        let focusText: String?
    }

    struct GenerateCardsResponse: Decodable {
        let cards: [APICard]
        let isPro: Bool?
        let usage: Usage?

        struct Usage: Decodable {
            let remaining: RemainingValue
            let limit: Int?  // Optional - Pro users have unlimited (no limit field)
            let subscription: String?

            enum RemainingValue: Decodable {
                case number(Int)
                case unlimited

                init(from decoder: Decoder) throws {
                    let container = try decoder.singleValueContainer()
                    if let num = try? container.decode(Int.self) {
                        self = .number(num)
                    } else if let str = try? container.decode(String.self), str == "unlimited" {
                        self = .unlimited
                    } else {
                        self = .number(0)
                    }
                }
            }
        }
    }

    /// API card format - supports multiple card styles from the backend
    struct APICard: Decodable {
        let style: String
        // Simple cards (qa, cloze, explanation, application)
        let question: String?
        let answer: String?
        // Bidirectional cards
        let forward: QAPair?
        let reverse: QAPair?
        // Cloze list cards
        let list_name: String?
        let items: [String]?
        let prompts: [QAPair]?
        // Diagram cards
        let diagram_prompt: String?

        struct QAPair: Decodable {
            let question: String
            let answer: String
        }

        /// Flatten this API card into one or more GeneratedCards
        func toGeneratedCards() -> [GeneratedCard] {
            var result: [GeneratedCard] = []
            let cardStyle = CardStyle(rawValue: style) ?? .qa

            switch style {
            case "qa_bidirectional":
                // Create two cards from forward and reverse
                if let fwd = forward {
                    result.append(GeneratedCard(style: .qa, question: fwd.question, answer: fwd.answer))
                }
                if let rev = reverse {
                    result.append(GeneratedCard(style: .qa, question: rev.question, answer: rev.answer))
                }

            case "cloze_list":
                // Expand prompts into individual cloze cards
                if let prompts = prompts {
                    for prompt in prompts {
                        result.append(GeneratedCard(style: .cloze, question: prompt.question, answer: prompt.answer))
                    }
                }

            default:
                // Simple card types (qa, cloze, explanation, application, diagram)
                if let q = question, let a = answer {
                    result.append(GeneratedCard(style: cardStyle, question: q, answer: a))
                }
            }

            return result
        }
    }

    func generateCards(token: String, request: GenerateCardsRequest) async throws -> (cards: [GeneratedCard], usage: Int?) {
        return try await executeWithTokenRefresh(token: token) { currentToken in
            let url = URL(string: "\(self.baseURL)/api/generate-cards")!
            var urlRequest = URLRequest(url: url)
            urlRequest.httpMethod = "POST"
            urlRequest.setValue("Bearer \(currentToken)", forHTTPHeaderField: "Authorization")
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONEncoder().encode(request)
            urlRequest.timeoutInterval = self.timeout

            let (data, response) = try await URLSession.shared.data(for: urlRequest)
            try self.validateResponse(response, data: data)

            // Debug: log raw response for troubleshooting
            if let jsonString = String(data: data, encoding: .utf8) {
                print("PluckkAPI: /api/generate-cards response: \(jsonString.prefix(500))")
            }

            let apiResponse = try JSONDecoder().decode(GenerateCardsResponse.self, from: data)

            // Flatten all card types into simple GeneratedCards
            let cards = apiResponse.cards.flatMap { $0.toGeneratedCards() }

            var remaining: Int? = nil
            if let usage = apiResponse.usage {
                switch usage.remaining {
                case .number(let num):
                    remaining = num
                case .unlimited:
                    remaining = nil
                }
            }

            return (cards, remaining)
        }
    }

    // MARK: - Card Generation from Image

    func generateCardsFromImage(token: String, imageData: Data, context: SourceContext?) async throws -> (cards: [GeneratedCard], usage: Int?) {
        let contextString = context?.displayString ?? ""
        return try await executeWithTokenRefresh(token: token) { currentToken in
            let url = URL(string: "\(self.baseURL)/api/generate-cards-from-image")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(currentToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = self.timeout

            let base64Image = imageData.base64EncodedString()
            let body: [String: Any] = [
                "imageData": base64Image,
                "mimeType": "image/png",
                "context": contextString
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (data, response) = try await URLSession.shared.data(for: request)
            try self.validateResponse(response, data: data)

            // Debug: log raw response for troubleshooting
            if let jsonString = String(data: data, encoding: .utf8) {
                print("PluckkAPI: /api/generate-cards-from-image response: \(jsonString.prefix(500))")
            }

            let apiResponse = try JSONDecoder().decode(GenerateCardsResponse.self, from: data)

            // Flatten all card types into simple GeneratedCards
            let cards = apiResponse.cards.flatMap { $0.toGeneratedCards() }

            var remaining: Int? = nil
            if let usage = apiResponse.usage {
                switch usage.remaining {
                case .number(let num):
                    remaining = num
                case .unlimited:
                    remaining = nil
                }
            }

            return (cards, remaining)
        }
    }

    // MARK: - Send to Mochi / Save Card

    struct SendCardRequest: Encodable {
        let question: String
        let answer: String
        let sourceUrl: String
        let deckId: String?

        enum CodingKeys: String, CodingKey {
            case question, answer
            case sourceUrl = "sourceUrl"
            case deckId = "deck_id"
        }
    }

    struct SendCardResponse: Decodable {
        let success: Bool
        let cardId: String?
        let mochiCardId: String?

        enum CodingKeys: String, CodingKey {
            case success
            case cardId = "card_id"
            case mochiCardId = "mochi_card_id"
        }
    }

    func sendCard(token: String, card: GeneratedCard, sourceUrl: String, deckId: String?) async throws -> SendCardResponse {
        let body = SendCardRequest(
            question: card.question,
            answer: card.answer,
            sourceUrl: sourceUrl,
            deckId: deckId
        )

        // Log the request details
        print("PluckkAPI: sendCard - Sending card:")
        print("  Question: \(card.question.prefix(100))...")
        print("  Answer: \(card.answer.prefix(100))...")
        print("  Source URL: \(sourceUrl)")
        print("  Deck ID: \(deckId ?? "none")")

        return try await executeWithTokenRefresh(token: token) { currentToken in
            let url = URL(string: "\(self.baseURL)/api/send-to-mochi")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(currentToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = self.timeout
            request.httpBody = try JSONEncoder().encode(body)

            print("PluckkAPI: sendCard - Making request to \(url)")

            let (data, response) = try await URLSession.shared.data(for: request)

            // Log the raw response
            if let httpResponse = response as? HTTPURLResponse {
                print("PluckkAPI: sendCard - Response status: \(httpResponse.statusCode)")
            }
            if let jsonString = String(data: data, encoding: .utf8) {
                print("PluckkAPI: sendCard - Response body: \(jsonString)")
            }

            try self.validateResponse(response, data: data)

            let decoded = try JSONDecoder().decode(SendCardResponse.self, from: data)
            print("PluckkAPI: sendCard - Success! Card ID: \(decoded.cardId ?? "nil"), Mochi Card ID: \(decoded.mochiCardId ?? "nil")")

            return decoded
        }
    }

    // MARK: - Decks

    func fetchDecks(token: String) async throws -> [Deck] {
        return try await executeWithTokenRefresh(token: token) { currentToken in
            // Query Supabase directly for user's decks/folders
            let url = URL(string: "\(self.supabaseURL)/rest/v1/folders?select=*")!

            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.setValue("Bearer \(currentToken)", forHTTPHeaderField: "Authorization")
            request.setValue(self.supabaseKey, forHTTPHeaderField: "apikey")
            request.timeoutInterval = self.timeout

            let (data, response) = try await URLSession.shared.data(for: request)

            // Check for 401 specifically
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }

            // Supabase returns 200 even for empty results
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
                return []
            }

            struct Folder: Decodable {
                let id: String
                let name: String
                let user_id: String?
            }

            let folders = try JSONDecoder().decode([Folder].self, from: data)
            return folders.map { Deck(id: $0.id, name: $0.name, userId: $0.user_id, cardCount: nil) }
        }
    }

    // MARK: - Cards

    func fetchCards(token: String, limit: Int = 50, offset: Int = 0, search: String? = nil) async throws -> [SavedCard] {
        let supabaseUrl = supabaseURL
        var urlString = "\(supabaseUrl)/rest/v1/cards?select=*,card_review_state(*)&order=created_at.desc&limit=\(limit)&offset=\(offset)"

        if let search = search, !search.isEmpty {
            let encoded = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search
            urlString += "&or=(question.ilike.*\(encoded)*,answer.ilike.*\(encoded)*)"
        }

        let url = URL(string: urlString)!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            return []
        }

        return try JSONDecoder().decode([SavedCard].self, from: data)
    }

    func fetchDueCards(token: String) async throws -> [SavedCard] {
        let supabaseUrl = supabaseURL
        let now = ISO8601DateFormatter().string(from: Date())

        let urlString = "\(supabaseUrl)/rest/v1/cards?select=*,card_review_state(*)&card_review_state.next_review=lte.\(now)&order=card_review_state.next_review.asc&limit=50"

        let url = URL(string: urlString)!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            return []
        }

        let cards = try JSONDecoder().decode([SavedCard].self, from: data)

        // Filter to only include cards that are actually due
        let dateFormatter = ISO8601DateFormatter()
        return cards.filter { card in
            guard let reviewState = card.reviewState,
                  let nextReview = dateFormatter.date(from: reviewState.nextReview) else {
                return true // New cards without review state are due
            }
            return nextReview <= Date()
        }
    }

    // MARK: - Review

    func updateReviewState(token: String, cardId: String, quality: Int) async throws {
        let supabaseUrl = supabaseURL

        // First get current state
        let getUrl = URL(string: "\(supabaseUrl)/rest/v1/card_review_state?card_id=eq.\(cardId)&select=*")!
        var getRequest = URLRequest(url: getUrl)
        getRequest.httpMethod = "GET"
        getRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        getRequest.setValue(supabaseKey, forHTTPHeaderField: "apikey")

        let (getData, _) = try await URLSession.shared.data(for: getRequest)
        let existingStates = try? JSONDecoder().decode([CardReviewState].self, from: getData)
        let currentState = existingStates?.first

        // Calculate new state using SM-2
        let newState = calculateSM2(
            quality: quality,
            easiness: currentState?.easiness ?? 2.5,
            interval: currentState?.interval ?? 0,
            repetitions: currentState?.repetitions ?? 0
        )

        // Upsert the state
        let upsertUrl = URL(string: "\(supabaseUrl)/rest/v1/card_review_state")!
        var upsertRequest = URLRequest(url: upsertUrl)
        upsertRequest.httpMethod = "POST"
        upsertRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        upsertRequest.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        upsertRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        upsertRequest.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "card_id": cardId,
            "easiness": newState.easiness,
            "interval": newState.interval,
            "repetitions": newState.repetitions,
            "next_review": newState.nextReview
        ]
        upsertRequest.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await URLSession.shared.data(for: upsertRequest)
        try validateResponse(response, data: Data())
    }

    // SM-2 Algorithm implementation
    private func calculateSM2(quality: Int, easiness: Double, interval: Int, repetitions: Int) -> (easiness: Double, interval: Int, repetitions: Int, nextReview: String) {
        var newEasiness = easiness
        var newInterval = interval
        var newRepetitions = repetitions

        // Quality: 0-5 (0-2 = incorrect, 3-5 = correct with varying difficulty)
        if quality < 3 {
            // Failed - reset
            newRepetitions = 0
            newInterval = 1
        } else {
            // Passed
            if newRepetitions == 0 {
                newInterval = 1
            } else if newRepetitions == 1 {
                newInterval = 6
            } else {
                newInterval = Int(Double(interval) * easiness)
            }
            newRepetitions += 1
        }

        // Update easiness factor
        newEasiness = easiness + (0.1 - Double(5 - quality) * (0.08 + Double(5 - quality) * 0.02))
        newEasiness = max(1.3, newEasiness)

        // Calculate next review date
        let nextDate = Calendar.current.date(byAdding: .day, value: newInterval, to: Date())!
        let nextReview = ISO8601DateFormatter().string(from: nextDate)

        return (newEasiness, newInterval, newRepetitions, nextReview)
    }

    // MARK: - Helpers

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        // Check for 401 Unauthorized specifically
        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            // Try to parse error message
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.error ?? errorResponse.message ?? "Unknown error")
            }
            throw APIError.httpError(httpResponse.statusCode)
        }
    }

    /// Execute a request with automatic token refresh on 401
    /// - Parameters:
    ///   - token: The current access token
    ///   - isRetry: Internal flag to prevent infinite retry loops
    ///   - operation: The async operation to execute
    private func executeWithTokenRefresh<T>(
        token: String,
        isRetry: Bool = false,
        operation: (String) async throws -> T
    ) async throws -> T {
        do {
            return try await operation(token)
        } catch APIError.unauthorized {
            // Prevent infinite retry loops
            guard !isRetry else {
                print("PluckkAPI: Token refresh retry also got 401, giving up")
                throw APIError.unauthorized
            }

            // Try to refresh the token
            print("PluckkAPI: Got 401, attempting token refresh")
            if let newToken = await AuthManager.shared.refreshAccessToken() {
                print("PluckkAPI: Token refreshed, retrying request")
                return try await executeWithTokenRefresh(token: newToken, isRetry: true, operation: operation)
            } else {
                print("PluckkAPI: Token refresh failed")
                throw APIError.unauthorized
            }
        }
    }

    struct ErrorResponse: Decodable {
        let error: String?
        let message: String?
    }
}

enum APIError: LocalizedError {
    case invalidResponse
    case httpError(Int)
    case serverError(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .serverError(let message):
            return message
        case .unauthorized:
            return "Session expired. Please sign in again."
        }
    }
}
