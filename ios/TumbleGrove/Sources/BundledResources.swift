import Foundation
import UniformTypeIdentifiers
import WebKit

enum BundledResources {
    static let scheme = "tumblegrove"
    static let host = "game"
    static let home = URL(string: "tumblegrove://game/index.html")!

    static func relativePath(for url: URL) -> String? {
        guard url.scheme?.lowercased() == scheme, url.host?.lowercased() == host,
              url.user == nil, url.password == nil, url.port == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let decoded = components.percentEncodedPath.removingPercentEncoding,
              !decoded.contains("\\"), !decoded.contains("\0") else { return nil }
        let parts = decoded.split(separator: "/", omittingEmptySubsequences: true)
        guard !parts.contains("."), !parts.contains("..") else { return nil }
        return parts.isEmpty ? "index.html" : parts.joined(separator: "/")
    }

    static func isHome(_ url: URL?) -> Bool {
        guard let url else { return false }
        return relativePath(for: url) == "index.html"
    }

    static func fileURL(for url: URL, root: URL) -> URL? {
        guard let path = relativePath(for: url) else { return nil }
        let safeRoot = root.resolvingSymlinksInPath().standardizedFileURL
        var file = safeRoot
        for component in path.split(separator: "/") {
            file = file.appendingPathComponent(String(component)).standardizedFileURL
            // Whole-path URL resolution may leave a parent symlink unresolved
            // when its final leaf does not exist. Bundled assets never need
            // symlinks, so reject each link before following another component.
            guard (try? FileManager.default.destinationOfSymbolicLink(atPath: file.path)) == nil,
                  file.path.hasPrefix(safeRoot.path + "/") else { return nil }
        }
        return file
    }

    static func isExternalLink(_ url: URL) -> Bool {
        ["https", "http"].contains(url.scheme?.lowercased() ?? "") && url.host != nil
    }

    static func mimeType(for url: URL) -> String {
        // Explicit module MIME types avoid OS-version-dependent UTI mappings.
        switch url.pathExtension.lowercased() {
        case "js", "mjs": return "application/javascript"
        case "css": return "text/css"
        case "html": return "text/html"
        case "json", "webmanifest": return "application/json"
        case "svg": return "image/svg+xml"
        case "txt": return "text/plain"
        default: return UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}

/// Serves only immutable files shipped in the app. Nothing is fetched remotely.
final class BundledSchemeHandler: NSObject, WKURLSchemeHandler {
    let root: URL?

    init(root: URL? = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true)) {
        self.root = root
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, let root,
              let file = BundledResources.fileURL(for: url, root: root),
              ["GET", "HEAD"].contains(urlSchemeTask.request.httpMethod ?? "GET") else {
            urlSchemeTask.didFailWithError(URLError(.unsupportedURL))
            return
        }
        do {
            let data = try Data(contentsOf: file, options: .mappedIfSafe)
            let type = BundledResources.mimeType(for: file)
            let headers = [
                "Content-Type": type + (type.hasPrefix("text/") || type == "application/javascript" ? "; charset=utf-8" : ""),
                "Content-Length": String(data.count),
                // WebKit may serialize a custom scheme's origin as "null".
                // These public, immutable assets contain no credentials.
                "Access-Control-Allow-Origin": "*",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'self' tumblegrove:; script-src 'self' tumblegrove: 'unsafe-inline'; style-src 'self' tumblegrove: 'unsafe-inline'; img-src 'self' tumblegrove: data:; font-src 'self' tumblegrove: data:; connect-src 'self' tumblegrove:; media-src 'self' tumblegrove:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'"
            ]
            guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) else {
                throw URLError(.badServerResponse)
            }
            urlSchemeTask.didReceive(response)
            if urlSchemeTask.request.httpMethod != "HEAD" { urlSchemeTask.didReceive(data) }
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Requests are synchronously completed above, so none remain in flight.
    }
}
