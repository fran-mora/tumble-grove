import SwiftUI
import WebKit

/// Separate, unprivileged document view: it has no Core Motion bridge and
/// cannot replace the running game underneath it.
struct DocumentScreen: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var document: DocumentController

    init(url: URL) { _document = StateObject(wrappedValue: DocumentController(url: url)) }

    var body: some View {
        NavigationStack {
            ZStack {
                DocumentWebView(webView: document.webView)
                if let failure = document.failure {
                    ContentUnavailableView {
                        Label("Could not open this page", systemImage: "doc.text")
                    } description: { Text(failure) } actions: {
                        Button("Try again") { document.retry() }
                    }
                }
            }
            .navigationTitle(document.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { document.goBack() } label: { Label("Back", systemImage: "chevron.left") }
                        .disabled(!document.canGoBack)
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
            }
        }
    }
}

private struct DocumentWebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

private final class DocumentController: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    @Published private(set) var title = "Tumble Grove"
    @Published private(set) var canGoBack = false
    @Published private(set) var failure: String?
    let webView: WKWebView
    private let initialURL: URL

    init(url: URL) {
        initialURL = url
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(BundledSchemeHandler(), forURLScheme: BundledResources.scheme)
        // These are static reference pages. Disabling scripts also ensures that
        // following a link to index.html cannot start another game in the sheet.
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
    }

    func retry() { failure = nil; webView.load(URLRequest(url: webView.url ?? initialURL)) }
    func goBack() { failure = nil; webView.goBack() }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        title = webView.title ?? "Tumble Grove"
        canGoBack = webView.canGoBack
        failure = nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if let path = BundledResources.relativePath(for: url), path != "index.html" {
            if navigationAction.targetFrame == nil {
                decisionHandler(.cancel)
                webView.load(URLRequest(url: url))
            } else { decisionHandler(.allow) }
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated, BundledResources.isExternalLink(url) {
                UIApplication.shared.open(url)
            }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, navigationAction.navigationType == .linkActivated {
            if let path = BundledResources.relativePath(for: url), path != "index.html" { webView.load(URLRequest(url: url)) }
            else if BundledResources.isExternalLink(url) { UIApplication.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { handleError(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { handleError(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { failure = "iOS closed this page to recover memory. Your game remains in the main view." }
    private func handleError(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        canGoBack = webView.canGoBack
        failure = "This reference page could not be opened. Close it to return to your game."
    }
}
