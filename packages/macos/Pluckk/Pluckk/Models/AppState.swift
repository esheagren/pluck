import SwiftUI
import AppKit

// MARK: - App State

enum CapturedContent {
    case text(String)
    case image(NSImage)
}

enum PanelView {
    case generate
    case browse
    case review
    case settings
}

struct SourceContext {
    let appName: String
    let windowTitle: String

    var displayString: String {
        if windowTitle.isEmpty {
            return appName
        }
        return "\(appName) - \(windowTitle)"
    }
}

class AppState: ObservableObject {
    static let shared = AppState()

    @Published var isAuthenticated = false
    @Published var user: User?
    @Published var currentView: PanelView = .generate

    // Content capture
    @Published var capturedContent: CapturedContent?
    @Published var sourceContext: SourceContext?

    // Card generation
    @Published var isGenerating = false
    @Published var generatedCards: [GeneratedCard] = []
    @Published var selectedCardIndices: Set<Int> = []
    @Published var generationError: String?

    // Decks
    @Published var decks: [Deck] = []
    @Published var selectedDeckId: String?

    // Settings
    @Published var mochiEnabled = false
    @Published var mochiApiKey: String?
    @Published var mochiDeckId: String?

    // Usage
    @Published var usageRemaining: Int?
    @Published var subscriptionStatus: SubscriptionStatus = .free

    private init() {}

    func reset() {
        capturedContent = nil
        sourceContext = nil
        isGenerating = false
        generatedCards = []
        selectedCardIndices = []
        generationError = nil
    }
}

// MARK: - Card Models

struct GeneratedCard: Identifiable {
    let id = UUID()
    var style: CardStyle
    var question: String
    var answer: String
    var isSelected: Bool = true

    // For editable cards
    var isEditing: Bool = false
}

enum CardStyle: String, Codable {
    case qa
    case qa_bidirectional
    case cloze
    case cloze_list
    case explanation
    case application
    case diagram

    var displayName: String {
        switch self {
        case .qa: return "Q&A"
        case .qa_bidirectional: return "Bidirectional"
        case .cloze: return "Cloze"
        case .cloze_list: return "List Cloze"
        case .explanation: return "Explanation"
        case .application: return "Application"
        case .diagram: return "Diagram"
        }
    }
}

// MARK: - User Models

struct User: Codable {
    let id: String
    let email: String
    let username: String?
    let displayName: String?
    let subscriptionStatus: String?
    let mochiApiKey: String?
    let mochiDeckId: String?
    let cardsGeneratedThisMonth: Int?

    // Explicit memberwise initializer for manual creation
    init(id: String, email: String, username: String?, displayName: String?,
         subscriptionStatus: String?, mochiApiKey: String?, mochiDeckId: String?,
         cardsGeneratedThisMonth: Int?) {
        self.id = id
        self.email = email
        self.username = username
        self.displayName = displayName
        self.subscriptionStatus = subscriptionStatus
        self.mochiApiKey = mochiApiKey
        self.mochiDeckId = mochiDeckId
        self.cardsGeneratedThisMonth = cardsGeneratedThisMonth
    }

    enum CodingKeys: String, CodingKey {
        case id, email, username
        case displayName = "display_name"
        case subscriptionStatus = "subscription_status"
        case mochiApiKey = "mochi_api_key"
        case mochiDeckId = "mochi_deck_id"
        case cardsGeneratedThisMonth = "cards_generated_this_month"
    }
}

struct Deck: Codable, Identifiable {
    let id: String
    let name: String
    let userId: String?
    let cardCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, name
        case userId = "user_id"
        case cardCount = "card_count"
    }
}

enum SubscriptionStatus: String {
    case free
    case active
    case canceled
    case pastDue = "past_due"
    case admin

    var isPro: Bool {
        self == .active || self == .admin
    }
}

// MARK: - Review Models

struct CardReviewState: Codable {
    let cardId: String
    let easiness: Double
    let interval: Int
    let repetitions: Int
    let nextReview: String

    enum CodingKeys: String, CodingKey {
        case cardId = "card_id"
        case easiness, interval, repetitions
        case nextReview = "next_review"
    }
}

struct SavedCard: Codable, Identifiable {
    let id: String
    let userId: String
    let question: String
    let answer: String
    let style: String?
    let sourceUrl: String?
    let sourceTitle: String?
    let createdAt: String
    var reviewState: CardReviewState?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case question, answer, style
        case sourceUrl = "source_url"
        case sourceTitle = "source_title"
        case createdAt = "created_at"
        case reviewState = "card_review_state"
    }
}
