import CoreMotion
import UIKit

enum ScreenGravity {
    /// Core Motion uses the device's portrait axes. UIKit's interface orientation
    /// respects rotation lock, unlike the physical UIDevice orientation.
    static func project(_ gravity: CMAcceleration, orientation: UIInterfaceOrientation) -> (x: Double, y: Double) {
        let vector: (Double, Double)
        switch orientation {
        case .portraitUpsideDown: vector = (-gravity.x, gravity.y)
        case .landscapeLeft: vector = (gravity.y, gravity.x)
        case .landscapeRight: vector = (-gravity.y, -gravity.x)
        default: vector = (gravity.x, -gravity.y)
        }
        return (max(-1, min(1, vector.0)), max(-1, min(1, vector.1)))
    }
}
