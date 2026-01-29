import SwiftUI

struct ReviewSessionView: View {
    @State private var dueCards: [SavedCard] = []
    @State private var currentIndex = 0
    @State private var isAnswerRevealed = false
    @State private var isLoading = true
    @State private var sessionComplete = false
    @State private var reviewedCount = 0

    var body: some View {
        VStack(spacing: 0) {
            if isLoading {
                loadingState
            } else if dueCards.isEmpty {
                emptyState
            } else if sessionComplete {
                completedState
            } else {
                reviewCard
            }
        }
        .onAppear {
            loadDueCards()
        }
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: 16) {
            Spacer()
            ProgressView()
            Text("Loading due cards...")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "checkmark.circle")
                .font(.system(size: 48))
                .foregroundColor(.green)

            Text("All caught up!")
                .font(.title2)
                .fontWeight(.semibold)

            Text("No cards due for review")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var completedState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "star.fill")
                .font(.system(size: 48))
                .foregroundColor(.yellow)

            Text("Session Complete!")
                .font(.title2)
                .fontWeight(.semibold)

            Text("You reviewed \(reviewedCount) card\(reviewedCount == 1 ? "" : "s")")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Button("Start New Session") {
                resetSession()
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Review Card

    private var reviewCard: some View {
        let card = dueCards[currentIndex]

        return VStack(spacing: 0) {
            // Progress header
            HStack {
                Text("\(currentIndex + 1) of \(dueCards.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.primary.opacity(0.1))
                        Rectangle()
                            .fill(Color.accentColor)
                            .frame(width: geo.size.width * CGFloat(currentIndex) / CGFloat(dueCards.count))
                    }
                }
                .frame(width: 100, height: 4)
                .cornerRadius(2)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            // Card content
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Question
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Question")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)

                        Text(card.question)
                            .font(.body)
                    }

                    // Answer (revealed on tap or space)
                    if isAnswerRevealed {
                        Divider()

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Answer")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .textCase(.uppercase)

                            Text(card.answer)
                                .font(.body)
                                .foregroundColor(.primary.opacity(0.9))
                        }
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .padding(16)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture {
                if !isAnswerRevealed {
                    withAnimation(.easeOut(duration: 0.2)) {
                        isAnswerRevealed = true
                    }
                }
            }

            Divider()

            // Action buttons
            if isAnswerRevealed {
                ratingButtons(cardId: card.id)
            } else {
                revealButton
            }
        }
    }

    private var revealButton: some View {
        Button(action: {
            withAnimation(.easeOut(duration: 0.2)) {
                isAnswerRevealed = true
            }
        }) {
            Text("Show Answer")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.borderedProminent)
        .padding(16)
        .keyboardShortcut(.space, modifiers: [])
    }

    private func ratingButtons(cardId: String) -> some View {
        HStack(spacing: 8) {
            ratingButton(label: "Again", quality: 1, color: .red, shortcut: "1")
            ratingButton(label: "Hard", quality: 2, color: .orange, shortcut: "2")
            ratingButton(label: "Good", quality: 3, color: .green, shortcut: "3")
            ratingButton(label: "Easy", quality: 4, color: .blue, shortcut: "4")
        }
        .padding(16)
    }

    private func ratingButton(label: String, quality: Int, color: Color, shortcut: String) -> some View {
        Button(action: {
            rateCard(quality: quality)
        }) {
            VStack(spacing: 4) {
                Text(label)
                    .font(.caption)
                    .fontWeight(.medium)
                Text("[\(shortcut)]")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
        .keyboardShortcut(KeyEquivalent(Character(shortcut)), modifiers: [])
    }

    // MARK: - Actions

    private func loadDueCards() {
        guard let token = AuthManager.shared.accessToken else {
            isLoading = false
            return
        }

        Task {
            do {
                let cards = try await PluckkAPI.shared.fetchDueCards(token: token)
                await MainActor.run {
                    dueCards = cards
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                }
                print("Failed to load due cards: \(error)")
            }
        }
    }

    private func rateCard(quality: Int) {
        guard let token = AuthManager.shared.accessToken else { return }

        let card = dueCards[currentIndex]

        Task {
            do {
                try await PluckkAPI.shared.updateReviewState(
                    token: token,
                    cardId: card.id,
                    quality: quality
                )
            } catch {
                print("Failed to update review state: \(error)")
            }
        }

        // Move to next card
        reviewedCount += 1

        if currentIndex + 1 >= dueCards.count {
            sessionComplete = true
        } else {
            currentIndex += 1
            isAnswerRevealed = false
        }
    }

    private func resetSession() {
        currentIndex = 0
        reviewedCount = 0
        sessionComplete = false
        isAnswerRevealed = false
        isLoading = true
        dueCards = []
        loadDueCards()
    }
}

#Preview {
    ReviewSessionView()
        .frame(width: 320, height: 600)
}
