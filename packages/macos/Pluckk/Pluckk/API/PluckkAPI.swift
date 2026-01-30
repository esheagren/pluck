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
        let url = URL(string: "\(baseURL)/api/user/me")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)

        // Debug: print raw response
        if let jsonString = String(data: data, encoding: .utf8) {
            print("PluckkAPI: /api/user/me response: \(jsonString.prefix(500))")
        }

        let meResponse = try JSONDecoder().decode(UserMeResponse.self, from: data)

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
            let limit: Int
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

    struct APICard: Decodable {
        let style: String
        let question: String
        let answer: String
    }

    func generateCards(token: String, request: GenerateCardsRequest) async throws -> (cards: [GeneratedCard], usage: Int?) {
        let url = URL(string: "\(baseURL)/api/generate-cards")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        urlRequest.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        try validateResponse(response, data: data)

        let apiResponse = try JSONDecoder().decode(GenerateCardsResponse.self, from: data)

        let cards = apiResponse.cards.map { apiCard in
            GeneratedCard(
                style: CardStyle(rawValue: apiCard.style) ?? .qa,
                question: apiCard.question,
                answer: apiCard.answer
            )
        }

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

    // MARK: - Card Generation from Image

    func generateCardsFromImage(token: String, imageData: Data, context: SourceContext?) async throws -> (cards: [GeneratedCard], usage: Int?) {
        let url = URL(string: "\(baseURL)/api/generate-cards-from-image")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = timeout

        let base64Image = imageData.base64EncodedString()
        let body: [String: Any] = [
            "imageData": base64Image,
            "mimeType": "image/png",
            "context": context?.displayString ?? ""
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)

        let apiResponse = try JSONDecoder().decode(GenerateCardsResponse.self, from: data)

        let cards = apiResponse.cards.map { apiCard in
            GeneratedCard(
                style: CardStyle(rawValue: apiCard.style) ?? .qa,
                question: apiCard.question,
                answer: apiCard.answer
            )
        }

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
        let url = URL(string: "\(baseURL)/api/send-to-mochi")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = timeout

        let body = SendCardRequest(
            question: card.question,
            answer: card.answer,
            sourceUrl: sourceUrl,
            deckId: deckId
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)

        return try JSONDecoder().decode(SendCardResponse.self, from: data)
    }

    // MARK: - Decks

    func fetchDecks(token: String) async throws -> [Deck] {
        // Query Supabase directly for user's decks/folders
        let supabaseUrl = supabaseURL
        let url = URL(string: "\(supabaseUrl)/rest/v1/folders?select=*")!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: request)

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

        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            // Try to parse error message
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.error ?? errorResponse.message ?? "Unknown error")
            }
            throw APIError.httpError(httpResponse.statusCode)
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

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .serverError(let message):
            return message
        }
    }
}
