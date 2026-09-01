import Foundation
import AppKit

/// Thin client over the Pluckk API. Every call carries the bearer token; a 401
/// signs the user out. No scheduling or storage logic lives here any more —
/// the server owns cards, folders, review state and Mochi sync.
class PluckkAPI {
    static let shared = PluckkAPI()

    private let baseURL = Config.backendURL
    private let timeout: TimeInterval = 60

    private init() {}

    // MARK: - User

    struct UserMeResponse: Decodable {
        let user: UserInfo
        let settings: SettingsInfo?

        struct UserInfo: Decodable {
            let id: String
            let email: String?
            let displayName: String?
            let avatarUrl: String?
        }
        struct SettingsInfo: Decodable {
            let mochiApiKey: String?
            let mochiDeckId: String?
        }
    }

    func fetchUser(token: String) async throws -> User {
        let data = try await send(token: token, method: "GET", path: "/api/user/me")
        let me = try JSONDecoder().decode(UserMeResponse.self, from: data)
        return User(
            id: me.user.id,
            email: me.user.email ?? "",
            displayName: me.user.displayName,
            mochiApiKey: me.settings?.mochiApiKey,
            mochiDeckId: me.settings?.mochiDeckId
        )
    }

    /// PATCH /api/user/me — keys are camelCase (`mochiApiKey`, `mochiDeckId`, `displayName`).
    func updateUser(token: String, updates: [String: Any]) async throws {
        _ = try await send(token: token, method: "PATCH", path: "/api/user/me", json: updates)
    }

    func revokeToken(_ token: String) async {
        _ = try? await send(token: token, method: "DELETE", path: "/api/v1/auth/token")
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
    }

    /// API card format - supports multiple card styles from the backend
    struct APICard: Decodable {
        let style: String
        let question: String?
        let answer: String?
        let forward: QAPair?
        let reverse: QAPair?
        let list_name: String?
        let items: [String]?
        let prompts: [QAPair]?
        let diagram_prompt: String?

        struct QAPair: Decodable {
            let question: String
            let answer: String
        }

        /// Convert API card to GeneratedCard, preserving structure for bidirectional/list types.
        func toGeneratedCard() -> GeneratedCard {
            let cardStyle = CardStyle(rawValue: style) ?? .qa
            switch style {
            case "qa_bidirectional":
                if forward == nil && reverse == nil, let q = question, let a = answer {
                    return GeneratedCard(style: .qa, question: q, answer: a)
                }
                let fwdPair: Pluckk.QAPair? = forward.map { Pluckk.QAPair(question: $0.question, answer: $0.answer) }
                let revPair: Pluckk.QAPair? = reverse.map { Pluckk.QAPair(question: $0.question, answer: $0.answer) }
                return GeneratedCard(
                    style: .qa_bidirectional,
                    question: forward?.question ?? "",
                    answer: forward?.answer ?? "",
                    forward: fwdPair,
                    reverse: revPair
                )
            case "cloze_list":
                if prompts == nil || prompts?.isEmpty == true, let q = question, let a = answer {
                    return GeneratedCard(style: .cloze, question: q, answer: a)
                }
                let qaPairs: [Pluckk.QAPair]? = prompts?.map { Pluckk.QAPair(question: $0.question, answer: $0.answer) }
                return GeneratedCard(
                    style: .cloze_list,
                    question: list_name ?? "List",
                    answer: items?.joined(separator: ", ") ?? "",
                    listName: list_name,
                    items: items,
                    prompts: qaPairs
                )
            default:
                return GeneratedCard(style: cardStyle, question: question ?? "", answer: answer ?? "")
            }
        }
    }

    func generateCards(token: String, request: GenerateCardsRequest) async throws -> [GeneratedCard] {
        let body = try JSONEncoder().encode(request)
        let data = try await send(token: token, method: "POST", path: "/api/generate-cards", body: body)
        let apiResponse = try JSONDecoder().decode(GenerateCardsResponse.self, from: data)
        return apiResponse.cards.map { $0.toGeneratedCard() }
    }

    func generateCardsFromImage(token: String, imageData: Data, context: SourceContext?) async throws -> [GeneratedCard] {
        let body: [String: Any] = [
            "imageData": imageData.base64EncodedString(),
            "mimeType": "image/png",
            "context": context?.displayString ?? ""
        ]
        let data = try await send(token: token, method: "POST", path: "/api/generate-cards-from-image", json: body)
        let apiResponse = try JSONDecoder().decode(GenerateCardsResponse.self, from: data)
        return apiResponse.cards.map { $0.toGeneratedCard() }
    }

    // MARK: - Save Card

    struct SendCardResponse {
        let success: Bool
        let cardId: String?
        let mochiCardId: String?
    }

    private struct CardRow: Decodable { let id: String }

    /// Save a card via POST /api/v1/cards; optionally mirror it to Mochi via the API.
    func sendCard(token: String, card: GeneratedCard, sourceUrl: String, sourceTitle: String?, deckId: String?) async throws -> SendCardResponse {
        var body: [String: Any] = [
            "question": card.question,
            "answer": card.answer,
            "style": card.style.rawValue,
            "source_url": sourceUrl,
        ]
        if let sourceTitle, !sourceTitle.isEmpty { body["source_title"] = sourceTitle }
        if let deckId { body["folder_id"] = deckId }

        let data = try await send(token: token, method: "POST", path: "/api/v1/cards", json: body)
        let saved = try JSONDecoder().decode(CardRow.self, from: data)

        var mochiCardId: String? = nil
        if AppState.shared.mochiEnabled {
            do {
                mochiCardId = try await sendCardToMochi(token: token, question: card.question, answer: card.answer, sourceUrl: sourceUrl)
            } catch {
                print("PluckkAPI: Mochi send failed (card still saved): \(error.localizedDescription)")
            }
        }
        return SendCardResponse(success: true, cardId: saved.id, mochiCardId: mochiCardId)
    }

    private func sendCardToMochi(token: String, question: String, answer: String, sourceUrl: String) async throws -> String? {
        struct MochiResponse: Decodable { let success: Bool; let cardId: String? }
        let data = try await send(token: token, method: "POST", path: "/api/send-to-mochi",
                                  json: ["question": question, "answer": answer, "sourceUrl": sourceUrl])
        return try JSONDecoder().decode(MochiResponse.self, from: data).cardId
    }

    // MARK: - Decks (folders) and Mochi decks

    private struct FolderRow: Decodable { let id: String; let name: String }

    func fetchDecks(token: String) async throws -> [Deck] {
        let data = try await send(token: token, method: "GET", path: "/api/v1/folders")
        return try JSONDecoder().decode([FolderRow].self, from: data).map { Deck(id: $0.id, name: $0.name) }
    }

    /// Lists the user's Mochi decks using the key stored server-side (never sends the key from the client).
    func fetchMochiDecks(token: String) async throws -> [MochiDeck] {
        struct Response: Decodable { let decks: [MochiDeck] }
        let data = try await send(token: token, method: "GET", path: "/api/import-from-mochi")
        return try JSONDecoder().decode(Response.self, from: data).decks
    }

    // MARK: - Transport

    private func send(token: String, method: String, path: String, json: [String: Any]) async throws -> Data {
        try await send(token: token, method: method, path: path, body: JSONSerialization.data(withJSONObject: json))
    }

    private func send(token: String, method: String, path: String, body: Data? = nil) async throws -> Data {
        let url = URL(string: "\(baseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        request.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

        if http.statusCode == 401 {
            await AuthManager.shared.handleUnauthorized()
            throw APIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            if let err = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(err.error ?? err.message ?? "Unknown error")
            }
            throw APIError.httpError(http.statusCode)
        }
        return data
    }

    struct ErrorResponse: Decodable {
        let error: String?
        let message: String?
    }
}

struct MochiDeck: Decodable {
    let id: String
    let name: String
}

enum APIError: LocalizedError {
    case invalidResponse
    case httpError(Int)
    case serverError(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid response from server"
        case .httpError(let code): return "HTTP error: \(code)"
        case .serverError(let message): return message
        case .unauthorized: return "Session expired. Please sign in again."
        }
    }
}
