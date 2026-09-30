import CoreMotion
import UIKit
import WebKit
import XCTest
@testable import TumbleGrove

final class NativeShellTests: XCTestCase {
    @MainActor
    func testRetryIgnoresSupersededCallbacksAndAcceptsLatestReadyResult() throws {
        let view = NavigationTestWebView()
        let controller = GameController(makeWebView: { _ in view })
        controller.load()
        let previous = try XCTUnwrap(view.navigations.last)
        controller.load()
        let current = try XCTUnwrap(view.navigations.last)
        XCTAssertFalse(previous === current)

        // Retry replaces a slow provisional navigation, whose WebKit 102
        // cancellation can arrive after the new attempt has already started.
        controller.webView(view, didFailProvisionalNavigation: previous,
                           withError: NSError(domain: "WebKitErrorDomain", code: 102))
        controller.webView(view, didFail: previous,
                           withError: URLError(.fileDoesNotExist))
        controller.webView(view, didFinish: previous)
        XCTAssertNil(controller.failure)
        XCTAssertTrue(controller.isLoading)
        XCTAssertTrue(view.readyChecks.isEmpty, "A stale finish must not probe the new document")

        controller.webView(view, didFinish: current)
        XCTAssertEqual(view.readyChecks.count, 1)
        view.readyChecks[0](true, nil)
        XCTAssertNil(controller.failure)
        XCTAssertFalse(controller.isLoading)
    }

    @MainActor
    func testReadinessCompletionFromBeforeRetryCannotCompleteNewLoad() throws {
        let view = NavigationTestWebView()
        let controller = GameController(makeWebView: { _ in view })
        controller.load()
        let previous = try XCTUnwrap(view.navigations.last)
        controller.webView(view, didFinish: previous)
        XCTAssertEqual(view.readyChecks.count, 1)
        controller.load()
        let current = try XCTUnwrap(view.navigations.last)
        view.readyChecks[0](true, nil)
        XCTAssertTrue(controller.isLoading)
        XCTAssertNil(controller.failure)

        controller.webView(view, didFinish: current)
        XCTAssertEqual(view.readyChecks.count, 2)
        view.readyChecks[1](true, nil)
        XCTAssertFalse(controller.isLoading)
        XCTAssertNil(controller.failure)
    }

    @MainActor
    func testOnlyCurrentNonCancelledNavigationFailureShowsRecovery() throws {
        let view = NavigationTestWebView()
        let controller = GameController(makeWebView: { _ in view })
        controller.load()
        let current = try XCTUnwrap(view.navigations.last)
        controller.webView(view, didFailProvisionalNavigation: nil,
                           withError: URLError(.fileDoesNotExist))
        controller.webView(NavigationTestWebView(), didFail: current,
                           withError: URLError(.fileDoesNotExist))
        controller.webView(view, didFailProvisionalNavigation: current,
                           withError: URLError(.cancelled))
        XCTAssertNil(controller.failure)
        XCTAssertTrue(controller.isLoading)

        // A current policy failure is real; only superseded policy failures
        // should be discarded by navigation identity.
        controller.webView(view, didFailProvisionalNavigation: current,
                           withError: NSError(domain: "WebKitErrorDomain", code: 102))
        XCTAssertNotNil(controller.failure)
        XCTAssertFalse(controller.isLoading)
    }

    func testGravityPointsDownWhenHeldUprightInEveryInterfaceOrientation() {
        let cases: [(UIInterfaceOrientation, CMAcceleration)] = [
            (.portrait, CMAcceleration(x: 0, y: -1, z: 0)),
            (.portraitUpsideDown, CMAcceleration(x: 0, y: 1, z: 0)),
            (.landscapeLeft, CMAcceleration(x: 1, y: 0, z: 0)),
            (.landscapeRight, CMAcceleration(x: -1, y: 0, z: 0))
        ]
        for (orientation, vector) in cases {
            let gravity = ScreenGravity.project(vector, orientation: orientation)
            XCTAssertEqual(gravity.x, 0, accuracy: 0.00001, "\(orientation)")
            XCTAssertEqual(gravity.y, 1, accuracy: 0.00001, "\(orientation)")
        }
    }

    func testFlatPhoneHasNoPlanarGravityAndProjectionPreservesTiltStrength() {
        for orientation in [UIInterfaceOrientation.portrait, .portraitUpsideDown, .landscapeLeft, .landscapeRight] {
            let flat = ScreenGravity.project(CMAcceleration(x: 0, y: 0, z: -1), orientation: orientation)
            XCTAssertEqual(flat.x, 0)
            XCTAssertEqual(flat.y, 0)
            let partial = ScreenGravity.project(CMAcceleration(x: 0.3, y: -0.4, z: -0.866), orientation: orientation)
            XCTAssertEqual(hypot(partial.x, partial.y), 0.5, accuracy: 0.00001)
        }
    }

    func testHomeAndResourcesStayWithinBundle() throws {
        let root = URL(fileURLWithPath: "/tmp/TumbleGroveTests-Web", isDirectory: true)
        let home = try XCTUnwrap(URL(string: "tumblegrove://game/"))
        XCTAssertTrue(BundledResources.isHome(home))
        XCTAssertEqual(BundledResources.fileURL(for: home, root: root)?.lastPathComponent, "index.html")
        let asset = try XCTUnwrap(URL(string: "tumblegrove://game/assets/index-123.js?v=1"))
        XCTAssertEqual(BundledResources.relativePath(for: asset), "assets/index-123.js")
        XCTAssertTrue(BundledResources.fileURL(for: asset, root: root)?.path.hasSuffix("/assets/index-123.js") == true)
        XCTAssertFalse(BundledResources.isHome(asset))
    }

    func testTraversalAndForeignOriginsAreRejected() throws {
        for value in [
            "https://game/index.html", "file:///etc/passwd", "tumblegrove://other/index.html",
            "tumblegrove://user@game/index.html", "tumblegrove://game:80/index.html",
            "tumblegrove://game/%2e%2e/private", "tumblegrove://game/assets/%2e%2e/private",
            "tumblegrove://game/assets%2f..%2fprivate", "tumblegrove://game/assets%5cprivate",
            "tumblegrove://game/private%00.html"
        ] {
            let url = try XCTUnwrap(URL(string: value))
            XCTAssertNil(BundledResources.relativePath(for: url), value)
            XCTAssertFalse(BundledResources.isHome(url), value)
        }
    }

    func testSymlinkCannotEscapeBundle() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("escape"), withDestinationURL: root.deletingLastPathComponent())
        let url = try XCTUnwrap(URL(string: "tumblegrove://game/escape/outside.txt"))
        XCTAssertNil(BundledResources.fileURL(for: url, root: root))
        // A dangling link must not become a valid resource if its destination
        // is created later, and a direct file symlink is equally disallowed.
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("dangling"), withDestinationURL: root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString))
        let dangling = try XCTUnwrap(URL(string: "tumblegrove://game/dangling"))
        XCTAssertNil(BundledResources.fileURL(for: dangling, root: root))
        let regular = root.appendingPathComponent("regular.txt")
        try Data("bundled".utf8).write(to: regular)
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("alias.txt"), withDestinationURL: regular)
        let alias = try XCTUnwrap(URL(string: "tumblegrove://game/alias.txt"))
        XCTAssertNil(BundledResources.fileURL(for: alias, root: root))
        let valid = try XCTUnwrap(URL(string: "tumblegrove://game/regular.txt"))
        XCTAssertEqual(BundledResources.fileURL(for: valid, root: root), regular.resolvingSymlinksInPath().standardizedFileURL)
    }

    func testOnlyOrdinaryWebLinksCanLeaveTheApp() throws {
        XCTAssertTrue(BundledResources.isExternalLink(try XCTUnwrap(URL(string: "https://example.com/help"))))
        for value in ["javascript:alert(1)", "file:///etc/passwd", "tel:123", "itms-services://host", "tumblegrove://game/credits.html"] {
            XCTAssertFalse(BundledResources.isExternalLink(try XCTUnwrap(URL(string: value))))
        }
    }
}

@MainActor
private final class NavigationTestWebView: WKWebView {
    var readyChecks: [@MainActor (Any?, Error?) -> Void] = []
    var navigations: [WKNavigation] = []

    override func load(_ request: URLRequest) -> WKNavigation? {
        let navigation = WKNavigation()
        navigations.append(navigation)
        return navigation
    }

    override func evaluateJavaScript(_ javaScriptString: String, completionHandler: (@MainActor (Any?, Error?) -> Void)? = nil) {
        if javaScriptString == "Boolean(document.querySelector('#root canvas'))", let completionHandler {
            readyChecks.append(completionHandler)
        } else {
            completionHandler?(nil, nil)
        }
    }
}
