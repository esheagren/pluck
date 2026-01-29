import SwiftUI
import AppKit
import UserNotifications

struct CardGenerationView: View {
    @ObservedObject private var appState = AppState.shared
    @State private var editingCardIndex: Int?

    var body: some View {
        VStack(spacing: 0) {
            if appState.capturedContent == nil {
                emptyState
            } else if appState.isGenerating {
                loadingState
            } else if !appState.generatedCards.isEmpty {
                cardSelectionView
            } else if let error = appState.generationError {
                errorState(error)
            } else {
                // Content captured but not yet generating
                capturedContentPreview
            }
        }
        .onAppear {
            if appState.capturedContent != nil && appState.generatedCards.isEmpty && !appState.isGenerating {
                generateCards()
            }
        }
    }

    // MARK: - Empty State (matches extension no-selection-state)

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            // Logo icon - using the actual PNG from extension
            if let logoImage = NSImage(named: "icon-128") {
                Image(nsImage: logoImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 64, height: 64)
                    .opacity(0.8)
            } else {
                // Fallback to PluckkLogo if PNG not found
                PluckkLogo(size: 64)
                    .opacity(0.8)
            }

            // Hint text matching extension
            Text("Select text or paste screenshot")
                .font(.system(size: PluckkTheme.FontSize.small))
                .foregroundColor(colorScheme == .dark
                    ? PluckkTheme.Dark.textSecondary
                    : PluckkTheme.Light.textSecondary)

            // Question input placeholder (matches extension's "..." input)
            TextField("...", text: .constant(""))
                .textFieldStyle(.plain)
                .font(.system(size: PluckkTheme.FontSize.body))
                .foregroundColor(colorScheme == .dark
                    ? PluckkTheme.Dark.textSecondary
                    : PluckkTheme.Light.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 200)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(
                    RoundedRectangle(cornerRadius: PluckkTheme.Radius.medium)
                        .stroke(colorScheme == .dark
                            ? PluckkTheme.Dark.border
                            : PluckkTheme.Light.border, lineWidth: 1)
                )
                .disabled(true)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding()
    }

    @Environment(\.colorScheme) var colorScheme

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: 16) {
            Spacer()

            ProgressView()
                .scaleEffect(1.2)

            Text("Generating cards...")
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Show preview of captured content
            if let content = appState.capturedContent {
                contentPreviewSmall(content)
                    .padding(.top, 8)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding()
    }

    // MARK: - Error State

    private func errorState(_ error: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundColor(.orange)

            Text(error)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button("Try Again") {
                generateCards()
            }
            .buttonStyle(.borderedProminent)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding()
    }

    // MARK: - Content Preview

    private var capturedContentPreview: some View {
        VStack(spacing: 16) {
            if let content = appState.capturedContent {
                contentPreviewSmall(content)
            }

            Button("Generate Cards") {
                generateCards()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    @ViewBuilder
    private func contentPreviewSmall(_ content: CapturedContent) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if let context = appState.sourceContext {
                Text(context.displayString)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            switch content {
            case .text(let text):
                Text(text.prefix(200) + (text.count > 200 ? "..." : ""))
                    .font(.caption)
                    .foregroundColor(.primary.opacity(0.8))
                    .lineLimit(4)
            case .image(let image):
                Image(nsImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxHeight: 100)
                    .cornerRadius(6)
            }
        }
        .padding(12)
        .background(Color.primary.opacity(0.05))
        .cornerRadius(8)
    }

    // MARK: - Card Selection

    private var cardSelectionView: some View {
        VStack(spacing: 0) {
            // Cards list
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(Array(appState.generatedCards.enumerated()), id: \.element.id) { index, card in
                        CardRowView(
                            card: card,
                            index: index,
                            isSelected: appState.selectedCardIndices.contains(index),
                            isEditing: editingCardIndex == index,
                            onToggle: { toggleCard(index) },
                            onEdit: { startEditing(index) },
                            onSaveEdit: { question, answer in saveEdit(index, question: question, answer: answer) },
                            onCancelEdit: { cancelEdit() }
                        )
                    }
                }
                .padding(16)
            }

            Divider()

            // Bottom actions
            bottomActions
        }
        .onAppear {
            // Select all cards by default
            appState.selectedCardIndices = Set(appState.generatedCards.indices)
        }
    }

    private var bottomActions: some View {
        VStack(spacing: 12) {
            // Deck selector
            if !appState.decks.isEmpty {
                HStack {
                    Text("Deck:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Picker("", selection: $appState.selectedDeckId) {
                        Text("None").tag(nil as String?)
                        ForEach(appState.decks) { deck in
                            Text(deck.name).tag(deck.id as String?)
                        }
                    }
                    .labelsHidden()
                    .frame(maxWidth: .infinity)
                }
            }

            // Mochi toggle (if configured)
            if appState.mochiApiKey != nil {
                Toggle("Also send to Mochi", isOn: $appState.mochiEnabled)
                    .font(.caption)
            }

            // Usage info
            if let remaining = appState.usageRemaining, !appState.subscriptionStatus.isPro {
                Text("\(remaining) cards remaining this month")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Send button
            HStack {
                Button("Regenerate") {
                    regenerateCards()
                }
                .buttonStyle(.bordered)
                .keyboardShortcut("r", modifiers: [])

                Spacer()

                Button("Send \(appState.selectedCardIndices.count) Card\(appState.selectedCardIndices.count == 1 ? "" : "s")") {
                    sendCards()
                }
                .buttonStyle(.borderedProminent)
                .disabled(appState.selectedCardIndices.isEmpty)
                .keyboardShortcut(.return, modifiers: [])
            }
        }
        .padding(16)
    }

    // MARK: - Actions

    private func generateCards() {
        guard let token = AuthManager.shared.accessToken else { return }

        appState.isGenerating = true
        appState.generationError = nil
        appState.generatedCards = []

        Task {
            do {
                let result: (cards: [GeneratedCard], usage: Int?)

                switch appState.capturedContent {
                case .text(let text):
                    let request = PluckkAPI.GenerateCardsRequest(
                        selection: text,
                        context: "",
                        url: appState.sourceContext?.displayString ?? "",
                        title: appState.sourceContext?.windowTitle ?? "",
                        focusText: nil
                    )
                    result = try await PluckkAPI.shared.generateCards(token: token, request: request)

                case .image(let image):
                    guard let tiffData = image.tiffRepresentation,
                          let bitmap = NSBitmapImageRep(data: tiffData),
                          let pngData = bitmap.representation(using: .png, properties: [:]) else {
                        throw APIError.serverError("Failed to convert image")
                    }
                    result = try await PluckkAPI.shared.generateCardsFromImage(
                        token: token,
                        imageData: pngData,
                        context: appState.sourceContext
                    )

                case .none:
                    return
                }

                await MainActor.run {
                    appState.generatedCards = result.cards
                    appState.selectedCardIndices = Set(result.cards.indices)
                    if let remaining = result.usage {
                        appState.usageRemaining = remaining
                    }
                    appState.isGenerating = false
                }

                // Fetch decks if we haven't yet
                if appState.decks.isEmpty {
                    let decks = try await PluckkAPI.shared.fetchDecks(token: token)
                    await MainActor.run {
                        appState.decks = decks
                    }
                }

            } catch {
                await MainActor.run {
                    appState.generationError = error.localizedDescription
                    appState.isGenerating = false
                }
            }
        }
    }

    private func regenerateCards() {
        appState.generatedCards = []
        appState.selectedCardIndices = []
        generateCards()
    }

    private func toggleCard(_ index: Int) {
        if appState.selectedCardIndices.contains(index) {
            appState.selectedCardIndices.remove(index)
        } else {
            appState.selectedCardIndices.insert(index)
        }
    }

    private func startEditing(_ index: Int) {
        editingCardIndex = index
    }

    private func saveEdit(_ index: Int, question: String, answer: String) {
        appState.generatedCards[index].question = question
        appState.generatedCards[index].answer = answer
        editingCardIndex = nil
    }

    private func cancelEdit() {
        editingCardIndex = nil
    }

    private func sendCards() {
        guard let token = AuthManager.shared.accessToken else { return }

        let selectedCards = appState.selectedCardIndices.map { appState.generatedCards[$0] }
        guard !selectedCards.isEmpty else { return }

        Task {
            var successCount = 0
            var lastError: Error?

            for card in selectedCards {
                do {
                    _ = try await PluckkAPI.shared.sendCard(
                        token: token,
                        card: card,
                        sourceUrl: appState.sourceContext?.displayString ?? "",
                        deckId: appState.selectedDeckId
                    )
                    successCount += 1
                } catch {
                    lastError = error
                }
            }

            await MainActor.run {
                if successCount > 0 {
                    showSuccessToast(count: successCount)
                    if successCount == selectedCards.count {
                        collapsePanel()
                    }
                }

                // Show error if some cards failed
                let failedCount = selectedCards.count - successCount
                if failedCount > 0 {
                    appState.generationError = "Failed to save \(failedCount) card\(failedCount == 1 ? "" : "s"): \(lastError?.localizedDescription ?? "Unknown error")"
                }
            }
        }
    }

    private func showSuccessToast(count: Int) {
        // Use UserNotifications framework
        let content = UNMutableNotificationContent()
        content.title = "Cards Saved"
        content.body = "\(count) card\(count == 1 ? "" : "s") added to Pluckk"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    private func collapsePanel() {
        if let appDelegate = NSApp.delegate as? AppDelegate {
            appDelegate.panel.collapse()
        }
    }
}

// MARK: - Card Row View

struct CardRowView: View {
    let card: GeneratedCard
    let index: Int
    let isSelected: Bool
    let isEditing: Bool
    let onToggle: () -> Void
    let onEdit: () -> Void
    let onSaveEdit: (String, String) -> Void
    let onCancelEdit: () -> Void

    @State private var editQuestion: String = ""
    @State private var editAnswer: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header with checkbox and style badge
            HStack {
                Button(action: onToggle) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(isSelected ? .accentColor : .secondary)
                }
                .buttonStyle(.plain)

                Text("[\(index + 1)]")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(card.style.displayName)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.1))
                    .foregroundColor(.accentColor)
                    .cornerRadius(4)

                Spacer()

                if !isEditing {
                    Button(action: onEdit) {
                        Image(systemName: "pencil")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }

            if isEditing {
                // Edit mode
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Question", text: $editQuestion, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...6)

                    TextField("Answer", text: $editAnswer, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...6)

                    HStack {
                        Button("Cancel") {
                            onCancelEdit()
                        }
                        .buttonStyle(.bordered)

                        Button("Save") {
                            onSaveEdit(editQuestion, editAnswer)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .onAppear {
                    editQuestion = card.question
                    editAnswer = card.answer
                }
            } else {
                // Display mode
                VStack(alignment: .leading, spacing: 4) {
                    Text("Q: \(card.question)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(3)

                    Text("A: \(card.answer)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                }
            }
        }
        .padding(12)
        .background(isSelected ? Color.accentColor.opacity(0.05) : Color.primary.opacity(0.03))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isSelected ? Color.accentColor.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}

#Preview {
    CardGenerationView()
        .frame(width: 320, height: 600)
}
