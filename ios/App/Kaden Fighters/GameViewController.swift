import SpriteKit
import UIKit

final class GameViewController: UIViewController {
    private let logicalLandscapeSize = CGSize(width: 1280, height: 720)
    private let logicalPortraitSize = CGSize(width: 720, height: 1280)
    private weak var gameScene: NativeFightScene?
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var shouldAutorotate: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .all }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .portrait }

    override func loadView() {
        let skView = SKView(frame: .zero)
        skView.backgroundColor = .black
        skView.ignoresSiblingOrder = true
        skView.preferredFramesPerSecond = 60
        view = skView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        UIApplication.shared.isIdleTimerDisabled = true
        lightImpact.prepare()
        mediumImpact.prepare()
        heavyImpact.prepare()

        guard let skView = view as? SKView else { return }
        let scene = NativeFightScene(size: logicalSize(for: view.bounds.size))
        scene.scaleMode = .aspectFill
        scene.haptic = { [weak self] strength in
            switch strength {
            case 2: self?.heavyImpact.impactOccurred(intensity: 1)
            case 1: self?.mediumImpact.impactOccurred(intensity: 0.85)
            default: self?.lightImpact.impactOccurred(intensity: 0.55)
            }
            self?.lightImpact.prepare()
            self?.mediumImpact.prepare()
            self?.heavyImpact.prepare()
        }
        gameScene = scene
        skView.presentScene(scene)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        updateSupportedOrientations()
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        applySceneLayout(for: view.bounds.size)
        updateSupportedOrientations()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        updateSupportedOrientations()
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: nil) { [weak self] _ in
            self?.applySceneLayout(for: size)
            self?.updateSupportedOrientations()
        }
    }

    private func logicalSize(for viewSize: CGSize) -> CGSize {
        viewSize.height > viewSize.width ? logicalPortraitSize : logicalLandscapeSize
    }

    private func applySceneLayout(for viewSize: CGSize) {
        gameScene?.size = logicalSize(for: viewSize)
        gameScene?.refreshLayout()
    }

    private func updateSupportedOrientations() {
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
        } else {
            UIViewController.attemptRotationToDeviceOrientation()
        }
    }

    deinit {
        UIApplication.shared.isIdleTimerDisabled = false
    }
}
