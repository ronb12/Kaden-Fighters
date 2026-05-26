import SpriteKit
import UIKit

private struct FighterSpec {
    let name: String
    let style: String
    let sheet: String
    let color: UIColor
    let finisher: String
}

private enum GameMode {
    case title
    case mainMenu
    case info
    case select
    case fight
    case roundOver
}

private enum FighterAction {
    case idle
    case walk
    case punch
    case kick
    case special
    case superMove
    case hit
    case ko
}

private struct MoveSpec {
    let name: String
    let action: FighterAction
    let range: CGFloat
    let damage: CGFloat
    let meterGain: CGFloat
    let meterCost: CGFloat
    let step: CGFloat
    let knockback: CGFloat
    let duration: TimeInterval
    let strength: Int
}

private final class FighterActor {
    let spec: FighterSpec
    let root = SKNode()
    let sprite = SKSpriteNode()
    private let shadow = SKShapeNode(ellipseOf: CGSize(width: 126, height: 24))
    private let guardAura = SKShapeNode(ellipseOf: CGSize(width: 154, height: 250))
    private var textures: [SKTexture] = []
    private(set) var action: FighterAction = .idle
    private var actionTime: TimeInterval = 0
    private var bobTime: TimeInterval = 0
    var health: CGFloat = 100
    var meter: CGFloat = 44
    var facing: CGFloat = 1
    var isPlayer = true
    var attackConsumed = false
    var isBlocking = false
    private(set) var currentMove: MoveSpec?
    var canAct: Bool {
        actionTime <= 0 || action == .idle || action == .walk
    }

    var x: CGFloat {
        get { root.position.x }
        set { root.position.x = newValue }
    }

    init(spec: FighterSpec, isPlayer: Bool) {
        self.spec = spec
        self.isPlayer = isPlayer
        textures = FighterActor.loadTextures(sheetName: spec.sheet)

        shadow.fillColor = SKColor.black.withAlphaComponent(0.42)
        shadow.strokeColor = .clear
        shadow.zPosition = -1
        root.addChild(shadow)

        guardAura.position = CGPoint(x: 0, y: 135)
        guardAura.fillColor = SKColor.cyan.withAlphaComponent(0.08)
        guardAura.strokeColor = SKColor.cyan.withAlphaComponent(0.62)
        guardAura.lineWidth = 4
        guardAura.zPosition = 2
        guardAura.isHidden = true
        root.addChild(guardAura)

        sprite.texture = textures.first
        sprite.size = CGSize(width: 236, height: 330)
        sprite.anchorPoint = CGPoint(x: 0.5, y: 0.08)
        sprite.zPosition = 3
        sprite.color = spec.color
        sprite.colorBlendFactor = 0.06
        root.addChild(sprite)
        setAction(.idle)
    }

    func reset(position: CGPoint, facing: CGFloat) {
        root.position = position
        self.facing = facing
        health = 100
        meter = 44
        attackConsumed = false
        isBlocking = false
        setAction(.idle)
    }

    func setAction(_ next: FighterAction) {
        if action == next && actionTime > 0 { return }
        currentMove = nil
        action = next
        attackConsumed = false
        switch next {
        case .idle: actionTime = 0
        case .walk: actionTime = 0
        case .punch: actionTime = 0.24
        case .kick: actionTime = 0.34
        case .special: actionTime = 0.48
        case .superMove: actionTime = 0.78
        case .hit: actionTime = 0.24
        case .ko: actionTime = 10
        }
        applyPose()
    }

    func setMove(_ move: MoveSpec) {
        currentMove = move
        action = move.action
        attackConsumed = false
        actionTime = move.duration
        applyPose()
    }

    func update(delta: TimeInterval) {
        bobTime += delta
        if actionTime > 0 {
            actionTime = max(0, actionTime - delta)
            if actionTime == 0 && action != .ko {
                setAction(.idle)
            }
        }
        applyPose()
    }

    private func applyPose() {
        let frame: Int
        switch action {
        case .idle:
            frame = Int(bobTime * 5).isMultiple(of: 2) ? 0 : 1
            sprite.zRotation = sin(bobTime * 5) * 0.015 * facing
            sprite.position = CGPoint(x: 0, y: 0 + sin(bobTime * 4) * 3)
        case .walk:
            frame = Int(bobTime * 12).isMultiple(of: 2) ? 1 : 2
            sprite.zRotation = sin(bobTime * 14) * 0.035 * facing
            sprite.position = CGPoint(x: 0, y: abs(sin(bobTime * 12)) * 5)
        case .punch:
            frame = 5
            sprite.zRotation = -0.055 * facing
            sprite.position = CGPoint(x: 26 * facing, y: -2)
        case .kick:
            frame = 7
            sprite.zRotation = 0.03 * facing
            sprite.position = CGPoint(x: 34 * facing, y: 8)
        case .special:
            frame = 8
            sprite.zRotation = -0.10 * facing
            sprite.position = CGPoint(x: 24 * facing, y: 10)
        case .superMove:
            frame = 9
            sprite.zRotation = sin(bobTime * 28) * 0.13
            sprite.position = CGPoint(x: 26 * facing, y: 22)
        case .hit:
            frame = 1
            sprite.zRotation = 0.11 * -facing
            sprite.position = CGPoint(x: -24 * facing, y: -2)
        case .ko:
            frame = 1
            sprite.zRotation = -1.28 * facing
            sprite.position = CGPoint(x: -34 * facing, y: -34)
        }
        if textures.indices.contains(frame) {
            sprite.texture = textures[frame]
        }
        if isBlocking && (action == .idle || action == .walk) {
            sprite.zRotation = -0.05 * facing
            sprite.position.x -= 12 * facing
        }
        guardAura.isHidden = !(isBlocking && health > 0 && action != .ko)
        guardAura.xScale = 1 + sin(bobTime * 12) * 0.03
        sprite.xScale = facing
    }

    private static func loadTextures(sheetName: String) -> [SKTexture] {
        guard let image = bundleImage(named: sheetName) else {
            return [SKTexture()]
        }
        let base = SKTexture(image: image)
        base.filteringMode = .linear
        let cols = 5
        let rows = 2
        var output: [SKTexture] = []
        for row in 0..<rows {
            for col in 0..<cols {
                let rect = CGRect(
                    x: CGFloat(col) / CGFloat(cols),
                    y: CGFloat(rows - row - 1) / CGFloat(rows),
                    width: 1 / CGFloat(cols),
                    height: 1 / CGFloat(rows)
                )
                let texture = SKTexture(rect: rect, in: base)
                texture.filteringMode = .linear
                output.append(texture)
            }
        }
        return output
    }
}

final class NativeFightScene: SKScene {
    var haptic: ((Int) -> Void)?

    private let roster: [FighterSpec] = [
        FighterSpec(name: "KADEN", style: "TAEKWONDO", sheet: "astra_kaden_chatgpt", color: UIColor(red: 0.94, green: 0.14, blue: 0.12, alpha: 1), finisher: "DRAGON TORNADO BREAK"),
        FighterSpec(name: "RAIJIN", style: "MUAY THAI", sheet: "astra_raijin_chatgpt", color: UIColor(red: 0.18, green: 0.52, blue: 1, alpha: 1), finisher: "THUNDER CLINCH"),
        FighterSpec(name: "HIKARI", style: "WUSHU", sheet: "astra_hikari_chatgpt", color: UIColor(red: 1, green: 0.74, blue: 0.2, alpha: 1), finisher: "GOLDEN LOTUS RUSH"),
        FighterSpec(name: "REN", style: "AIKIDO", sheet: "astra_ren_chatgpt", color: UIColor(red: 0.48, green: 0.9, blue: 0.52, alpha: 1), finisher: "FLOWING COUNTER"),
        FighterSpec(name: "YUKI", style: "JUDO", sheet: "astra_yuki_chatgpt", color: UIColor(red: 0.65, green: 0.82, blue: 1, alpha: 1), finisher: "FROST IPPON"),
        FighterSpec(name: "MARCUS", style: "BOXING", sheet: "astra_marcus_chatgpt", color: UIColor(red: 1, green: 0.5, blue: 0.18, alpha: 1), finisher: "TEN COUNT BREAKER"),
        FighterSpec(name: "AIKO", style: "SHOTOKAN", sheet: "astra_aiko_chatgpt", color: UIColor(red: 1, green: 0.34, blue: 0.55, alpha: 1), finisher: "TIGER KATA FINISH"),
        FighterSpec(name: "LUNA", style: "CAPOEIRA", sheet: "astra_luna_chatgpt", color: UIColor(red: 0.48, green: 0.36, blue: 1, alpha: 1), finisher: "RODA SOL CYCLONE"),
        FighterSpec(name: "DANTE", style: "KRAV MAGA", sheet: "astra_dante_chatgpt", color: UIColor(red: 0.84, green: 0.84, blue: 0.9, alpha: 1), finisher: "SURVIVAL CHECKMATE"),
        FighterSpec(name: "SARI", style: "SILAT", sheet: "astra_sari_chatgpt", color: UIColor(red: 0.21, green: 0.92, blue: 0.78, alpha: 1), finisher: "HARIMAU SHADOW DROP")
    ]

    private var mode: GameMode = .title
    private let mainMenuItems: [(id: String, title: String, detail: String)] = [
        ("story", "STORY", "Follow Kaden through the Rise of Reigen arc"),
        ("versus", "VERSUS", "Local two-fighter arcade match"),
        ("tournament", "TOURNAMENT", "Climb the bracket across rival fighters"),
        ("training", "TRAINING", "Practice movement, spacing, and attacks"),
        ("options", "OPTIONS", "Difficulty, display, and assist settings"),
        ("extras", "EXTRAS", "Unlocks, gallery, and stage art"),
        ("store", "STORE", "Cosmetics and future add-ons"),
        ("ranks", "RANKS", "Leaderboard and run stats"),
        ("fighters", "FIGHTERS", "Roster, styles, and finishers"),
        ("stages", "STAGES", "Eight country arenas"),
        ("controls", "CONTROLS", "Touch, keyboard, and gamepad mapping"),
        ("profile", "NAME", "Player profile for scores")
    ]
    private let stageNames = ["Japan", "Brazil", "Egypt", "Kenya", "France", "Mexico", "China", "USA"]
    private let moveNamesByStyle: [String: [String]] = [
        "TAEKWONDO": ["Front Snap Kick", "Turning Kick", "Side Piercing Kick", "Axe Kick", "Back Kick", "Hook Kick", "Crescent Kick", "Jump Roundhouse", "Spinning Hook", "Tornado Kick", "Double Roundhouse", "Cut Kick", "Push Kick", "Skip Side Kick", "Low Crescent", "High Roundhouse", "Step-In Punch", "Ridgehand Feint", "Knifehand Strike", "Elbow Check", "Knee Chamber", "Flying Side Kick", "Spin Back Kick", "Question-Mark Kick", "Blitz Roundhouse", "Dragon Tornado", "Black Belt Barrage", "Reigen Breaker", "Sky Splitter", "Final Dojang"],
        "MUAY THAI": ["Lead Teep", "Rear Teep", "Low Round Kick", "Body Round Kick", "High Round Kick", "Switch Kick", "Step Knee", "Jump Knee", "Spear Knee", "Clinch Knee", "Horizontal Elbow", "Up Elbow", "Down Elbow", "Spinning Elbow", "Long Guard Jab", "Cross", "Hook", "Overhand", "Body Hook", "Leg Check", "Sweep Kick", "Plum Crush", "Knee Barrage", "Elbow Storm", "Thai March", "Thunder Clinch", "Temple Break", "Eight Limb Rush", "Monsoon Knee", "Rajadamnern Finish"],
        "WUSHU": ["Snap Palm", "Piercing Fist", "Lotus Kick", "Butterfly Kick", "Whirlwind Kick", "Sweep", "Hook Stance Strike", "Crane Palm", "Dragon Palm", "Leopard Fist", "Backfist", "Spinning Lotus", "Jump Crescent", "Cartwheel Kick", "Twin Palms", "Low Sweep", "Rising Kick", "Chain Punch", "Silk Reversal", "Cloud Step", "Needle Kick", "Tiger Claw", "Fan Elbow", "Temple Palm", "Moon Sweep", "Golden Lotus", "Dragon Spiral", "Falling Star", "Jade Rush", "Heaven Gate"],
        "AIKIDO": ["Entering Palm", "Wrist Turn", "Irimi Strike", "Tenkan Sweep", "Breath Throw", "Elbow Pin", "Shoulder Turn", "Center Cut", "Back Step Counter", "Flowing Trip", "Collar Turn", "Joint Redirect", "Palm Deflection", "Balance Break", "Circular Throw", "Sleeve Pull", "Cross Step", "Hip Turn", "Kote Gaeshi", "Atemi Touch", "Floating Step", "Spiral Lock", "Wave Counter", "Soft Elbow", "Mirror Throw", "Flowing Counter", "Circle Break", "Harmony Crush", "Silent Drop", "Centerline End"],
        "JUDO": ["Collar Grip", "Sleeve Pull", "Foot Sweep", "Major Reap", "Minor Reap", "Hip Throw", "Shoulder Throw", "Body Drop", "Inner Reap", "Outer Hook", "Knee Wheel", "Corner Reversal", "Sacrifice Drop", "Grip Break", "Belt Lift", "Rolling Throw", "Snap Down", "Trip Entry", "Harai Sweep", "Uchi Mata", "Seoi Burst", "Ground Pin", "Bridge Turn", "Mat Return", "Balance Crush", "Frost Ippon", "Tatami Slam", "White Belt Trap", "Black Ice Throw", "Champion Drop"],
        "BOXING": ["Jab", "Cross", "Lead Hook", "Rear Hook", "Uppercut", "Body Jab", "Body Cross", "Liver Hook", "Check Hook", "Overhand", "Slip Counter", "Pull Counter", "Step Jab", "Double Jab", "Triple Jab", "Philly Shell Tap", "Gazelle Hook", "Corkscrew Cross", "Shovel Hook", "Rope Cut", "Peekaboo Rush", "Shoulder Roll", "Inside Upper", "Outside Hook", "Ten Count", "Knockout Cross", "Champion Flurry", "Corner Storm", "Bell Ringer", "Final Round"],
        "SHOTOKAN": ["Oi Zuki", "Gyaku Zuki", "Mae Geri", "Yoko Geri", "Mawashi Geri", "Ushiro Geri", "Age Uke", "Gedan Barai", "Shuto Uchi", "Nukite", "Kizami Zuki", "Knee Check", "Axe Kick", "Sweep", "Step Punch", "Reverse Punch", "Front Kick", "Round Kick", "Backfist", "Knifehand", "Tiger Kata", "Kiai Burst", "Dojo Rush", "Black Belt Step", "Kumite Break", "Tiger Kata Finish", "Shotokan Storm", "Mountain Fist", "Sunrise Kick", "Final Kiai"],
        "CAPOEIRA": ["Ginga Step", "Meia Lua", "Queixada", "Armada", "Martelo", "Benção", "Au Batido", "Macaco", "Rabo de Arraia", "Esquiva Counter", "Cocorinha Kick", "Negativa Sweep", "Role Strike", "Vingativa", "Ponteira", "Spinning Heel", "Handstand Kick", "Low Sweep", "Cartwheel Feint", "Roda Kick", "Mandinga Palm", "Double Armada", "Flow Step", "Rhythm Break", "Berimbau Rush", "Roda Sol", "Cyclone Roda", "Samba Storm", "Sun Wheel", "Final Circle"],
        "KRAV MAGA": ["Palm Heel", "Groin Kick", "Hammerfist", "Elbow One", "Elbow Two", "Knee Strike", "Stomp Kick", "Side Kick", "Head Control", "Wrist Release", "Burst Entry", "Low Line Kick", "Shield Crash", "Clinch Escape", "Choke Defense", "Weapon Line", "Rapid Palm", "Inside Defense", "Outside Defense", "Takedown Stop", "Survival Step", "Eye Line Feint", "Body Check", "Ground Escape", "Wall Drive", "Survival Checkmate", "Street Rush", "Defense Storm", "Last Chance", "Finish Threat"],
        "SILAT": ["Tiger Step", "Elbow Spear", "Low Sweep", "Harimau Crawl", "Blade Palm", "Shoulder Crash", "Knee Hook", "Ankle Cut", "Serpent Hand", "Forearm Trap", "Cross Step", "Shadow Elbow", "Drop Sweep", "Reverse Claw", "Inside Trip", "Outside Trip", "Palm Spear", "Low Kick", "Crocodile Roll", "Knifehand Arc", "Tiger Pounce", "Ground Claw", "Hip Cut", "Flowing Trap", "Shadow Drop", "Harimau Shadow", "Jungle Rush", "Moon Claw", "Silent Fang", "Final Pounce"]
    ]
    private var selectedMenuIndex = 0
    private var playModeName = "STORY"
    private var activeInfoID = ""
    private var selectedIndex = 0
    private var rivalIndex = 1
    private var p1: FighterActor!
    private var p2: FighterActor!
    private var lastUpdate: TimeInterval = 0
    private var activeControls = Set<String>()
    private var touchControls = [ObjectIdentifier: String]()
    private let attackButtons: Set<String> = ["punch", "kick", "special", "super"]
    private var queuedAttack: String?
    private var buttonNodes = [String: SKShapeNode]()
    private let titlePulseActionKey = "titlePulse"
    private let titlePlateGlowActionKey = "titlePlateGlow"
    private let hud = SKNode()
    private let world = SKNode()
    private let backgroundNode = SKSpriteNode()
    private let gradeOverlay = SKShapeNode()
    private let vignetteOverlay = SKShapeNode()
    private let floorGlow = SKShapeNode()
    private let menu = SKNode()
    private let controls = SKNode()
    private let autoMenuActionKey = "autoMenuFromSplash"
    private let titlePlate = SKShapeNode(rectOf: CGSize(width: 760, height: 178), cornerRadius: 10)
    private let menuPanel = SKShapeNode(rectOf: CGSize(width: 900, height: 392), cornerRadius: 10)
    private let titleLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
    private let subtitleLabel = SKLabelNode(fontNamed: "AvenirNext-Bold")
    private let japaneseTitleLabel = SKLabelNode(fontNamed: "HiraginoSans-W6")
    private let messageLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
    private let p1BarBack = SKShapeNode(rectOf: CGSize(width: 440, height: 30), cornerRadius: 7)
    private let p2BarBack = SKShapeNode(rectOf: CGSize(width: 440, height: 30), cornerRadius: 7)
    private let p1Bar = SKShapeNode(rectOf: CGSize(width: 430, height: 24), cornerRadius: 5)
    private let p2Bar = SKShapeNode(rectOf: CGSize(width: 430, height: 24), cornerRadius: 5)
    private let p1Meter = SKShapeNode(rectOf: CGSize(width: 270, height: 10), cornerRadius: 4)
    private let p2Meter = SKShapeNode(rectOf: CGSize(width: 270, height: 10), cornerRadius: 4)
    private let p1NameLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
    private let p2NameLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
    private let timerLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
    private let comboLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
    private var roundOverTimer: TimeInterval = 0
    private var cameraZoom: CGFloat = 1
    private var cameraX: CGFloat = 640
    private var shakeTime: TimeInterval = 0
    private var hitStopTime: TimeInterval = 0
    private var comboCount = 0
    private var comboTimer: TimeInterval = 0
    private var aiCooldown: TimeInterval = 0
    private var roundStartGrace: TimeInterval = 0
    private var healthBarWidth: CGFloat = 430
    private var p1HealthLeftX: CGFloat = 40
    private var p2HealthRightX: CGFloat = 1240
    private let fighterGroundY: CGFloat = 112
    private let minimumFighterSpacing: CGFloat = 286
    private var roundTime: TimeInterval = 99

    override func didMove(to view: SKView) {
        backgroundColor = .black
        anchorPoint = .zero
        buildWorld()
        buildHUD()
        buildMenu()
        buildControls()
        showTitle()
        runFightPreviewIfRequested()
        runAutotestIfRequested()
    }

    private func buildWorld() {
        addChild(world)
        world.zPosition = 1

        backgroundNode.name = "stage"
        backgroundNode.position = CGPoint(x: 640, y: 360)
        backgroundNode.zPosition = -10
        world.addChild(backgroundNode)
        setFightBackdrop()

        gradeOverlay.fillColor = SKColor.black.withAlphaComponent(0.30)
        gradeOverlay.strokeColor = .clear
        gradeOverlay.zPosition = -9
        world.addChild(gradeOverlay)

        vignetteOverlay.fillColor = SKColor(red: 0.03, green: 0.02, blue: 0.01, alpha: 0.20)
        vignetteOverlay.strokeColor = .clear
        vignetteOverlay.zPosition = -8
        world.addChild(vignetteOverlay)

        floorGlow.fillColor = SKColor(red: 0.86, green: 0.14, blue: 0.08, alpha: 0.18)
        floorGlow.strokeColor = .clear
        floorGlow.zPosition = -3
        world.addChild(floorGlow)
        layoutWorldBackdrop()
    }

    private func buildHUD() {
        hud.zPosition = 30
        addChild(hud)

        titlePlate.fillColor = SKColor.black.withAlphaComponent(0.42)
        titlePlate.strokeColor = SKColor(red: 1, green: 0.76, blue: 0.18, alpha: 0.48)
        titlePlate.lineWidth = 2
        titlePlate.zPosition = 55
        addChild(titlePlate)

        titleLabel.fontSize = 72
        titleLabel.fontColor = SKColor(red: 1, green: 0.86, blue: 0.34, alpha: 1)
        titleLabel.position = CGPoint(x: 640, y: 490)
        titleLabel.zPosition = 60
        addChild(titleLabel)

        subtitleLabel.fontSize = 24
        subtitleLabel.fontColor = .white
        subtitleLabel.position = CGPoint(x: 640, y: 445)
        subtitleLabel.zPosition = 60
        addChild(subtitleLabel)

        japaneseTitleLabel.fontSize = 21
        japaneseTitleLabel.fontColor = SKColor(red: 1, green: 0.80, blue: 0.28, alpha: 0.95)
        japaneseTitleLabel.position = CGPoint(x: 640, y: 418)
        japaneseTitleLabel.zPosition = 60
        japaneseTitleLabel.isHidden = true
        addChild(japaneseTitleLabel)

        messageLabel.fontSize = 42
        messageLabel.fontColor = SKColor(red: 1, green: 0.19, blue: 0.13, alpha: 1)
        messageLabel.position = CGPoint(x: 640, y: 360)
        messageLabel.zPosition = 61
        addChild(messageLabel)

        styleBarBack(p1BarBack)
        p1BarBack.position = CGPoint(x: 255, y: 668)
        hud.addChild(p1BarBack)
        p1Bar.position = p1BarBack.position
        p1Bar.fillColor = SKColor(red: 0.94, green: 0.12, blue: 0.1, alpha: 1)
        p1Bar.strokeColor = .clear
        hud.addChild(p1Bar)

        styleBarBack(p2BarBack)
        p2BarBack.position = CGPoint(x: 1025, y: 668)
        hud.addChild(p2BarBack)
        p2Bar.position = p2BarBack.position
        p2Bar.fillColor = SKColor(red: 0.2, green: 0.52, blue: 1, alpha: 1)
        p2Bar.strokeColor = .clear
        hud.addChild(p2Bar)

        p1Meter.position = CGPoint(x: 175, y: 635)
        p2Meter.position = CGPoint(x: 1105, y: 635)
        p1Meter.fillColor = SKColor(red: 1, green: 0.8, blue: 0.18, alpha: 1)
        p2Meter.fillColor = SKColor(red: 1, green: 0.8, blue: 0.18, alpha: 1)
        p1Meter.strokeColor = .clear
        p2Meter.strokeColor = .clear
        hud.addChild(p1Meter)
        hud.addChild(p2Meter)

        p1NameLabel.fontSize = 19
        p1NameLabel.fontColor = .white
        p1NameLabel.horizontalAlignmentMode = .left
        p1NameLabel.position = CGPoint(x: 40, y: 690)
        hud.addChild(p1NameLabel)

        p2NameLabel.fontSize = 19
        p2NameLabel.fontColor = .white
        p2NameLabel.horizontalAlignmentMode = .right
        p2NameLabel.position = CGPoint(x: 1240, y: 690)
        hud.addChild(p2NameLabel)

        timerLabel.fontSize = 38
        timerLabel.fontColor = SKColor(red: 1, green: 0.84, blue: 0.28, alpha: 1)
        timerLabel.horizontalAlignmentMode = .center
        timerLabel.position = CGPoint(x: 640, y: 650)
        hud.addChild(timerLabel)

        comboLabel.fontSize = 30
        comboLabel.fontColor = SKColor(red: 1, green: 0.82, blue: 0.22, alpha: 1)
        comboLabel.horizontalAlignmentMode = .left
        comboLabel.position = CGPoint(x: 66, y: 575)
        comboLabel.alpha = 0
        hud.addChild(comboLabel)
    }

    private func buildMenu() {
        menu.zPosition = 62
        addChild(menu)
        menuPanel.fillColor = SKColor.black.withAlphaComponent(0.42)
        menuPanel.strokeColor = SKColor.white.withAlphaComponent(0.18)
        menuPanel.lineWidth = 1.5
    }

    private func buildControls() {
        controls.zPosition = 80
        addChild(controls)
        makeButton("left", text: "<", at: CGPoint(x: 150, y: 98), size: CGSize(width: 86, height: 82))
        makeButton("right", text: ">", at: CGPoint(x: 250, y: 98), size: CGSize(width: 86, height: 82))
        makeButton("jump", text: "JUMP", at: CGPoint(x: 200, y: 178), size: CGSize(width: 108, height: 66))
        makeButton("punch", text: "PUNCH", at: CGPoint(x: 942, y: 106), size: CGSize(width: 118, height: 82), color: .red)
        makeButton("kick", text: "KICK", at: CGPoint(x: 1034, y: 164), size: CGSize(width: 108, height: 82), color: .blue)
        makeButton("special", text: "POWER", at: CGPoint(x: 1122, y: 106), size: CGSize(width: 118, height: 82), color: .purple)
        makeButton("super", text: "SUPER", at: CGPoint(x: 1034, y: 56), size: CGSize(width: 116, height: 66), color: .yellow)
        makeButton("block", text: "BLOCK", at: CGPoint(x: 850, y: 56), size: CGSize(width: 118, height: 66), color: .cyan)
        makeButton("start", text: "FIGHT", at: CGPoint(x: 640, y: 90), size: CGSize(width: 160, height: 58), color: .orange)
        configureControls()
    }

    private func makeButton(_ name: String, text: String, at position: CGPoint, size: CGSize, color: UIColor = .white) {
        let node = SKShapeNode(rectOf: size, cornerRadius: 16)
        node.name = name
        node.position = position
        node.fillColor = color.withAlphaComponent(0.18)
        node.strokeColor = color.withAlphaComponent(0.76)
        node.lineWidth = 2.5
        let label = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        label.text = text
        label.fontSize = buttonFontSize(for: text, name: name)
        label.fontColor = color.withAlphaComponent(0.95)
        label.verticalAlignmentMode = .center
        label.position = .zero
        node.addChild(label)
        controls.addChild(node)
        buttonNodes[name] = node
    }

    private func buttonFontSize(for text: String, name: String) -> CGFloat {
        if name == "start" { return 22 }
        switch text.count {
        case 0...1: return 32
        case 2...3: return 25
        case 4: return 21
        default: return 18
        }
    }

    private func configureControls() {
        let visible: Set<String>
        switch mode {
        case .title:
            visible = ["start"]
            setButtonText("start", "MENU")
        case .mainMenu:
            visible = []
            setButtonText("start", "OPEN")
        case .info:
            visible = isPlayableFeature(activeInfoID) ? ["left", "right", "start"] : ["left", "right"]
            setButtonText("start", isPlayableFeature(activeInfoID) ? "START" : "BACK")
        case .select:
            visible = ["left", "right", "start"]
            setButtonText("start", "FIGHT")
        case .fight:
            visible = ["left", "right", "jump", "punch", "kick", "special", "block"]
            setButtonText("jump", "JUMP")
            setButtonText("punch", "PUNCH")
            setButtonText("kick", "KICK")
            setButtonText("special", "POWER")
            setButtonText("block", "BLOCK")
        case .roundOver:
            visible = ["start"]
            setButtonText("start", "MENU")
        }
        for (name, node) in buttonNodes {
            node.isHidden = !visible.contains(name)
        }
        layoutControls()
    }

    func refreshLayout() {
        layoutWorldBackdrop()
        layoutScreenChrome()
        layoutHUD()
        layoutControls()
        if mode == .mainMenu {
            updateMainMenuText()
        }
    }

    private func visibleSceneRect() -> CGRect {
        guard let view else { return CGRect(origin: .zero, size: size) }
        let viewSize = view.bounds.size
        guard viewSize.width > 0 && viewSize.height > 0 && size.width > 0 && size.height > 0 else {
            return CGRect(origin: .zero, size: size)
        }
        let scale = max(viewSize.width / size.width, viewSize.height / size.height)
        let visibleWidth = viewSize.width / scale
        let visibleHeight = viewSize.height / scale
        return CGRect(
            x: (size.width - visibleWidth) * 0.5,
            y: (size.height - visibleHeight) * 0.5,
            width: visibleWidth,
            height: visibleHeight
        )
    }

    private func layoutScreenChrome() {
        let rect = visibleSceneRect()
        let portrait = rect.width < 760
        let centerX = rect.midX
        switch mode {
        case .title:
            titleLabel.fontSize = portrait ? 42 : 72
            subtitleLabel.fontSize = portrait ? 22 : 31
            japaneseTitleLabel.fontSize = portrait ? 15 : 21
            messageLabel.fontSize = portrait ? 29 : 40
            titleLabel.position = CGPoint(x: centerX, y: portrait ? rect.midY + 128 : 512)
            subtitleLabel.position = CGPoint(x: centerX, y: portrait ? rect.midY + 88 : 462)
            japaneseTitleLabel.position = CGPoint(x: centerX, y: portrait ? rect.midY + 56 : 426)
            messageLabel.position = CGPoint(x: centerX, y: portrait ? rect.midY + 6 : 360)
        case .mainMenu:
            titleLabel.fontSize = portrait ? 37 : 58
            subtitleLabel.fontSize = portrait ? 20 : 26
            japaneseTitleLabel.fontSize = portrait ? 14 : 19
            messageLabel.fontSize = portrait ? 24 : 29
            titleLabel.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 102 : 604)
            subtitleLabel.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 136 : 558)
            japaneseTitleLabel.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 164 : 528)
            messageLabel.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 202 : 486)
        case .info:
            japaneseTitleLabel.isHidden = true
            titleLabel.fontSize = portrait ? 42 : 58
            messageLabel.fontSize = portrait ? 26 : 34
            titlePlate.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 154 : 520)
            titlePlate.xScale = portrait ? min(0.64, rect.width / 860) : 0.86
            titlePlate.yScale = portrait ? 0.54 : 0.58
            titleLabel.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 112 : 550)
            subtitleLabel.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 150 : 506)
            messageLabel.position = CGPoint(x: centerX, y: portrait ? rect.maxY - 198 : 452)
        case .select:
            japaneseTitleLabel.isHidden = true
            titleLabel.fontSize = portrait ? 54 : 72
            messageLabel.fontSize = portrait ? 26 : 42
            titlePlate.position = CGPoint(x: centerX, y: portrait ? rect.midY + 60 : 425)
            titlePlate.xScale = portrait ? min(0.66, rect.width / 830) : 1
            titlePlate.yScale = portrait ? 0.76 : 1
            titleLabel.position = CGPoint(x: centerX, y: portrait ? rect.midY + 112 : 490)
            subtitleLabel.position = CGPoint(x: centerX, y: portrait ? rect.midY + 70 : 445)
            messageLabel.position = CGPoint(x: centerX, y: portrait ? rect.midY + 18 : 360)
        case .fight:
            japaneseTitleLabel.isHidden = true
            messageLabel.position = CGPoint(x: centerX, y: rect.midY)
        case .roundOver:
            japaneseTitleLabel.isHidden = true
            messageLabel.position = CGPoint(x: centerX, y: rect.midY)
        }
    }

    private func layoutHUD() {
        let rect = visibleSceneRect()
        let portrait = rect.width < 760
        healthBarWidth = portrait ? max(180, min(238, (rect.width - 82) * 0.5)) : 430
        p1HealthLeftX = rect.minX + (portrait ? 24 : 40)
        p2HealthRightX = rect.maxX - (portrait ? 24 : 40)
        let barY = rect.maxY - (portrait ? 50 : 52)
        let meterY = barY - (portrait ? 26 : 33)

        p1BarBack.position = CGPoint(x: p1HealthLeftX + healthBarWidth * 0.5, y: barY)
        p2BarBack.position = CGPoint(x: p2HealthRightX - healthBarWidth * 0.5, y: barY)
        p1BarBack.xScale = (healthBarWidth + 10) / 440
        p2BarBack.xScale = (healthBarWidth + 10) / 440

        p1NameLabel.fontSize = portrait ? 15 : 19
        p2NameLabel.fontSize = portrait ? 15 : 19
        p1NameLabel.position = CGPoint(x: p1HealthLeftX, y: barY + 20)
        p2NameLabel.position = CGPoint(x: p2HealthRightX, y: barY + 20)
        p1Meter.position = CGPoint(x: p1HealthLeftX + min(135, healthBarWidth * 0.5), y: meterY)
        p2Meter.position = CGPoint(x: p2HealthRightX - min(135, healthBarWidth * 0.5), y: meterY)
        let p1MeterFill = max(0.02, (p1?.meter ?? 44) / 100)
        let p2MeterFill = max(0.02, (p2?.meter ?? 44) / 100)
        p1Meter.xScale = min(1, healthBarWidth / 270) * p1MeterFill
        p2Meter.xScale = min(1, healthBarWidth / 270) * p2MeterFill
        timerLabel.fontSize = portrait ? 30 : 38
        timerLabel.position = CGPoint(x: rect.midX, y: barY - 8)
        comboLabel.position = CGPoint(x: p1HealthLeftX, y: barY - 90)
    }

    private func layoutControls() {
        let rect = visibleSceneRect()
        let portrait = rect.width < 760
        let bottom = rect.minY + (portrait ? 96 : 56)
        if portrait {
            if mode == .info {
                let infoY = rect.minY + 38
                buttonNodes["left"]?.position = CGPoint(x: rect.minX + 70, y: infoY)
                buttonNodes["right"]?.position = CGPoint(x: rect.minX + 150, y: infoY)
                buttonNodes["start"]?.position = CGPoint(x: rect.midX, y: infoY)
            } else {
                buttonNodes["left"]?.position = CGPoint(x: rect.minX + 64, y: bottom + 18)
                buttonNodes["right"]?.position = CGPoint(x: rect.minX + 148, y: bottom + 18)
                buttonNodes["jump"]?.position = CGPoint(x: rect.minX + 106, y: bottom + 92)
                buttonNodes["block"]?.position = CGPoint(x: rect.midX, y: bottom - 4)
                buttonNodes["punch"]?.position = CGPoint(x: rect.maxX - 72, y: bottom + 126)
                buttonNodes["kick"]?.position = CGPoint(x: rect.maxX - 72, y: bottom + 58)
                buttonNodes["special"]?.position = CGPoint(x: rect.maxX - 72, y: bottom - 10)
                buttonNodes["super"]?.position = CGPoint(x: rect.maxX - 190, y: bottom - 10)
                buttonNodes["start"]?.position = CGPoint(x: rect.midX, y: rect.minY + 96)
            }
        } else {
            let lowY = rect.minY + 86
            let midY = rect.minY + 156
            let highY = rect.minY + 226
            buttonNodes["left"]?.position = CGPoint(x: rect.minX + 92, y: midY)
            buttonNodes["right"]?.position = CGPoint(x: rect.minX + 194, y: midY)
            buttonNodes["jump"]?.position = CGPoint(x: rect.minX + 143, y: highY)
            buttonNodes["punch"]?.position = CGPoint(x: rect.maxX - 82, y: highY)
            buttonNodes["kick"]?.position = CGPoint(x: rect.maxX - 82, y: midY)
            buttonNodes["special"]?.position = CGPoint(x: rect.maxX - 82, y: lowY)
            buttonNodes["super"]?.position = CGPoint(x: rect.maxX - 220, y: lowY)
            buttonNodes["block"]?.position = CGPoint(x: rect.midX, y: lowY)
            buttonNodes["start"]?.position = CGPoint(x: rect.midX, y: lowY)
        }
    }

    private func setButtonText(_ name: String, _ text: String) {
        guard let label = buttonNodes[name]?.children.compactMap({ $0 as? SKLabelNode }).first else { return }
        label.text = text
        label.fontSize = buttonFontSize(for: text, name: name)
    }

    private func startTitleAnimation() {
        titleLabel.removeAction(forKey: titlePulseActionKey)
        titlePlate.removeAction(forKey: titlePlateGlowActionKey)
        titleLabel.setScale(0.98)
        titleLabel.run(.repeatForever(.sequence([
            .group([
                .scale(to: 1.035, duration: 0.92),
                .colorize(with: SKColor(red: 1, green: 0.72, blue: 0.18, alpha: 1), colorBlendFactor: 0.22, duration: 0.92)
            ]),
            .group([
                .scale(to: 0.98, duration: 0.92),
                .colorize(withColorBlendFactor: 0.0, duration: 0.92)
            ])
        ])), withKey: titlePulseActionKey)
        guard !titlePlate.isHidden else { return }
        titlePlate.run(.repeatForever(.sequence([
            .customAction(withDuration: 0.82) { node, elapsed in
                guard let shape = node as? SKShapeNode else { return }
                let t = elapsed / 0.82
                shape.strokeColor = SKColor(red: 1, green: 0.78, blue: 0.20, alpha: 0.42 + 0.34 * t)
                shape.lineWidth = 2 + 1.4 * t
            },
            .customAction(withDuration: 0.82) { node, elapsed in
                guard let shape = node as? SKShapeNode else { return }
                let t = elapsed / 0.82
                shape.strokeColor = SKColor(red: 1, green: 0.78, blue: 0.20, alpha: 0.76 - 0.34 * t)
                shape.lineWidth = 3.4 - 1.4 * t
            }
        ])), withKey: titlePlateGlowActionKey)
    }

    private func stopTitleAnimation() {
        titleLabel.removeAction(forKey: titlePulseActionKey)
        titlePlate.removeAction(forKey: titlePlateGlowActionKey)
        titleLabel.setScale(1)
        titlePlate.lineWidth = 2
        titlePlate.strokeColor = SKColor(red: 1, green: 0.76, blue: 0.18, alpha: 0.48)
    }

    private func setKeyArtBackdrop() {
        if let image = bundleImage(named: "kaden-native-keyart") {
            let texture = SKTexture(image: image)
            texture.filteringMode = .linear
            backgroundNode.texture = texture
            layoutWorldBackdrop()
        }
    }

    private func setFightBackdrop() {
        let texture = stageTexture(index: 0)
        backgroundNode.texture = texture
        layoutWorldBackdrop()
    }

    private func layoutWorldBackdrop() {
        let isFightScene = mode == .fight || mode == .roundOver
        let portrait = size.height > size.width
        let backdropTarget = isFightScene ? CGSize(width: portrait ? max(size.width, 720) : 1280, height: portrait ? size.height : 720) : size
        let center = CGPoint(x: isFightScene ? 640 : size.width * 0.5, y: backdropTarget.height * 0.5)
        if let texture = backgroundNode.texture {
            backgroundNode.size = aspectFillSize(texture.size(), in: backdropTarget)
        } else {
            backgroundNode.size = backdropTarget
        }
        backgroundNode.position = center

        let overlaySize = CGSize(width: max(backdropTarget.width, backgroundNode.size.width), height: max(backdropTarget.height, backgroundNode.size.height))
        let rect = CGRect(x: -overlaySize.width * 0.5, y: -overlaySize.height * 0.5, width: overlaySize.width, height: overlaySize.height)
        gradeOverlay.path = CGPath(rect: rect, transform: nil)
        vignetteOverlay.path = CGPath(rect: rect, transform: nil)
        gradeOverlay.position = center
        vignetteOverlay.position = center

        let glowSize = CGSize(width: portrait ? 760 : 1180, height: portrait ? 170 : 120)
        floorGlow.path = CGPath(ellipseIn: CGRect(x: -glowSize.width * 0.5, y: -glowSize.height * 0.5, width: glowSize.width, height: glowSize.height), transform: nil)
        floorGlow.position = CGPoint(x: isFightScene ? 640 : size.width * 0.5, y: portrait ? 286 : 128)
    }

    private func showTitle() {
        removeAction(forKey: autoMenuActionKey)
        mode = .title
        setKeyArtBackdrop()
        activeControls.removeAll()
        touchControls.removeAll()
        queuedAttack = nil
        hud.isHidden = true
        menu.isHidden = true
        controls.isHidden = false
        titlePlate.isHidden = true
        titlePlate.alpha = 0
        titlePlate.removeAllActions()
        titleLabel.isHidden = false
        subtitleLabel.isHidden = false
        japaneseTitleLabel.isHidden = false
        messageLabel.isHidden = false
        titleLabel.fontSize = 72
        messageLabel.fontSize = 42
        titleLabel.position = CGPoint(x: 640, y: 490)
        subtitleLabel.position = CGPoint(x: 640, y: 445)
        japaneseTitleLabel.position = CGPoint(x: 640, y: 418)
        messageLabel.position = CGPoint(x: 640, y: 360)
        titleLabel.text = "KADEN FIGHTERS"
        subtitleLabel.text = "RISE OF REIGEN"
        japaneseTitleLabel.text = "ケイデン・ファイターズ：レイゲンの台頭"
        messageLabel.text = "TAP MENU"
        world.removeChildren(in: world.children.filter { $0.name == "fighter" })
        configureControls()
        refreshLayout()
        startTitleAnimation()
        run(.sequence([
            .wait(forDuration: 1.8),
            .run { [weak self] in
                guard let self, self.mode == .title else { return }
                self.showMainMenu()
            }
        ]), withKey: autoMenuActionKey)
    }

    private func showMainMenu() {
        removeAction(forKey: autoMenuActionKey)
        mode = .mainMenu
        setKeyArtBackdrop()
        activeControls.removeAll()
        touchControls.removeAll()
        queuedAttack = nil
        hud.isHidden = true
        menu.isHidden = false
        controls.isHidden = false
        titlePlate.isHidden = true
        titlePlate.alpha = 0
        titlePlate.removeAllActions()
        titleLabel.isHidden = false
        subtitleLabel.isHidden = false
        japaneseTitleLabel.isHidden = false
        messageLabel.isHidden = false
        titleLabel.fontSize = 58
        messageLabel.fontSize = 34
        titleLabel.position = CGPoint(x: 640, y: 586)
        subtitleLabel.position = CGPoint(x: 640, y: 542)
        japaneseTitleLabel.position = CGPoint(x: 640, y: 514)
        messageLabel.position = CGPoint(x: 640, y: 492)
        titleLabel.text = "KADEN FIGHTERS"
        subtitleLabel.text = "RISE OF REIGEN"
        japaneseTitleLabel.text = "ケイデン・ファイターズ：レイゲンの台頭"
        world.position = .zero
        world.setScale(1)
        world.removeChildren(in: world.children.filter { $0.name == "fighter" })
        updateMainMenuText()
        configureControls()
        refreshLayout()
        startTitleAnimation()
    }

    private func updateMainMenuText() {
        layoutScreenChrome()
        let rect = visibleSceneRect()
        let portrait = rect.width < 760
        let item = mainMenuItems[selectedMenuIndex]
        messageLabel.text = item.title
        menu.removeAllChildren()
        let panelHeight: CGFloat = portrait ? min(470, rect.height - 260) : 370
        menuPanel.position = CGPoint(x: rect.midX, y: portrait ? rect.midY - 48 : 230)
        menuPanel.xScale = portrait ? min(0.62, rect.width / 900) : 1.06
        menuPanel.yScale = panelHeight / 392
        menu.addChild(menuPanel)

        let detail = SKLabelNode(fontNamed: "AvenirNext-DemiBold")
        detail.text = item.detail
        detail.fontSize = portrait ? 14 : 18
        detail.fontColor = .white
        detail.position = CGPoint(x: rect.midX, y: portrait ? rect.maxY - 236 : 416)
        menu.addChild(detail)

        let mode = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        mode.text = "MODE: \(playModeName)"
        mode.fontSize = portrait ? 15 : 18
        mode.fontColor = SKColor(red: 1, green: 0.78, blue: 0.22, alpha: 1)
        mode.position = CGPoint(x: rect.midX, y: portrait ? rect.maxY - 260 : 390)
        menu.addChild(mode)

        let playableIndices = mainMenuItems.indices.filter { isPlayableFeature(mainMenuItems[$0].id) }
        let secondaryIndices = mainMenuItems.indices.filter { !isPlayableFeature(mainMenuItems[$0].id) }
        let primaryColumns = portrait ? 2 : 4
        let primaryWidth = portrait ? max(180, min(228, (rect.width - 54) * 0.5)) : min(226, (rect.width - 118) / 4)
        let primarySize = CGSize(width: primaryWidth, height: portrait ? 62 : 74)
        let primaryGapX: CGFloat = portrait ? primaryWidth + 18 : primaryWidth + 24
        let primaryGapY: CGFloat = portrait ? 72 : 86
        let primaryStartX = rect.midX - CGFloat(primaryColumns - 1) * primaryGapX * 0.5
        let primaryStartY: CGFloat = portrait ? rect.maxY - 318 : 328

        let secondaryColumns = portrait ? 2 : 4
        let secondaryWidth = portrait ? primaryWidth : min(210, (rect.width - 114) / 4)
        let secondarySize = CGSize(width: secondaryWidth, height: portrait ? 42 : 46)
        let secondaryGapX: CGFloat = portrait ? secondaryWidth + 18 : secondaryWidth + 20
        let secondaryGapY: CGFloat = portrait ? 50 : 55
        let secondaryStartX = rect.midX - CGFloat(secondaryColumns - 1) * secondaryGapX * 0.5
        let secondaryStartY = primaryStartY - CGFloat((playableIndices.count - 1) / primaryColumns + 1) * primaryGapY - (portrait ? 18 : 16)

        let section = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        section.text = "ARCADE"
        section.fontSize = portrait ? 13 : 15
        section.fontColor = SKColor(red: 1, green: 0.80, blue: 0.26, alpha: 0.92)
        section.horizontalAlignmentMode = .left
        section.position = CGPoint(x: primaryStartX - primaryWidth * 0.5, y: primaryStartY + primarySize.height * 0.5 + 16)
        menu.addChild(section)

        let featureSection = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        featureSection.text = "FEATURES"
        featureSection.fontSize = portrait ? 13 : 15
        featureSection.fontColor = SKColor.white.withAlphaComponent(0.72)
        featureSection.horizontalAlignmentMode = .left
        featureSection.position = CGPoint(x: secondaryStartX - secondaryWidth * 0.5, y: secondaryStartY + secondarySize.height * 0.5 + 14)
        menu.addChild(featureSection)

        for (index, menuItem) in mainMenuItems.enumerated() {
            let selected = index == selectedMenuIndex
            let playable = isPlayableFeature(menuItem.id)
            let groupIndex = playable ? playableIndices.firstIndex(of: index) ?? 0 : secondaryIndices.firstIndex(of: index) ?? 0
            let columns = playable ? primaryColumns : secondaryColumns
            let size = playable ? primarySize : secondarySize
            let gapX = playable ? primaryGapX : secondaryGapX
            let gapY = playable ? primaryGapY : secondaryGapY
            let startX = playable ? primaryStartX : secondaryStartX
            let startY = playable ? primaryStartY : secondaryStartY
            let column = groupIndex % columns
            let row = groupIndex / columns
            let tile = SKShapeNode(rectOf: size, cornerRadius: 8)
            tile.name = "menu:\(index)"
            tile.position = CGPoint(x: startX + CGFloat(column) * gapX, y: startY - CGFloat(row) * gapY)
            tile.fillColor = selected ? SKColor(red: 1, green: 0.22, blue: 0.10, alpha: playable ? 0.58 : 0.42) : SKColor.black.withAlphaComponent(playable ? 0.68 : 0.48)
            tile.strokeColor = selected ? SKColor(red: 1, green: 0.82, blue: 0.26, alpha: 1) : SKColor.white.withAlphaComponent(0.34)
            tile.lineWidth = selected ? 3 : 1.5
            tile.zPosition = 1
            menu.addChild(tile)

            let label = SKLabelNode(fontNamed: "AvenirNext-Heavy")
            label.name = "menu:\(index)"
            label.text = menuItem.title
            label.fontSize = playable ? (portrait ? 16 : 18) : (portrait ? 13 : 15)
            label.fontColor = selected ? SKColor(red: 1, green: 0.86, blue: 0.3, alpha: 1) : .white
            label.verticalAlignmentMode = .center
            label.position = .zero
            tile.addChild(label)
        }
    }

    private func showInfo(_ id: String) {
        removeAction(forKey: autoMenuActionKey)
        mode = .info
        setKeyArtBackdrop()
        stopTitleAnimation()
        activeInfoID = id
        activeControls.removeAll()
        touchControls.removeAll()
        queuedAttack = nil
        hud.isHidden = true
        menu.isHidden = false
        controls.isHidden = false
        titlePlate.isHidden = false
        titlePlate.alpha = 0
        titlePlate.position = CGPoint(x: 640, y: 520)
        titlePlate.xScale = 0.86
        titlePlate.yScale = 0.58
        titleLabel.isHidden = false
        subtitleLabel.isHidden = false
        japaneseTitleLabel.isHidden = true
        messageLabel.isHidden = false
        titleLabel.fontSize = 58
        messageLabel.fontSize = 34
        titleLabel.position = CGPoint(x: 640, y: 550)
        subtitleLabel.position = CGPoint(x: 640, y: 506)
        messageLabel.position = CGPoint(x: 640, y: 452)
        titleLabel.text = infoTitle(for: id)
        subtitleLabel.text = isPlayableFeature(id) ? "GAME MODE PAGE" : "IOS NATIVE FEATURE PAGE"
        messageLabel.text = isPlayableFeature(id) ? "START MODE" : "TAP BACK FOR MENU"
        menu.removeAllChildren()
        layoutScreenChrome()
        let rect = visibleSceneRect()
        let portrait = rect.width < 760
        let lines = infoLines(for: id)
        let lineGap: CGFloat = portrait ? (lines.count > 7 ? 25 : 30) : 34
        let startY: CGFloat = portrait ? min(rect.maxY - 250, rect.midY + CGFloat(lines.count) * lineGap * 0.5) : 320
        for (index, line) in infoLines(for: id).enumerated() {
            let label = SKLabelNode(fontNamed: index == 0 ? "AvenirNext-Heavy" : "AvenirNext-DemiBold")
            label.text = line
            label.fontSize = index == 0 ? (portrait ? 20 : 24) : (portrait ? 15 : 19)
            label.fontColor = index == 0 ? SKColor(red: 1, green: 0.78, blue: 0.22, alpha: 1) : .white
            label.position = CGPoint(x: rect.midX, y: startY - CGFloat(index) * lineGap)
            menu.addChild(label)
        }
        configureControls()
        refreshLayout()
    }

    private func infoTitle(for id: String) -> String {
        switch id {
        case "story": return "STORY"
        case "versus": return "VERSUS"
        case "tournament": return "TOURNAMENT"
        case "training": return "TRAINING"
        case "options": return "OPTIONS"
        case "extras": return "EXTRAS"
        case "store": return "STORE"
        case "ranks": return "RANKS"
        case "fighters": return "FIGHTERS"
        case "stages": return "STAGES"
        case "controls": return "CONTROLS"
        case "profile": return "PLAYER NAME"
        default: return "FEATURE"
        }
    }

    private func infoLines(for id: String) -> [String] {
        switch id {
        case "story":
            return ["Rise of Reigen", "Follow Kaden through rival battles", "Win matches to advance the story", "Start opens fighter select"]
        case "versus":
            return ["Local Versus", "Pick a fighter and battle a rival", "Designed for quick arcade matches", "Start opens fighter select"]
        case "tournament":
            return ["World Tournament", "Climb the bracket across rival fighters", "Rotates through country arenas", "Start opens fighter select"]
        case "training":
            return ["Training Mode", "Practice movement, spacing, and attacks", "AI pressure is tuned for learning", "Start opens fighter select"]
        case "options":
            return ["Difficulty: balanced arcade", "Display: native Swift full-screen", "Haptics: light, medium, heavy", "AI: opening grace plus tuned rival pressure"]
        case "extras":
            return ["Gallery: all fighter sheets loaded", "Unlocks: webgame cosmetics are listed here", "Stage art: country arena preview support"]
        case "store":
            return ["Cosmetics store placeholder", "No purchases are active in the native build", "Ready for skins, colors, and future packs"]
        case "ranks":
            return ["Leaderboard screen placeholder", "Webgame ranks include wins, KOs, combos, score", "Native run stats can be wired here next"]
        case "fighters":
            return roster.map { "\($0.name): \($0.style) - \($0.finisher)" }
        case "stages":
            return ["World Circuit"] + stageNames.enumerated().map { "Round \($0.offset + 1): \($0.element)" }
        case "controls":
            return ["Move: < and >", "Jump: ^", "Block: BLK", "Punch: P", "Kick: K", "Special: EX", "Super: CA at full meter"]
        case "profile":
            return ["Player name: KADEN", "Used by the web leaderboard", "Native profile editing can be added next"]
        default:
            return ["Feature available from the webgame menu"]
        }
    }

    private func isPlayableFeature(_ id: String) -> Bool {
        id == "story" || id == "versus" || id == "tournament" || id == "training"
    }

    private func showSelect() {
        removeAction(forKey: autoMenuActionKey)
        mode = .select
        setKeyArtBackdrop()
        stopTitleAnimation()
        activeControls.removeAll()
        touchControls.removeAll()
        queuedAttack = nil
        hitStopTime = 0
        shakeTime = 0
        comboCount = 0
        comboTimer = 0
        comboLabel.alpha = 0
        world.position = .zero
        world.setScale(1)
        world.removeChildren(in: world.children.filter { $0.name == "fighter" })
        hud.isHidden = true
        menu.isHidden = true
        titlePlate.isHidden = false
        titlePlate.alpha = 1
        titlePlate.position = CGPoint(x: 640, y: 425)
        titlePlate.xScale = 1
        titlePlate.yScale = 1
        titleLabel.isHidden = false
        subtitleLabel.isHidden = false
        japaneseTitleLabel.isHidden = true
        messageLabel.isHidden = false
        titleLabel.fontSize = 72
        messageLabel.fontSize = 42
        titleLabel.position = CGPoint(x: size.width * 0.5, y: size.height > size.width ? size.height - 300 : 490)
        subtitleLabel.position = CGPoint(x: size.width * 0.5, y: size.height > size.width ? size.height - 356 : 445)
        messageLabel.position = CGPoint(x: size.width * 0.5, y: size.height > size.width ? size.height - 424 : 360)
        updateSelectText()
        configureControls()
        refreshLayout()
    }

    private func updateSelectText() {
        let fighter = roster[selectedIndex]
        let rival = roster[rivalIndex]
        titleLabel.text = fighter.name
        subtitleLabel.text = "\(fighter.style)  VS  \(rival.name)"
        messageLabel.text = "CHOOSE FIGHTER"
    }

    private func startFight() {
        removeAction(forKey: autoMenuActionKey)
        mode = .fight
        setFightBackdrop()
        menu.isHidden = true
        titlePlate.isHidden = true
        titleLabel.isHidden = true
        subtitleLabel.isHidden = true
        japaneseTitleLabel.isHidden = true
        messageLabel.isHidden = false
        messageLabel.fontSize = 42
        messageLabel.position = CGPoint(x: 640, y: 360)
        messageLabel.text = "FIGHT!"
        messageLabel.run(.sequence([.wait(forDuration: 1.0), .fadeOut(withDuration: 0.25)]))
        hud.isHidden = false
        activeControls.removeAll()
        touchControls.removeAll()
        queuedAttack = nil
        comboCount = 0
        comboTimer = 0
        comboLabel.alpha = 0
        cameraZoom = 1
        cameraX = 640
        roundTime = 99
        roundStartGrace = 1.6
        aiCooldown = 1.2
        world.position = CGPoint(x: 0, y: size.height > size.width ? 170 : 0)
        world.setScale(1)
        world.removeChildren(in: world.children.filter { $0.name == "fighter" })

        p1 = FighterActor(spec: roster[selectedIndex], isPlayer: true)
        p2 = FighterActor(spec: roster[rivalIndex], isPlayer: false)
        p1.root.name = "fighter"
        p2.root.name = "fighter"
        p1.reset(position: CGPoint(x: 390, y: fighterGroundY), facing: 1)
        p2.reset(position: CGPoint(x: 890, y: fighterGroundY), facing: -1)
        world.addChild(p1.root)
        world.addChild(p2.root)
        p1NameLabel.text = p1.spec.name
        p2NameLabel.text = p2.spec.name
        updateBars()
        configureControls()
        refreshLayout()
    }

    override func update(_ currentTime: TimeInterval) {
        let delta = lastUpdate == 0 || currentTime <= lastUpdate ? 1.0 / 60.0 : min(1.0 / 30.0, currentTime - lastUpdate)
        lastUpdate = currentTime
        guard mode == .fight || mode == .roundOver else { return }
        if hitStopTime > 0 {
            hitStopTime = max(0, hitStopTime - delta)
            if mode == .fight && (p1.health <= 0 || p2.health <= 0) {
                finishRound()
            }
            return
        }
        if shakeTime > 0 { shakeTime = max(0, shakeTime - delta) }
        if comboTimer > 0 {
            comboTimer = max(0, comboTimer - delta)
            if comboTimer == 0 {
                comboCount = 0
                comboLabel.run(.fadeOut(withDuration: 0.18))
            }
        }
        p1.update(delta: delta)
        p2.update(delta: delta)
        if mode == .fight {
            roundTime = max(0, roundTime - delta)
            roundStartGrace = max(0, roundStartGrace - delta)
            updatePlayer(delta: delta)
            updateAI(delta: delta)
            resolveAttacks()
            updateCamera()
            updateBars()
            if p1.health <= 0 || p2.health <= 0 {
                finishRound()
            } else if roundTime <= 0 {
                finishRound(winner: p1.health >= p2.health ? p1 : p2)
            }
        } else {
            roundOverTimer -= delta
            if roundOverTimer <= 0 { showSelect() }
        }
    }

    private func updatePlayer(delta: TimeInterval) {
        p1.isBlocking = activeControls.contains("block") && p1.canAct
        var vx: CGFloat = 0
        if !p1.isBlocking {
            if activeControls.contains("left") { vx -= 330 }
            if activeControls.contains("right") { vx += 330 }
        }
        if abs(vx) > 0 && p1.canAct {
            p1.x = clamp(p1.x + vx * CGFloat(delta), 120, 1160)
            maintainFighterSpacing(moving: p1, against: p2)
            if p1.action == .idle || p1.action == .walk { p1.setAction(.walk) }
        } else if p1.action == .walk {
            p1.setAction(.idle)
        }
        if activeControls.contains("jump") && p1.root.action(forKey: "jump") == nil && p1.canAct {
            p1.root.run(.sequence([.moveBy(x: 0, y: 95, duration: 0.16), .moveBy(x: 0, y: -95, duration: 0.22)]), withKey: "jump")
            activeControls.remove("jump")
        }
        p1.facing = p1.x <= p2.x ? 1 : -1
        p2.facing = p2.x <= p1.x ? 1 : -1
        maintainFighterSpacing()
    }

    private func updateAI(delta: TimeInterval) {
        aiCooldown = max(0, aiCooldown - delta)
        guard roundStartGrace == 0 else {
            p2.isBlocking = false
            return
        }
        let distance = abs(p2.x - p1.x)
        p2.isBlocking = distance < 285 && p2.canAct && p1.action != .idle && p1.action != .walk && aiCooldown > 0.62
        if distance > 255 && p2.canAct {
            let direction: CGFloat = p2.x > p1.x ? -1 : 1
            p2.x = clamp(p2.x + direction * 165 * CGFloat(delta), 120, 1160)
            maintainFighterSpacing(moving: p2, against: p1)
            if p2.action == .idle || p2.action == .walk { p2.setAction(.walk) }
        } else if p2.action == .walk {
            p2.setAction(.idle)
        }
        if distance < 270 && p2.canAct && aiCooldown == 0 {
            aiCooldown = Double.random(in: 0.95...1.35)
            if p2.meter >= 100 && Int.random(in: 0...100) < 8 {
                performAttack(actor: p2, defender: p1, button: "super", modifiers: aiModifiers())
            } else if Int.random(in: 0...100) < 18 {
                performAttack(actor: p2, defender: p1, button: "special", modifiers: aiModifiers())
            } else {
                performAttack(actor: p2, defender: p1, button: Int.random(in: 0...1) == 0 ? "punch" : "kick", modifiers: aiModifiers())
            }
            maintainFighterSpacing(moving: p2, against: p1)
        }
    }

    private func resolveAttacks() {
        if let attack = queuedAttack, p1.canAct {
            activeControls.insert(attack)
        }
        if activeControls.contains("punch") && p1.canAct {
            performAttack(actor: p1, defender: p2, button: "punch", modifiers: activeControls)
            activeControls.remove("punch")
            queuedAttack = nil
        }
        if activeControls.contains("kick") && p1.canAct {
            performAttack(actor: p1, defender: p2, button: "kick", modifiers: activeControls)
            activeControls.remove("kick")
            queuedAttack = nil
        }
        if activeControls.contains("special") && p1.canAct {
            performAttack(actor: p1, defender: p2, button: "special", modifiers: activeControls)
            activeControls.remove("special")
            queuedAttack = nil
        }
        if activeControls.contains("super") && p1.meter >= 100 && p1.canAct {
            performAttack(actor: p1, defender: p2, button: "super", modifiers: activeControls)
            activeControls.remove("super")
            queuedAttack = nil
        } else if activeControls.contains("super") && p1.canAct {
            activeControls.remove("super")
            if queuedAttack == "super" { queuedAttack = nil }
        }
        applyHit(attacker: p1, defender: p2)
        applyHit(attacker: p2, defender: p1)
    }

    private func aiModifiers() -> Set<String> {
        var modifiers = Set<String>()
        let roll = Int.random(in: 0...5)
        if roll == 0 { modifiers.insert("left") }
        if roll == 1 { modifiers.insert("right") }
        if roll == 2 { modifiers.insert("jump") }
        if roll == 3 { modifiers.insert("block") }
        return modifiers
    }

    private func performAttack(actor: FighterActor, defender: FighterActor, button: String, modifiers: Set<String>) {
        let move = moveSpec(for: actor.spec, button: button, modifiers: modifiers, seed: comboCount)
        guard actor.meter >= move.meterCost else { return }
        actor.meter = max(0, actor.meter - move.meterCost)
        actor.setMove(move)
        actor.x = clamp(actor.x + actor.facing * move.step, 120, 1160)
        maintainFighterSpacing(moving: actor, against: defender)
    }

    private func moveBook(for spec: FighterSpec) -> [MoveSpec] {
        let names = moveNamesByStyle[spec.style] ?? moveNamesByStyle["TAEKWONDO"] ?? []
        return names.enumerated().map { index, name in
            let action: FighterAction
            switch index {
            case 0..<8: action = .punch
            case 8..<16: action = .kick
            case 16..<24: action = .special
            default: action = .superMove
            }
            let tier = CGFloat(index % 6)
            let superTier = max(0, CGFloat(index - 23))
            let range: CGFloat
            let damage: CGFloat
            let meterGain: CGFloat
            let meterCost: CGFloat
            let step: CGFloat
            let knockback: CGFloat
            let duration: TimeInterval
            let strength: Int
            switch action {
            case .punch:
                range = 316 + tier * 8
                damage = 5.8 + tier * 0.6
                meterGain = 8 + tier * 0.5
                meterCost = 0
                step = 5 + tier
                knockback = 24 + tier * 2
                duration = 0.20 + Double(tier) * 0.012
                strength = 1
            case .kick:
                range = 316 + tier * 9
                damage = 8.3 + tier * 0.75
                meterGain = 9 + tier * 0.5
                meterCost = 0
                step = 8 + tier * 1.2
                knockback = 30 + tier * 2.4
                duration = 0.29 + Double(tier) * 0.015
                strength = 1
            case .special:
                range = 344 + tier * 10
                damage = 12.4 + tier
                meterGain = 11 + tier * 0.7
                meterCost = 12 + tier
                step = 12 + tier * 1.4
                knockback = 42 + tier * 2.8
                duration = 0.42 + Double(tier) * 0.018
                strength = 2
            case .superMove:
                range = 386 + superTier * 6
                damage = 22 + superTier * 1.2
                meterGain = 0
                meterCost = 100
                step = 17 + superTier
                knockback = 58 + superTier * 2.5
                duration = 0.70 + Double(superTier) * 0.018
                strength = 2
            default:
                range = 300
                damage = 7
                meterGain = 8
                meterCost = 0
                step = 6
                knockback = 28
                duration = 0.24
                strength = 1
            }
            return MoveSpec(name: name, action: action, range: range, damage: damage, meterGain: meterGain, meterCost: meterCost, step: step, knockback: knockback, duration: duration, strength: strength)
        }
    }

    private func moveSpec(for spec: FighterSpec, button: String, modifiers: Set<String>, seed: Int) -> MoveSpec {
        let book = moveBook(for: spec)
        guard !book.isEmpty else {
            return MoveSpec(name: "Strike", action: .punch, range: 310, damage: 7, meterGain: 10, meterCost: 0, step: 6, knockback: 30, duration: 0.24, strength: 1)
        }
        let buttonOffset: Int
        switch button {
        case "punch": buttonOffset = 0
        case "kick": buttonOffset = 8
        case "special": buttonOffset = 16
        case "super": buttonOffset = 24
        default: buttonOffset = 0
        }
        var modifierOffset = 0
        if modifiers.contains("left") { modifierOffset += 1 }
        if modifiers.contains("right") { modifierOffset += 2 }
        if modifiers.contains("jump") { modifierOffset += 3 }
        if modifiers.contains("block") { modifierOffset += 4 }
        if modifiers.contains("left") && modifiers.contains("right") { modifierOffset += 1 }
        if modifiers.contains("jump") && modifiers.contains("block") { modifierOffset += 1 }
        let index = min(book.count - 1, buttonOffset + ((modifierOffset + seed) % 8))
        return book[index]
    }

    private func applyHit(attacker: FighterActor, defender: FighterActor) {
        guard !attacker.attackConsumed else { return }
        let range: CGFloat
        let baseDamage: CGFloat
        let strength: Int
        let knockback: CGFloat
        let meterGain: CGFloat
        if let move = attacker.currentMove {
            range = move.range
            baseDamage = move.damage
            strength = move.strength
            knockback = move.knockback
            meterGain = move.meterGain
        } else {
            switch attacker.action {
            case .punch: range = 310; baseDamage = 7; strength = 1; knockback = 30; meterGain = 10
            case .kick: range = 330; baseDamage = 10; strength = 1; knockback = 34; meterGain = 10
            case .special: range = 360; baseDamage = 15; strength = 2; knockback = 48; meterGain = 12
            case .superMove: range = 400; baseDamage = 27; strength = 2; knockback = 62; meterGain = 0
            default: return
            }
        }
        guard abs(attacker.x - defender.x) <= range else { return }
        attacker.attackConsumed = true
        attacker.meter = min(100, attacker.meter + meterGain)
        let defenderFacesAttacker = (attacker.x - defender.x) * defender.facing > 0
        let blocked = defender.isBlocking && defenderFacesAttacker
        let damageScale: CGFloat = blocked ? 0.26 : 1
        let damage = (attacker.isPlayer ? baseDamage : baseDamage * 0.58) * damageScale
        if blocked {
            defender.meter = min(100, defender.meter + 8)
            spawnGuard(at: CGPoint(x: defender.x - defender.facing * 46, y: 330))
        }
        defender.health = max(0, defender.health - damage)
        if !blocked || defender.health <= 0 {
            defender.setAction(defender.health <= 0 ? .ko : .hit)
        }
        let dir: CGFloat = defender.x > attacker.x ? 1 : -1
        defender.x = clamp(defender.x + dir * (blocked ? 14 : knockback), 120, 1160)
        maintainFighterSpacing()
        spawnImpact(at: CGPoint(x: (attacker.x + defender.x) * 0.5, y: 340), color: blocked ? .cyan : attacker.spec.color)
        if attacker.isPlayer && !blocked {
            comboCount += 1
            comboTimer = 1.35
            comboLabel.text = attacker.currentMove?.name ?? (comboCount > 1 ? "\(comboCount) HIT" : "CLEAN HIT")
            comboLabel.alpha = 1
            comboLabel.setScale(1.18)
            comboLabel.run(.scale(to: 1, duration: 0.12))
        } else if blocked {
            comboLabel.text = "BLOCK"
            comboLabel.alpha = 1
            comboLabel.setScale(1.08)
            comboLabel.run(.sequence([.scale(to: 1, duration: 0.10), .wait(forDuration: 0.35), .fadeOut(withDuration: 0.18)]))
        }
        hitStopTime = blocked ? 0.035 : (strength == 2 ? 0.075 : 0.045)
        shakeTime = blocked ? 0.04 : (strength == 2 ? 0.18 : 0.10)
        haptic?(blocked ? 0 : strength)
    }

    private func maintainFighterSpacing() {
        guard p1 != nil && p2 != nil else { return }
        let distance = abs(p2.x - p1.x)
        guard distance < minimumFighterSpacing else { return }
        let push = (minimumFighterSpacing - distance) * 0.5
        if p1.x <= p2.x {
            p1.x = clamp(p1.x - push, 120, 1160)
            p2.x = clamp(p2.x + push, 120, 1160)
        } else {
            p1.x = clamp(p1.x + push, 120, 1160)
            p2.x = clamp(p2.x - push, 120, 1160)
        }
    }

    private func maintainFighterSpacing(moving actor: FighterActor, against other: FighterActor) {
        let distance = abs(actor.x - other.x)
        guard distance < minimumFighterSpacing else { return }
        if actor.x <= other.x {
            actor.x = clamp(other.x - minimumFighterSpacing, 120, 1160)
        } else {
            actor.x = clamp(other.x + minimumFighterSpacing, 120, 1160)
        }
    }

    private func finishRound(winner forcedWinner: FighterActor? = nil) {
        mode = .roundOver
        roundOverTimer = 3.0
        hitStopTime = 0
        shakeTime = 0
        queuedAttack = nil
        activeControls.removeAll()
        messageLabel.removeAllActions()
        messageLabel.alpha = 1
        messageLabel.isHidden = false
        p1.isBlocking = false
        p2.isBlocking = false
        let winner = forcedWinner ?? (p1.health > 0 ? p1! : p2!)
        messageLabel.text = "\(winner.spec.name) WINS - \(winner.spec.finisher)"
        haptic?(2)
        configureControls()
        refreshLayout()
    }

    private func updateCamera() {
        let center = (p1.x + p2.x) * 0.5
        cameraX += (center - cameraX) * 0.06
        let distance = abs(p1.x - p2.x)
        let targetZoom = 1 + max(0, min(0.12, (520 - distance) / 420 * 0.12))
        cameraZoom += (targetZoom - cameraZoom) * 0.08
        world.setScale(cameraZoom)
        let shakeX = shakeTime > 0 ? CGFloat.random(in: -9...9) * CGFloat(shakeTime / 0.18) : 0
        let shakeY = shakeTime > 0 ? CGFloat.random(in: -5...5) * CGFloat(shakeTime / 0.18) : 0
        let portraitLift: CGFloat = size.height > size.width ? 170 : 0
        world.position.x = size.width * 0.5 - cameraX * cameraZoom + shakeX
        world.position.y = portraitLift + shakeY
    }

    private func updateBars() {
        layoutHUD()
        let p1Width = max(0, healthBarWidth * p1.health / 100)
        let p2Width = max(0, healthBarWidth * p2.health / 100)
        p1Bar.xScale = p1Width / 430
        p2Bar.xScale = p2Width / 430
        p1Bar.position = CGPoint(x: p1HealthLeftX + p1Width / 2, y: p1BarBack.position.y)
        p2Bar.position = CGPoint(x: p2HealthRightX - p2Width / 2, y: p2BarBack.position.y)
        p1Meter.xScale = min(1, healthBarWidth / 270) * max(0.02, p1.meter / 100)
        p2Meter.xScale = min(1, healthBarWidth / 270) * max(0.02, p2.meter / 100)
        timerLabel.text = "\(max(0, Int(ceil(roundTime))))"
    }

    private func spawnImpact(at point: CGPoint, color: UIColor) {
        let burst = SKShapeNode(circleOfRadius: 14)
        burst.position = point
        burst.fillColor = color.withAlphaComponent(0.7)
        burst.strokeColor = .white
        burst.lineWidth = 3
        burst.zPosition = 10
        world.addChild(burst)
        burst.run(.sequence([
            .group([.scale(to: 3.4, duration: 0.18), .fadeOut(withDuration: 0.18)]),
            .removeFromParent()
        ]))
    }

    private func spawnGuard(at point: CGPoint) {
        let guardFlash = SKShapeNode(ellipseOf: CGSize(width: 64, height: 118))
        guardFlash.position = point
        guardFlash.fillColor = SKColor.cyan.withAlphaComponent(0.12)
        guardFlash.strokeColor = SKColor.white.withAlphaComponent(0.92)
        guardFlash.lineWidth = 4
        guardFlash.zPosition = 11
        world.addChild(guardFlash)
        guardFlash.run(.sequence([
            .group([.scale(to: 1.55, duration: 0.16), .fadeOut(withDuration: 0.16)]),
            .removeFromParent()
        ]))
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) { handleTouches(touches, began: true) }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) { handleTouches(touches, began: true) }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) { handleTouches(touches, began: false) }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { handleTouches(touches, began: false) }

    private func handleTouches(_ touches: Set<UITouch>, began: Bool) {
        for touch in touches {
            let touchID = ObjectIdentifier(touch)
            let point = touch.location(in: self)
            if began {
                if let previous = touchControls[touchID] {
                    activeControls.remove(previous)
                    if let node = buttonNodes[previous] { node.fillColor = node.fillColor.withAlphaComponent(0.18) }
                    touchControls.removeValue(forKey: touchID)
                }
                if mode == .mainMenu, let menuNode = nodes(at: point).first(where: { $0.name?.hasPrefix("menu:") == true }),
                   let name = menuNode.name,
                   let index = Int(name.replacingOccurrences(of: "menu:", with: "")),
                   mainMenuItems.indices.contains(index) {
                    selectedMenuIndex = index
                    let item = mainMenuItems[index]
                    if isPlayableFeature(item.id) {
                        playModeName = item.title
                    }
                    showInfo(item.id)
                    haptic?(0)
                    return
                }
                if mode == .select && selectFightHotspot().contains(point) {
                    press("start")
                    haptic?(1)
                    return
                }
                if let (name, node) = button(at: point) {
                    press(name)
                    touchControls[touchID] = name
                    node.fillColor = node.fillColor.withAlphaComponent(0.36)
                    return
                }
            } else {
                if let name = touchControls.removeValue(forKey: touchID) {
                    activeControls.remove(name)
                    if let node = buttonNodes[name] { node.fillColor = node.fillColor.withAlphaComponent(0.18) }
                }
            }
        }
    }

    private func button(at point: CGPoint) -> (String, SKShapeNode)? {
        for (name, node) in buttonNodes where !node.isHidden {
            let hitFrame = node.calculateAccumulatedFrame().insetBy(dx: -14, dy: -14)
            if hitFrame.contains(point) {
                return (name, node)
            }
        }
        return nil
    }

    private func selectFightHotspot() -> CGRect {
        let rect = visibleSceneRect()
        if rect.width < 760 {
            return CGRect(x: rect.minX + 130, y: rect.midY - 120, width: rect.width - 260, height: 270)
        }
        return CGRect(x: rect.midX - 360, y: rect.midY - 120, width: 720, height: 260)
    }

    private func press(_ name: String) {
        switch mode {
        case .title:
            if name == "start" { showMainMenu() }
        case .mainMenu:
            if name == "left" {
                selectedMenuIndex = (selectedMenuIndex + mainMenuItems.count - 1) % mainMenuItems.count
                updateMainMenuText()
                haptic?(0)
            } else if name == "right" {
                selectedMenuIndex = (selectedMenuIndex + 1) % mainMenuItems.count
                updateMainMenuText()
                haptic?(0)
            } else if name == "start" {
                let item = mainMenuItems[selectedMenuIndex]
                if isPlayableFeature(item.id) {
                    playModeName = item.title
                }
                showInfo(item.id)
            }
        case .info:
            if name == "start" && isPlayableFeature(activeInfoID) {
                showSelect()
            } else if name == "start" || name == "left" || name == "right" {
                showMainMenu()
            }
        case .select:
            if name == "left" { selectedIndex = (selectedIndex + roster.count - 1) % roster.count; updateRival(); updateSelectText(); haptic?(0) }
            else if name == "right" { selectedIndex = (selectedIndex + 1) % roster.count; updateRival(); updateSelectText(); haptic?(0) }
            else if name == "start" || name == "punch" { startFight() }
        case .fight:
            if attackButtons.contains(name) {
                let mappedAttack = name == "special" && p1.meter >= 100 ? "super" : name
                queuedAttack = mappedAttack
                activeControls.insert(mappedAttack)
            } else {
                activeControls.insert(name)
            }
        case .roundOver:
            if name == "start" { showMainMenu() }
        }
    }

    private func updateRival() {
        rivalIndex = (selectedIndex + 1) % roster.count
    }

    private func styleBarBack(_ node: SKShapeNode) {
        node.fillColor = SKColor.black.withAlphaComponent(0.66)
        node.strokeColor = SKColor(red: 1, green: 0.78, blue: 0.24, alpha: 0.62)
        node.lineWidth = 2
    }

    private func runAutotestIfRequested() {
        guard ProcessInfo.processInfo.arguments.contains("--kaden-autotest") else { return }
        run(.sequence([
            .wait(forDuration: 0.25),
            .run { [weak self] in self?.runAutotest() }
        ]))
    }

    private func runFightPreviewIfRequested() {
        guard ProcessInfo.processInfo.arguments.contains("--kaden-fight-preview") else { return }
        run(.sequence([
            .wait(forDuration: 0.25),
            .run { [weak self] in
                guard let self else { return }
                self.showSelect()
                self.startFight()
                self.roundStartGrace = 0
                self.p1.x = 498
                self.p2.x = 812
                self.p1.facing = 1
                self.p2.facing = -1
                self.p1.setAction(.punch)
                self.p2.setAction(.hit)
                self.maintainFighterSpacing()
                self.updateCamera()
            }
        ]))
    }

    private func runAutotest() {
        var failures: [String] = []
        func check(_ condition: @autoclosure () -> Bool, _ name: String) {
            if condition() {
                NSLog("[KadenAutotest] PASS \(name)")
            } else {
                NSLog("[KadenAutotest] FAIL \(name)")
                failures.append(name)
            }
        }

        check(roster.count == 10, "ten selectable fighters")
        check(bundleImage(named: "country-stages-strip") != nil, "stage art loads")
        check(bundleImage(named: "kaden-native-keyart") != nil, "native key art loads")
        for fighter in roster {
            check(bundleImage(named: fighter.sheet) != nil, "\(fighter.name) fighter sheet loads")
            check(moveBook(for: fighter).count == 30, "\(fighter.name) has 30 style moves")
        }

        showTitle()
        check(mode == .title && titleLabel.text == "KADEN FIGHTERS" && messageLabel.text == "TAP MENU", "splash screen")
        press("start")
        check(mode == .mainMenu && messageLabel.text?.contains("STORY") == true, "main menu opens")
        check(menu.children.filter { $0.name?.hasPrefix("menu:") == true }.count == mainMenuItems.count, "main menu shows every feature tile")
        press("right")
        check(mode == .mainMenu && messageLabel.text?.contains("VERSUS") == true, "main menu cycles right")
        press("left")
        check(mode == .mainMenu && messageLabel.text?.contains("STORY") == true, "main menu cycles left")
        for feature in ["story", "versus", "tournament", "training", "options", "extras", "store", "ranks", "fighters", "stages", "controls", "profile"] {
            showInfo(feature)
            check(mode == .info && titleLabel.text == infoTitle(for: feature), "\(feature) screen opens")
            press("left")
            check(mode == .mainMenu, "\(feature) returns to menu")
        }
        selectedMenuIndex = 0
        updateMainMenuText()
        press("start")
        check(mode == .info && titleLabel.text == "STORY", "story page opens from menu")
        press("start")
        check(mode == .select && selectedIndex == 0, "fighter select opens")
        press("right")
        check(selectedIndex == 1 && rivalIndex == 2, "fighter select next")
        press("left")
        check(selectedIndex == 0 && rivalIndex == 1, "fighter select previous")
        press("start")
        check(mode == .fight && p1 != nil && p2 != nil, "fight starts")
        check(p1.spec.name == "KADEN" && p2.spec.name == "RAIJIN", "selected fighters spawn")
        check(hud.isHidden == false, "fight HUD visible")
        check(["left", "right", "jump", "punch", "kick", "special", "block"].allSatisfy { buttonNodes[$0]?.isHidden == false } && buttonNodes["super"]?.isHidden == true, "kid fight controls visible")
        check(abs(p2.x - p1.x) >= minimumFighterSpacing, "fighters start at safe neutral distance")
        let timeBeforeTick = roundTime
        update(1.0)
        check(roundTime < timeBeforeTick, "round timer counts down")

        let startX = p1.x
        activeControls.insert("right")
        updatePlayer(delta: 0.2)
        activeControls.remove("right")
        check(p1.x > startX, "player moves right")

        p1.x = 520
        p2.x = 820
        let hpBeforePunch = p2.health
        activeControls.insert("punch")
        resolveAttacks()
        check(p2.health < hpBeforePunch, "punch damages opponent")
        check(abs(p2.x - p1.x) >= minimumFighterSpacing, "player punch keeps fighter spacing")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.x = 520
        p2.x = 840
        let hpBeforeKick = p2.health
        activeControls.insert("kick")
        resolveAttacks()
        check(p2.health < hpBeforeKick, "kick damages opponent")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.x = 520
        p2.x = 860
        let hpBeforeSpecial = p2.health
        activeControls.insert("special")
        resolveAttacks()
        check(p2.health < hpBeforeSpecial, "special damages opponent")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.x = 520
        p2.x = 880
        p1.meter = 100
        let hpBeforeSuper = p2.health
        press("special")
        resolveAttacks()
        check(p2.health < hpBeforeSuper && p1.meter < 100, "power button triggers super at full meter")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.health = 100
        p2.health = 100
        p1.x = 520
        p2.x = 900
        roundStartGrace = 0
        aiCooldown = 0.2
        let rivalStartX = p2.x
        updateAI(delta: 0.2)
        check(p2.x < rivalStartX, "rival moves toward player")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.health = 100
        p1.meter = 44
        p1.x = 520
        p2.x = 820
        p1.facing = 1
        p2.facing = -1
        p1.isBlocking = true
        let blockedHpBefore = p1.health
        p2.setAction(.punch)
        applyHit(attacker: p2, defender: p1)
        let blockedDamage = blockedHpBefore - p1.health
        check(blockedDamage > 0 && blockedDamage < 4, "block reduces incoming damage")
        check(p1.meter > 44, "block builds meter")
        p1.isBlocking = false

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.health = 100
        p1.x = 520
        p2.x = 820
        p2.facing = -1
        let p1HpBeforePunch = p1.health
        p2.setAction(.punch)
        applyHit(attacker: p2, defender: p1)
        check(p1.health < p1HpBeforePunch, "rival punch damages player")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.health = 100
        p1.x = 520
        p2.x = 840
        p2.facing = -1
        let p1HpBeforeKick = p1.health
        p2.setAction(.kick)
        applyHit(attacker: p2, defender: p1)
        check(p1.health < p1HpBeforeKick, "rival kick damages player")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.health = 100
        p1.x = 520
        p2.x = 860
        p2.facing = -1
        let p1HpBeforeSpecial = p1.health
        p2.setAction(.special)
        applyHit(attacker: p2, defender: p1)
        check(p1.health < p1HpBeforeSpecial, "rival special damages player")

        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.health = 100
        p2.meter = 100
        p1.x = 520
        p2.x = 880
        p2.facing = -1
        let p1HpBeforeSuper = p1.health
        p2.setAction(.superMove)
        applyHit(attacker: p2, defender: p1)
        check(p1.health < p1HpBeforeSuper && p2.meter == 100, "rival super damages player")

        p1.health = 100
        p2.health = 100
        p2.health = 8
        p1.meter = 100
        p1.setAction(.idle)
        p2.setAction(.idle)
        p1.x = 520
        p2.x = 820
        activeControls.insert("super")
        resolveAttacks()
        update(10)
        check(mode == .roundOver && p2.health == 0, "KO enters round over")

        roundOverTimer = 0.01
        update(10.1)
        check(mode == .select, "round over returns to select")

        if failures.isEmpty {
            NSLog("[KadenAutotest] ALL_PASS")
        } else {
            NSLog("[KadenAutotest] FAILURES \(failures.joined(separator: ", "))")
        }
    }

    private func stageTexture(index: Int) -> SKTexture {
        guard let image = bundleImage(named: "country-stages-strip") else { return SKTexture() }
        let texture = SKTexture(image: image)
        texture.filteringMode = .linear
        let rowCount: CGFloat = 8
        let row = CGFloat(max(0, min(7, index)))
        let rect = CGRect(x: 0, y: (rowCount - row - 1) / rowCount, width: 1, height: 1 / rowCount)
        let cropped = SKTexture(rect: rect, in: texture)
        cropped.filteringMode = .linear
        return cropped
    }
}

private func bundleImage(named name: String) -> UIImage? {
    let paths = [
        ("NativeAssets", name),
        ("public/assets/generated", name),
        ("public/assets", name)
    ]
    for (directory, file) in paths {
        if let url = Bundle.main.url(forResource: file, withExtension: "png", subdirectory: directory),
           let image = UIImage(contentsOfFile: url.path) {
            return image
        }
    }
    return nil
}

private func clamp(_ value: CGFloat, _ low: CGFloat, _ high: CGFloat) -> CGFloat {
    min(high, max(low, value))
}

private func aspectFillSize(_ source: CGSize, in target: CGSize) -> CGSize {
    guard source.width > 0 && source.height > 0 else { return target }
    let scale = max(target.width / source.width, target.height / source.height)
    return CGSize(width: source.width * scale, height: source.height * scale)
}
