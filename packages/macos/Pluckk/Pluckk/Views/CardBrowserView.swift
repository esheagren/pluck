import SwiftUI

struct CardBrowserView: View {
    @State private var cards: [SavedCard] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var selectedCard: SavedCard?
    @State private var hasMore = true
    @State private var offset = 0

    private let pageSize = 30

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search cards...", text: $searchText)
                    .textFieldStyle(.plain)
                    .onSubmit {
                        searchCards()
                    }
                if !searchText.isEmpty {
                    Button(action: {
                        searchText = ""
                        searchCards()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(10)
            .background(Color.primary.opacity(0.05))
            .cornerRadius(8)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            // Cards list
            if isLoading && cards.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if cards.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(cards) { card in
                            CardBrowserRow(card: card, isExpanded: selectedCard?.id == card.id)
                                .onTapGesture {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        if selectedCard?.id == card.id {
                                            selectedCard = nil
                                        } else {
                                            selectedCard = card
                                        }
                                    }
                                }
                        }

                        // Load more
                        if hasMore {
                            Button("Load More") {
                                loadMoreCards()
                            }
                            .buttonStyle(.bordered)
                            .padding(.vertical, 16)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .onAppear {
            if cards.isEmpty {
                loadCards()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "rectangle.stack")
                .font(.system(size: 40))
                .foregroundColor(.secondary.opacity(0.5))

            if searchText.isEmpty {
                Text("No cards yet")
                    .font(.headline)
                    .foregroundColor(.secondary)
                Text("Create cards by selecting text\nand double-tapping ⌘")
                    .font(.subheadline)
                    .foregroundColor(.secondary.opacity(0.7))
                    .multilineTextAlignment(.center)
            } else {
                Text("No matching cards")
                    .font(.headline)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func loadCards() {
        guard let token = AuthManager.shared.accessToken else { return }

        isLoading = true
        offset = 0

        Task {
            do {
                let fetchedCards = try await PluckkAPI.shared.fetchCards(
                    token: token,
                    limit: pageSize,
                    offset: 0,
                    search: searchText.isEmpty ? nil : searchText
                )

                await MainActor.run {
                    cards = fetchedCards
                    hasMore = fetchedCards.count >= pageSize
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                }
                print("Failed to load cards: \(error)")
            }
        }
    }

    private func loadMoreCards() {
        guard let token = AuthManager.shared.accessToken else { return }

        offset += pageSize
        isLoading = true

        Task {
            do {
                let fetchedCards = try await PluckkAPI.shared.fetchCards(
                    token: token,
                    limit: pageSize,
                    offset: offset,
                    search: searchText.isEmpty ? nil : searchText
                )

                await MainActor.run {
                    cards.append(contentsOf: fetchedCards)
                    hasMore = fetchedCards.count >= pageSize
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                }
                print("Failed to load more cards: \(error)")
            }
        }
    }

    private func searchCards() {
        cards = []
        loadCards()
    }
}

struct CardBrowserRow: View {
    let card: SavedCard
    let isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Question (always visible)
            Text(card.question)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(isExpanded ? nil : 2)

            if isExpanded {
                // Answer (visible when expanded)
                Text(card.answer)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                // Metadata
                HStack {
                    if let style = card.style {
                        Text(style.capitalized)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.1))
                            .foregroundColor(.accentColor)
                            .cornerRadius(4)
                    }

                    Spacer()

                    if let reviewState = card.reviewState {
                        dueIndicator(reviewState)
                    }

                    Text(formatDate(card.createdAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let source = card.sourceTitle ?? card.sourceUrl {
                    Text(source)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(12)
        .background(Color.primary.opacity(0.03))
        .cornerRadius(8)
        .animation(.easeInOut(duration: 0.2), value: isExpanded)
    }

    @ViewBuilder
    private func dueIndicator(_ state: CardReviewState) -> some View {
        let dateFormatter = ISO8601DateFormatter()
        if let nextReview = dateFormatter.date(from: state.nextReview) {
            let isDue = nextReview <= Date()
            HStack(spacing: 4) {
                Circle()
                    .fill(isDue ? Color.green : Color.orange)
                    .frame(width: 6, height: 6)
                Text(isDue ? "Due" : "In \(daysUntil(nextReview))d")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateString) else { return dateString }

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .short
        return displayFormatter.string(from: date)
    }

    private func daysUntil(_ date: Date) -> Int {
        let days = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
        return max(0, days)
    }
}

#Preview {
    CardBrowserView()
        .frame(width: 320, height: 600)
}
