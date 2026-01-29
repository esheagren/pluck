import SwiftUI

struct LoginView: View {
    @ObservedObject private var authManager = AuthManager.shared

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Logo/Title
            VStack(spacing: 8) {
                Image(systemName: "rectangle.stack.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.accentColor)

                Text("Pluckk")
                    .font(.title)
                    .fontWeight(.semibold)

                Text("Create flashcards from anywhere")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Sign in buttons
            VStack(spacing: 12) {
                Button(action: { authManager.signInWithGoogle() }) {
                    HStack {
                        Image(systemName: "g.circle.fill")
                            .font(.system(size: 18))
                        Text("Sign in with Google")
                            .fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.white)
                    .foregroundColor(.black)
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
                .disabled(authManager.isLoading)

                if authManager.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }

                if let error = authManager.error {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 24)

            Spacer()

            // Footer
            Text("Your cards sync with pluckk.com")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.bottom, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    LoginView()
        .frame(width: 320, height: 500)
}
