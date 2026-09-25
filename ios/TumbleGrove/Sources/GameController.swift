import Combine
import CoreMotion
import UIKit
import WebKit

struct LocalDocument: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: GameController?
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.receive(message)
    }
}

final class GameController: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    @Published private(set) var isLoading = true
    @Published private(set) var failure: String?
    @Published var document: LocalDocument?

    private let motion = CMMotionManager()
    private var wantsMotion = false
    private var sceneActive = false
    private var sheetPresented = false
    private var loadID = UUID()
    private var ready = false
    private var hasStarted = false
    private var samplePending = false
    private var effectiveActive: Bool { sceneActive && !sheetPresented && ready && failure == nil }

    lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(BundledSchemeHandler(), forURLScheme: BundledResources.scheme)
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let handler = WeakMessageHandler()
        handler.owner = self
        configuration.userContentController.add(handler, name: "tumbleGrove")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.isOpaque = false
        view.backgroundColor = UIColor(named: "LaunchBackground")
        view.scrollView.backgroundColor = UIColor(named: "LaunchBackground")
        view.scrollView.isScrollEnabled = false
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.allowsBackForwardNavigationGestures = false
        return view
    }()

    func startIfNeeded() {
        guard !hasStarted else { return }
        load()
    }

    func load() {
        hasStarted = true
        motion.stopDeviceMotionUpdates()
        wantsMotion = false
        samplePending = false
        ready = false
        isLoading = true
        failure = nil
        loadID = UUID()
        let id = loadID
        webView.load(URLRequest(url: BundledResources.home))
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            guard let self, self.loadID == id, !self.ready, self.failure == nil else { return }
            self.fail("The game could not finish opening. Please try again.")
        }
    }

    func setSceneActive(_ active: Bool) {
        sceneActive = active
        updateActivity()
    }

    func setSheetPresented(_ presented: Bool) {
        sheetPresented = presented
        updateActivity()
    }

    private func updateActivity() {
        dispatchEvent("tumblegrove:lifecycle", detail: ["active": effectiveActive])
        if effectiveActive && wantsMotion { startMotionIfNeeded() }
        else { motion.stopDeviceMotionUpdates() }
    }

    fileprivate func receive(_ message: WKScriptMessage) {
        // Only the bundled main game receives native capabilities. Document
        // sheets have a separate configuration without any message handlers.
        guard message.webView === webView, message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == BundledResources.scheme,
              message.frameInfo.securityOrigin.host == BundledResources.host,
              BundledResources.isHome(message.frameInfo.request.url),
              BundledResources.isHome(webView.url),
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "beginTilt":
            wantsMotion = true
            if effectiveActive { startMotionIfNeeded() }
        case "endTilt":
            wantsMotion = false
            motion.stopDeviceMotionUpdates()
        default: break
        }
    }

    private func startMotionIfNeeded() {
        guard !motion.isDeviceMotionActive else { return }
        guard motion.isDeviceMotionAvailable else {
            motionFailed("Gravity mode needs a device with motion sensors. You can still play the classic basket.")
            return
        }
        motion.deviceMotionUpdateInterval = 1.0 / 30.0
        motion.startDeviceMotionUpdates(to: .main) { [weak self] sample, error in
            guard let self, self.wantsMotion, self.effectiveActive else { return }
            guard error == nil, let sample else {
                self.motionFailed("Motion access is unavailable. Check Motion & Fitness access in Settings, then try Gravity mode again.")
                return
            }
            guard !self.samplePending else { return }
            let orientation = self.webView.window?.windowScene?.interfaceOrientation ?? .portrait
            let gravity = ScreenGravity.project(sample.gravity, orientation: orientation)
            guard gravity.x.isFinite, gravity.y.isFinite else { return }
            self.samplePending = true
            self.dispatchEvent("tumblegrove:tilt", detail: ["x": gravity.x, "y": gravity.y]) { [weak self] in
                self?.samplePending = false
            }
        }
    }

    private func motionFailed(_ message: String) {
        wantsMotion = false
        motion.stopDeviceMotionUpdates()
        dispatchEvent("tumblegrove:tilt-error", detail: ["message": message])
    }

    private func dispatchEvent(_ name: String, detail: [String: Any], completion: (() -> Void)? = nil) {
        guard ready, BundledResources.isHome(webView.url),
              let json = try? JSONSerialization.data(withJSONObject: ["name": name, "detail": detail], options: [.fragmentsAllowed]),
              let encoded = String(data: json, encoding: .utf8) else { completion?(); return }
        webView.evaluateJavaScript("(() => { const event = \(encoded); window.dispatchEvent(new CustomEvent(event.name, {detail: event.detail})); })()") { _, _ in completion?() }
    }

    private func fail(_ message: String) {
        wantsMotion = false
        motion.stopDeviceMotionUpdates()
        dispatchEvent("tumblegrove:lifecycle", detail: ["active": false])
        failure = message
        isLoading = false
        ready = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        checkGameReady(load: loadID, attempts: 40)
    }

    private func checkGameReady(load id: UUID, attempts: Int) {
        guard id == loadID, failure == nil else { return }
        webView.evaluateJavaScript("Boolean(document.querySelector('#root canvas'))") { [weak self] result, _ in
            guard let self, self.loadID == id, self.failure == nil else { return }
            if result as? Bool == true {
                self.ready = true
                self.isLoading = false
                self.updateActivity()
            } else if attempts > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in self?.checkGameReady(load: id, attempts: attempts - 1) }
            } else {
                self.fail("The game could not open its bundled resources. Please try again.")
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { handleNavigationError(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { handleNavigationError(error) }

    private func handleNavigationError(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        fail("The game could not open. All its resources are included in this app, so no internet connection is needed. Please try again.")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        fail("iOS closed the game to recover memory. Your saved best scores are safe. Restart to begin a new round.")
    }

    private func openLink(_ url: URL) {
        if let path = BundledResources.relativePath(for: url), path != "index.html" {
            setSheetPresented(true)
            document = LocalDocument(url: url)
        } else if BundledResources.isExternalLink(url) {
            UIApplication.shared.open(url)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if BundledResources.isHome(url), navigationAction.targetFrame?.isMainFrame == true,
           navigationAction.navigationType != .linkActivated {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated { openLink(url) }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url { openLink(url) }
        return nil
    }

    deinit { motion.stopDeviceMotionUpdates() }
}
