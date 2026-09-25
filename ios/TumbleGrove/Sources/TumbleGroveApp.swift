import SwiftUI
import WebKit

@main
struct TumbleGroveApp: App {
    var body: some Scene {
        WindowGroup { GameScreen() }
    }
}

private struct GameScreen: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var game = GameController()

    var body: some View {
        ZStack {
            Color("LaunchBackground").ignoresSafeArea()
            GameWebView(webView: game.webView).ignoresSafeArea()
            if game.isLoading {
                Color("LaunchBackground").ignoresSafeArea()
                VStack(spacing: 18) {
                    Text("Tumble Grove").font(.largeTitle.bold())
                    ProgressView("Opening your fruit basket…")
                }.accessibilityElement(children: .combine)
            }
            if let message = game.failure {
                Color("LaunchBackground").ignoresSafeArea()
                VStack(spacing: 20) {
                    Image(systemName: "leaf.circle").font(.system(size: 52))
                    Text("Let’s get growing again").font(.title2.bold())
                    Text(message).multilineTextAlignment(.center)
                    Button("Restart game") { game.load() }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 0.25, green: 0.40, blue: 0.23))
                }.padding(32).frame(maxWidth: 460)
            }
        }
        .onAppear {
            game.setSceneActive(scenePhase == .active)
            game.startIfNeeded()
        }
        .onChange(of: scenePhase) { _, phase in game.setSceneActive(phase == .active) }
        .sheet(item: $game.document, onDismiss: { game.setSheetPresented(false) }) { document in
            DocumentScreen(url: document.url)
        }
    }
}

private struct GameWebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
