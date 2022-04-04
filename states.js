const Utils = require("./utils")
const Coords = require("./coordinates")

const DefaultCoords = {
    'goalie': [-50, 0],
    'attacker_front_middle': [-5, 0],
    'attacker_front_top': [-5, -20],
    'attacker_front_bottom': [-5, 20],
    'attacker_back_top': [-28, -20],
    'attacker_back_middle': [-35, 0],
    'attacker_back_bottom': [-28, 20],
    'defender_out_top': [-34, -20],
    'defender_in_top': [-34, -5],
    'defender_in_bottom': [-34, 5],
    'defender_out_bottom': [-34, 20],
}

const SPEED_SLOW = 50
const SPEED_NORMAL = 70
const SPEED_FAST = 100
const DRIBBLE_DIST = 10.0

class BallAnalyzer {
    constructor(agent, mem) {
        this.agent = agent
        this.mem = mem
        this._wasKicked = false
        if (!this._hasBall() || this._getBallAge() > 0)
            this._update()
    }

    isReady() {
        return this._hasBall()
    }

    wasKicked() {
        return this._wasKicked
    }

    estimateCoords(depth) {
        return this._estimateCoords(depth)
    }

    estimateVelocity(depth) {
        return this._estimateVelocity(depth)
    }

    getAge() {
        return this._getBallAge()
    }

    canKick() {
        return this.calculateEffectivePower() > 0
    }

    estimateKickTo(target) {
        if (!this.canKick()) return null

        target = Utils.calculateObjectPositioning(this.agent, target)
        let targetVector = Utils.vectorFromPoints(this.agent.position.coords, target.coords)
        targetVector = Utils.multVector(targetVector, 1.05)
        target = Utils.calculateObjectPositioning(this.agent, { coords: Utils.sumVector(this.agent.position.coords, targetVector) })

        let ballAccelMax = this.agent.params.ball_accel_max
        let effectivePower = this.calculateEffectivePower()
        let correction = this.estimateVelocity(0)

        let ballDecay = this.agent.params.ball_decay
        let b = 0, t = 100
        while (b != t) {
            let pow = Math.floor((b + t) / 2)
            let dist = ballAccelMax / (1 - ballDecay) * pow / 100
            if (dist > target.distance) t = pow
            else b = pow + 1
        }

        let requiredPower = t / effectivePower
        let resultVector = Utils.multVector(Utils.normalize(targetVector), requiredPower / 100 * ballAccelMax)
        resultVector = Utils.sumVector(resultVector, Utils.multVector(correction, -1))
        let resultPower = Utils.vectorLength(resultVector) / ballAccelMax * 100
        return {
            power: Math.min(100, resultPower),
            direction: Utils.vectorDirection(resultVector, this.agent.position.zeroVec),
            quality: Math.min(1, 100 / resultPower)
        }
    }

    calculateEffectivePower() {
        let ballSize = this.agent.params.ball_size
        let playerSize = this.agent.params.player_size
        let kickableMargin = this.agent.params.kickable_margin
        let ballPosition = Utils.calculateObjectPositioning(this.agent, { coords: this.estimateCoords(0) })

        if (ballPosition.distance > kickableMargin + playerSize / 2)
            return 0

        let ep = 1
        ep -= 0.25 * ((ballPosition.distance - playerSize - ballSize) / kickableMargin)
        ep -= 0.25 * (ballPosition.direction / 180)
        return ep
    }

    _update() {
        if (!this.agent.hear.isPlayOn() && !this.agent.hear.isKickOffAlly()) this._clear()
        this._wasKicked = false
        let oldEstimate = this.isReady() ? this.estimateCoords(5) : null
        let visibleBallInfo = null
        for (let obj of this.agent.position.objects) {
            if (obj.isBall) {
                visibleBallInfo = obj
                break
            }
        }
        let position = Utils.calculateObjectPositioning(this.agent, visibleBallInfo)
        if (!position) return
        let info = {
            coords: position.coords,
            velocity: this._calculateVisibleVelocity(visibleBallInfo)
        }
        this._updateBall(info)
        if (oldEstimate !== null) {
            let newEstimate = this.estimateCoords(5)
            this._wasKicked = Coords.distance(oldEstimate, newEstimate) > 4
        }
    }

    _calculateVisibleVelocity(visibleBallInfo) {
        if (!Utils.isNumber(visibleBallInfo?.dirChange) || !Utils.isNumber(visibleBallInfo?.distChange) || !visibleBallInfo?.coords)
            return null;

        let relativeDirection = Utils.rotateVector({ x: 1, y: 0 }, visibleBallInfo.direction)
        let relativeCoords = Utils.multVector(relativeDirection, visibleBallInfo.distance)
        let nextRelativeCoords = Utils.multVector(relativeDirection, visibleBallInfo.distance + visibleBallInfo.distChange)
        nextRelativeCoords = Utils.rotateVector(nextRelativeCoords, visibleBallInfo.dirChange)
        let playerRelativeSpeed = this.agent.sense.relativeSpeed()
        let ballRelativeVelocity = {
            x: nextRelativeCoords.x - relativeCoords.x + playerRelativeSpeed.x,
            y: nextRelativeCoords.y - relativeCoords.y + playerRelativeSpeed.y
        }
        let zeroDirection = Utils.vectorDirection(this.agent.position.zeroVec, { x: 1, y: 0 })
        let ballAbsoluteVelocity = Utils.rotateVector(ballRelativeVelocity, zeroDirection)
        let ballMaxSpeed = this.agent.params.ball_speed_max
        let ballSpeed = Utils.vectorLength(ballAbsoluteVelocity)
        if (ballMaxSpeed < ballSpeed) {
            ballAbsoluteVelocity = {
                x: ballAbsoluteVelocity.x * ballMaxSpeed / ballSpeed,
                y: ballAbsoluteVelocity.y * ballMaxSpeed / ballSpeed,
            }
        }
        return ballAbsoluteVelocity
    }

    _clear() {
        this.mem.delete("BallAnalyzer.ball")
    }

    _updateBall(ball) {
        this.mem.updateValue("BallAnalyzer.ball", ball)
    }

    _hasBall() {
        return this.mem.has("BallAnalyzer.ball")
    }

    _getBall() {
        return this.mem.getValue("BallAnalyzer.ball")
    }

    _getBallAge() {
        return this.mem.getAge("BallAnalyzer.ball")
    }

    _estimateVelocity(depth) {
        let ball = this._getBall()
        let velocity = ball.velocity
        if (ball.velocity == null) return { x: 0, y: 0 }
        let ballAge = this._getBallAge()
        depth += ballAge
        let decay = this.agent.params.ball_decay
        return {
            x: velocity.x * decay ** depth,
            y: velocity.y * decay ** depth
        }
    }

    _estimateCoords(depth) {
        let ball = this._getBall()
        let ballAge = this._getBallAge()
        depth += ballAge
        if (ball.velocity == null || depth <= 0) return ball.coords
        let velocity = ball.velocity
        let decay = this.agent.params.ball_decay
        let progression = (1 - decay ** depth) / (1 - decay)
        return {
            x: ball.coords.x + velocity.x * progression,
            y: ball.coords.y + velocity.y * progression
        }
    }
}

class PathAnalyzer {
    constructor(agent, ballAnalyzer) {
        this.agent = agent
        this.ball = ballAnalyzer
    }

    estimateAgentShortestPath() {
        return this.estimateShortestPath({
            coords: this.agent.position.coords,
            zeroVec: this.agent.position.zeroVec,
        })
    }

    estimateShortestPath(from) {
        let depth = 0
        let shortest = {
            slow: null,
            normal: null,
            fast: null,
        }
        while (!shortest.slow || !shortest.normal || !shortest.fast) {
            let ballCoords = this.ball.estimateCoords(depth)
            if (Coords.distance(from.coords, ballCoords) > 0.4)
                ballCoords = Utils.sumVector(ballCoords, Utils.multVector(Utils.normalize(Utils.vectorFromPoints(from.coords, ballCoords)), 0.5))
            if (!shortest.slow && this._estimatePathTime(from, ballCoords, SPEED_SLOW) <= depth) {
                shortest.slow = {
                    coords: ballCoords,
                    fromCoords: from.coords,
                    time: depth,
                    power: SPEED_SLOW,
                }
            }
            if (!shortest.normal && this._estimatePathTime(from, ballCoords, SPEED_NORMAL) <= depth) {
                shortest.normal = {
                    coords: ballCoords,
                    fromCoords: from.coords,
                    time: depth,
                    power: SPEED_NORMAL,
                }
            }
            if (!shortest.fast && this._estimatePathTime(from, ballCoords, SPEED_FAST) <= depth) {
                shortest.fast = {
                    coords: ballCoords,
                    fromCoords: from.coords,
                    time: depth,
                    power: SPEED_FAST,
                }
            }
            depth++
        }
        return shortest
    }

    _estimatePathTime(from, toCoords, power) {
        if (!power || power < 30) {
            console.trace("too small power, are you sure? " + power)
            power = 30
        }
        let coords = from.coords
        if (Coords.distance(coords, toCoords) < 0.5) return 0;
        let time = 0
        if (from.zeroVec) {
            let zeroVec = Utils.normalize(from.zeroVec)
            let angle = Math.abs(Utils.vectorDirection(zeroVec, Utils.vectorFromPoints(coords, toCoords)))
            if (angle > 10) time++
        } else time++
        let distance = Coords.distance(coords, toCoords)
        let speed = this.agent.params.player_speed_max * power / 100
        time += Math.ceil((distance / speed) * 1.8)
        return time
    }
}

class PlayersAnalyzer {
    constructor(agent, pathAnalyzer, mem) {
        this.agent = agent
        this.path = pathAnalyzer
        this.mem = mem
        this._prepare()
    }

    findShortestAlly() {
        return this._findShortest(this._allies)
    }

    findShortestEnemy() {
        return this._findShortest(this._enemies)
    }

    getAllies() {
        return this._allies
    }

    getEnemies() {
        return this._enemies
    }

    calculateDribbleKick(target) {
        let enemies = this.getEnemies()
        target = Utils.calculateObjectPositioning(this.agent, target)

        let agent = this.agent
        const analyzeKick = function (direction) {
            let kickVector = Utils.rotateVector(agent.position.zeroVec, direction)
            let kickPoint = Utils.sumVector(agent.position.coords, Utils.multVector(kickVector, DRIBBLE_DIST))
            if (Math.abs(kickPoint.y) > 32 || Math.abs(kickPoint.x) > 50) return null
            let quality = 1
            if (enemies.length > 0) {
                let tmp = enemies.map((e) => Math.max(0, Coords.distance(e.coords, kickPoint)))// - agent.params.player_speed_max * 0.7 * e.age))
                tmp.sort((a, b) => a - b)
                let nearestEnemy = tmp[0]
                quality = Math.min(nearestEnemy / (DRIBBLE_DIST * 1.2), 1)
            }
            return {
                coords: kickPoint,
                quality: quality
            }
        }

        let result = null
        const applyResult = function (r) {
            if (r && r.quality > 0 && (!result || result.quality < r.quality))
                result = r
        }
        for (let dirDiff = 0; dirDiff <= 20; dirDiff++) {
            applyResult(analyzeKick(target.direction + dirDiff))
            applyResult(analyzeKick(target.direction - dirDiff))
        }
        return result
    }

    selectAllyToPass(allies = null) {
        allies ??= this.getAllies()
        let enemies = this.getEnemies()
        return Utils.selectRandom(
            allies,
            allies.map((ally) => {
                ally = Utils.calculateObjectPositioning(this.agent, ally)
                let dangerEnemies = enemies
                    .map((e) => Utils.calculateObjectPositioning(this.agent, e))
                    .filter((e) => e.distance < ally.distance)
                    .map((e) => Math.abs(e.direction - ally.direction))
                dangerEnemies.sort((a, b) => a - b)
                if (dangerEnemies.length == 0 || dangerEnemies[0] > 30) return 1
                return dangerEnemies[0] / 30
            }),
        )
    }

    _findShortest(players) {
        if (players.length == 0) return null
        let shortest = players[0]
        for (let player of players)
            if (player.path.normal.time < shortest.path.normal.time)
                shortest = player
        return shortest
    }

    _prepare() {
        this._allies = []
        this._enemies = []
        for (let obj of this.agent.position.objects) {
            if (obj.isAlly) {
                let player = this._constructPlayer(obj)
                if (player) {
                    this._allies.push(player)
                    if (player.uniformNumber)
                        this.mem.updateValue(`ally_${player.uniformNumber}`, player)
                }
            }
            if (obj.isEnemy) {
                let player = this._constructPlayer(obj)
                if (player) {
                    this._enemies.push(player)
                    if (player.uniformNumber)
                        this.mem.updateValue(`enemy_${player.uniformNumber}`, player)
                }
            }
        }

        let path = this.path
        const restorePlayer = function (mem, key) {
            let age = mem.getAge(key)
            if (age >= 20 || age == 0) return null
            let player = mem.getValue(key)
            player.path = path.estimateShortestPath({
                coords: player.coords,
                zeroVec: player.zeroVec,
            })
            player.path.slow.time = Math.max(player.path.slow.time - age, 0)
            player.path.normal.time = Math.max(player.path.normal.time - age, 0)
            player.path.fast.time = Math.max(player.path.fast.time - age, 0)
            player.age = age
            return player
        }
        for (let i = 1; i <= 11; i++) {
            let allyKey = `ally_${i}`
            let enemyKey = `enemy_${i}`
            let ally = restorePlayer(this.mem, allyKey)
            let enemy = restorePlayer(this.mem, enemyKey)
            if (ally) this._allies.push(ally)
            if (enemy) this._enemies.push(enemy)
        }
    }

    _constructPlayer(info) {
        let position = Utils.calculateObjectPositioning(this.agent, info)
        if (!position) return null
        let zeroVec = null
        if (Utils.isNumber(info.bodyFacingDir)) {
            zeroVec = Utils.rotateVector(this.agent.position.zeroVec, info.bodyFacingDir)
        }
        let shortestPath = this.path.estimateShortestPath({
            coords: position.coords,
            zeroVec: zeroVec,
        })
        return {
            coords: position.coords,
            zeroVec: zeroVec,
            path: shortestPath,
            uniformNumber: info.uniformNumber,
            age: 0,
        }
    }
}

class SchemaHelper {
    constructor(agent, center, radius) {
        this.agent = agent
        this.center = center
        this.radius = radius
    }

    estimateAllyRoleCoords(role) {
        let coords;
        if (role == 'attacker_front_middle') coords = { x: this.radius, y: 0 }
        if (role == 'attacker_front_top') coords = { x: this.radius, y: 20 }
        if (role == 'attacker_front_bottom') coords = { x: this.radius, y: -20 }
        if (role == 'attacker_back_top') coords = { x: -8, y: 20 }
        if (role == 'attacker_back_middle') coords = { x: -this.radius, y: 0 }
        if (role == 'attacker_back_bottom') coords = { x: -8, y: -20 }

        if (role == 'defender_out_top') coords = { x: -34, y: 20 }
        if (role == 'defender_in_top') coords = { x: -34, y: 5 }
        if (role == 'defender_in_bottom') coords = { x: -34, y: -5 }
        if (role == 'defender_out_bottom') coords = { x: -34, y: -20 }
        if (role == 'goalie') coords = { x: -50, y: -0 }

        if (!coords) {
            console.log("AAAA unknown role " + role)
            return this.center
        }

        if (this.agent.side == 'r')
            coords.x *= -1

        if (role.startsWith('attacker_'))
            coords.x += this.center.x
        return coords
    }

    calculateAllyRoleAttackTarget(role) {
        let coords;
        if (role == 'attacker_front_middle') coords = { x: 52.5, y: 0 }
        if (role == 'attacker_front_top') coords = { x: 52.5 - 8, y: 10 }
        if (role == 'attacker_front_bottom') coords = { x: 52.5 - 8, y: -10 }
        if (role == 'attacker_back_middle') coords = { x: 52.5, y: 0 }
        if (role == 'attacker_back_top') coords = { x: 52.5 - 15, y: 20 }
        if (role == 'attacker_back_bottom') coords = { x: 52.5 - 15, y: -20 }
        if (role.startsWith('defender')) coords = { x: 52.5, y: 0 }

        if (!coords) {
            console.log("AAAA unknown role " + role)
            return Utils.calculateEnemyGatesCoords(this.agent)
        }

        if (this.agent.side == 'r')
            coords.x *= -1

        return coords
    }
}

class StateTree {
    constructor(agent) {
        this.agent = agent
        this.mem = new Memory()
        this.states = {
            "init": (t) => CommonStates.stateInit(t, t.data),
            "find_ball": (t) => CommonStates.stateFindBall(t, t.data),
            "dribble": (t) => CommonStates.stateDribble(t, t.data),
            "move": (t) => CommonStates.stateMove(t, t.data),
            "kick_ally": (t) => CommonStates.stateKickAlly(t, t.data),

            "team_attack": (t) => AttackerTeamStates.stateTeamAttack(t, t.data),
            "team_dribble": (t) => AttackerTeamStates.stateTeamDribble(t, t.data),
            "team_follow": (t) => AttackerTeamStates.stateTeamFollow(t, t.data),

            "goalie": (t) => GoalieStates.stateGoalie(t, t.data),
            "goalie_intercept": (t) => GoalieStates.stateGoalieIntercept(t, t.data),
            "goalie_kick_out": (t) => GoalieStates.stateGoalieKickOut(t, t.data),
            "goalie_catch": (t) => GoalieStates.stateGoalieCatch(t, t.data),

            "schema": (t) => SchemaStates.stateSchema(t, t.data),
            "schema_kick": (t) => SchemaStates.stateSchemaKick(t, t.data),
            "schema_kick_off": (t) => SchemaStates.stateSchemaKickOff(t, t.data),
            "schema_move_default": (t) => SchemaStates.stateSchemaMoveDefault(t, t.data),
            "schema_attack": (t) => SchemaStates.stateSchemaAttack(t, t.data),
            "schema_give_pass": (t) => SchemaStates.stateSchemaGivePass(t, t.data),
            "schema_kick_gates": (t) => SchemaStates.stateSchemaKickGates(t, t.data),
        }
        this.data = {}
    }

    makeCmd() {
        this._cmd = null
        this.callState("init")
        this.mem.increaseAge()
        return this._cmd
    }

    callState(state) {
        this.states[state](this)
    }

    finish(cmd) {
        this._cmd = cmd
    }

    finishTurn(turn) {
        this.finish({ n: 'turn', v: turn })
    }

    finishDash(power) {
        this.finish({ n: 'dash', v: power })
    }

    finishKick(power, direction = 0) {
        this.data.init.ball._clear()
        this.mem.updateValue('finishKick', null)
        this.finish({ n: 'kick', v: [power, direction] })
    }

    finishCatch(direction) {
        this.finish({ n: 'catch', v: direction })
    }

    finishMove(coords) {
        if (!Array.isArray(coords))
            coords = [coords.x, coords.y]
        this.finish({ n: 'move', v: coords })
    }
}

const CommonStates = {
    stateInit(tree, data) {
        data.init ??= {}
        data.init.agent = tree.agent
        data.init.ball = new BallAnalyzer(data.init.agent, tree.mem)
        data.init.params = data.init.agent.params

        let ball = data.init.ball
        if (!ball.isReady() || ball.getAge() > 7) {
            return tree.callState("find_ball")
        }

        data.init.path = new PathAnalyzer(data.init.agent, data.init.ball)
        data.init.players = new PlayersAnalyzer(data.init.agent, data.init.path, tree.mem)
        data.findBall = {
            estimatedBallCoords: ball.estimateCoords(0)
        }
        if (data.init.ball.wasKicked()) {
            if (tree.mem.has('intercept.coords')) {
                tree.mem.delete('intercept.coords')
            }
        }
        return tree.callState("schema")
    },
    stateFindBall(tree, data) {
        data.findBall ??= {}
        let estimatedDirection = null

        if (data.findBall.estimatedBallCoords) {
            let ballPosition = Utils.calculateObjectPositioning(data.init.agent, { coords: data.findBall.estimatedBallCoords })
            if (Utils.isNumber(ballPosition.direction))
                estimatedDirection = ballPosition.direction
        }
        if (Utils.isNumber(data.findBall.estimatedBallDirection)) {
            estimatedDirection = data.findBall.estimatedBallDirection
        }
        data.findBall = {}
        if (estimatedDirection != null)
            return tree.finishTurn(estimatedDirection)
        return tree.finishTurn(90)
    },
    /*stateDribble(tree, data) {
        let target = Utils.calculateObjectPositioning(data.init.agent, data.dribble.target)
        let power = data.dribble.power ?? 70
        data.dribble = {}

        let agentCoords = data.init.agent.position.coords
        let ballCoords = data.init.ball.estimateCoords(0)
        let distanceToBall = Coords.distance(agentCoords, ballCoords)

        if (data.init.ball.canKick())
            return tree.finishKick(35 * Math.sqrt(power / 100), target.direction)

        if (tree.mem.getAge('intercept.coords') > 5) {
            let pathAnalyzer = data.init.path
            let optimalPath = pathAnalyzer.estimateShortestPath({
                coords: data.init.agent.position.coords,
                zeroVec: data.init.agent.position.zeroVec,
            }, power)
            tree.mem.updateValue('intercept.coords', optimalPath.coords)
        }
        let interceptCoords = tree.mem.getValue('intercept.coords');
        data.move = {
            target: { coords: interceptCoords },
            power: power,
        }
        return tree.callState("move")
    },*/
    stateMove(tree, data) {
        let target = Utils.calculateObjectPositioning(data.init.agent, data.move.target)
        let power = data.move.power ?? 70
        data.move = {}

        /*let A = target.distance
        let B = 0.5
        let C = Math.sqrt(A ** 2 + B ** 2)
        let availableAngle = Math.abs(Math.asin(B / C)) * 180 / Math.PI*/
        if (Math.abs(target.direction) > 5)
            return tree.finishTurn(target.direction)
        return tree.finishDash(power)
    },
    stateKickAlly(tree, data) {
        let target = Utils.calculateObjectPositioning(tree.agent, data.kickAlly.target)
        let power = Math.min(100, target.distance / 40 * 100)
        return tree.finishKick(power, target.direction)
    }
}

const GoalieStates = {
    stateGoalie(tree, data) {
        let ball = data.init.ball
        let players = data.init.players
        let path = data.init.path
        let gatesCoords = Utils.calculateAllyGatesCoords(data.init.agent)
        let ballVector = Utils.normalize(Utils.vectorFromPoints(gatesCoords, ball.estimateCoords(0)))
        ballVector = Utils.multVector(ballVector, 7.5)
        ballVector.x /= 4
        ballVector.y *= 0.8
        let optimalCoords = Utils.sumVector(gatesCoords, ballVector)

        if (Coords.distance(ball.estimateCoords(0), gatesCoords) < 10)
            return tree.callState("goalie_intercept")

        let shortestEnemy = players.findShortestEnemy()
        //let shortestAlly = players.findShortestAlly()
        let agentPath = path.estimateAgentShortestPath()

        if (Coords.distance(agentPath.fast.coords, gatesCoords) < 15) {
            return tree.callState("goalie_intercept")
        }

        if (ball.getAge() > 3)
            return tree.callState("find_ball")

        let agentCoords = data.init.agent.position.coords
        if (Coords.distance(agentCoords, optimalCoords) > 0.5) {
            data.move = {
                target: { coords: optimalCoords },
                power: 70
            }
            return tree.callState("move")
        }

        return tree.callState("find_ball")
    },
    stateGoalieIntercept(tree, data) {
        let mem = tree.mem
        let agentCoords = data.init.agent.position.coords
        let ballCoords = data.init.ball.estimateCoords(0)
        let gatesCoords = Utils.calculateAllyGatesCoords(data.init.agent)
        if (data.init.ball.canKick())
            return tree.callState("goalie_kick_out")
        let ballRelativeCoords = {
            x: Math.abs(ballCoords.x - gatesCoords.x),
            y: Math.abs(ballCoords.y - gatesCoords.y),
        }
        let catchAllowed = ballRelativeCoords.x < 15 && ballRelativeCoords.y < 19
        if (catchAllowed && Coords.distance(ballCoords, agentCoords) < data.init.params.catchable_area_l)
            return tree.callState("goalie_catch")

        let storedCoords = mem.getAge('intercept.coords') < 10 ? mem.getValue('intercept.coords') : null
        if (!storedCoords || Coords.distance(storedCoords, agentCoords) < 0.5) {
            let path = data.init.path
            let agentPath = path.estimateAgentShortestPath()
            storedCoords = agentPath.fast.coords
            mem.updateValue('intercept.coords', storedCoords)
        }

        data.move = {
            target: { coords: storedCoords },
            power: 100,
        }
        return tree.callState("move")
    },
    stateGoalieKickOut(tree, data) {
        let agent = tree.agent
        let players = data.init.players
        let gatesCoords = Utils.calculateAllyGatesCoords(agent)
        let allies = players.getAllies()
        allies = allies.filter((x) => Coords.distance(x.coords, gatesCoords) > 30)
        let ally = players.selectAllyToPass(allies)

        if (ally) {
            let settings = data.init.ball.estimateKickTo(ally)
            if (settings && settings.power > 0) {
                return tree.finishKick(Math.min(settings.power, 100), settings.direction)
            }
        }

        let target = Utils.calculateObjectPositioning(agent, { coords: { x: 0, y: 0 } })
        return tree.finishKick(100, target.direction)
    },
    stateGoalieCatch(tree, data) {
        let agent = data.init.agent
        let ballPosition = Utils.calculateObjectPositioning(agent, { coords: data.init.ball.estimateCoords(0) })
        let ballDirection = ballPosition.direction
        return tree.finishCatch(ballDirection)
    }
}

const SchemaStates = {
    stateSchema(tree, data) {
        const SchemaRadius = 15

        let mem = tree.mem
        let hear = tree.agent.hear
        data.schema ??= {}
        data.schema.radius = SchemaRadius

        if (hear.canMove()) {
            data.schema.center = { x: tree.agent.side == 'l' ? -20 : 20, y: 0 }
            data.schema.helper = new SchemaHelper(tree.agent, data.schema.center, data.schema.radius)
            mem.updateValue('schema.centerX', -20)
            return tree.callState('schema_move_default')
        }

        let oldCenterX = mem.getValue('schema.centerX')
        if (!oldCenterX) {
            if (tree.agent.side == 'l')
                oldCenterX = -SchemaRadius
            else
                oldCenterX = SchemaRadius
        }
        let ballCoords = tree.data.init.ball.estimateCoords(0);

        if (Math.abs(oldCenterX - ballCoords.x) > SchemaRadius) {
            let sign = ballCoords.x > oldCenterX ? 1 : -1
            let diff = (Math.abs(ballCoords.x - oldCenterX) - SchemaRadius) * sign
            oldCenterX += diff
        }

        if (tree.agent.side == 'l') {
            oldCenterX = Utils.clamp(oldCenterX, -25, 35)
        } else {
            oldCenterX = Utils.clamp(oldCenterX, -35, 25)
        }

        mem.updateValue('schema.centerX', oldCenterX)
        data.schema.center = {
            x: oldCenterX,
            y: 0,
        }
        if (hear.isKickOffAlly())
            data.schema.center = { x: tree.agent.side == 'l' ? -20 : 20, y: 0 }
        data.schema.helper = new SchemaHelper(tree.agent, data.schema.center, data.schema.radius)

        if (tree.agent.role == 'goalie')
            return tree.callState('goalie')

        if (tree.agent.role == 'statist') {
            return tree.finish(null)
        }

        if (hear.isKickOffAlly()) {
            return tree.callState('schema_kick_off')
        }

        if (!hear.isPlayOn())
            return tree.callState('find_ball')

        return tree.callState('schema_attack')
    },
    stateSchemaMoveDefault(tree, data) {
        let role = tree.agent.role;
        let baseCoords = DefaultCoords[role]
        if (tree.agent.side == 'r') 
            baseCoords = [baseCoords[0], baseCoords[1] * -1]
        
        let coords = tree.agent.position.coords
        if (Coords.distance({ x: baseCoords[0], y: baseCoords[1] }, coords) > 3)
            return tree.finishMove(baseCoords)
        return tree.callState('find_ball')
    },
    stateSchemaKickOff(tree, data) {
        let role = tree.agent.role;
        if (role != 'attacker_front_middle')
            return tree.callState('find_ball')

        let distance = Coords.distance({ x: 0, y: 0 }, tree.agent.position.coords)
        if (distance < 0.5) {
            let selectedRole = Math.random() > 0.5 ? 'attacker_front_top' : 'attacker_front_bottom'
            let kickProps = data.init.ball.estimateKickTo({ coords: data.schema.helper.estimateAllyRoleCoords(selectedRole) })
            return tree.finishKick(kickProps.power, kickProps.direction)
        }
        data.move = {
            target: { coords: { x: 0, y: 0 } }
        }
        return tree.callState('move')
    },
    stateSchemaAttack(tree, data) {
        let mem = tree.mem
        let ball = data.init.ball
        if (ball.canKick()) {
            return tree.callState('schema_kick')
        }

        let lastGoal = mem.getValue('schemaAttack.goal')
        //if (ball.getAge() == 0 || lastGoal == 'intercept') {
        let path = data.init.path
        let players = data.init.players

        const shouldIntercept = function() {
            let ball = data.init.ball
            let allies = players.getAllies()
            let enemies = players.getEnemies()
            let agentPath = path.estimateAgentShortestPath()
            let nearestAlly = players.findShortestAlly()
            let nearestEnemy = players.findShortestEnemy()
            if (!nearestAlly || nearestAlly.path.fast.time * 1.25>= agentPath.fast.time)
                return true
            if (nearestEnemy && nearestAlly.path.fast.time >= nearestEnemy.path.fast.time) {
                let enemyToBall = Utils.vectorFromPoints(nearestEnemy.coords, ball.estimateCoords(0))
                allies = allies
                    .filter((a) => a.path.fast.time <= agentPath.fast.time)
                    .map((a) => Utils.vectorFromPoints(a.coords, ball.estimateCoords(0)))
                    .map((v) => Math.abs(Utils.vectorDirection(v, enemyToBall)))
                allies.sort((a1, a2) => a2 - a1)
                if (allies.length > 0 && allies[0] > 100) return false
                let agentToBall = Utils.vectorFromPoints(tree.agent.position.coords, ball.estimateCoords(0))
                return Math.abs(Utils.vectorDirection(agentToBall, enemyToBall)) > 100
            }
            return false
        }

        if (shouldIntercept()) {
            let agentPath = path.estimateAgentShortestPath()
            mem.updateValue('schemaAttack.goal', 'intercept')
            let storedCoords = mem.getAge('intercept.coords') < 5 ? mem.getValue('intercept.coords') : null
            let wantedPath = agentPath.fast
            if (!storedCoords || Coords.distance(tree.agent.position.coords, storedCoords) < 0.5) {
                storedCoords = wantedPath.coords
                mem.updateValue('intercept.coords', storedCoords)
            }
            data.move = {
                target: { coords: storedCoords },
                power: wantedPath.power,
            }
            return tree.callState('move')
        }
        //}

        mem.updateValue('schemaAttack.goal', 'move')
        let optimalCoords = data.schema.helper.estimateAllyRoleCoords(tree.agent.role)
        let optimalCoordsDistance = Coords.distance(optimalCoords, tree.agent.position.coords)
        if (optimalCoordsDistance < 3) {
            return tree.callState('find_ball')
        }
        data.move = {
            target: { coords: optimalCoords },
            power: optimalCoordsDistance < 10 ? 70 : 100,
        }
        return tree.callState('move')
    },
    stateSchemaKick(tree, data) {
        let players = data.init.players
        let gatesCoords = Utils.calculateEnemyGatesCoords(tree.agent)
        let ball = data.init.ball
        let optimalCoords = data.schema.helper.estimateAllyRoleCoords(tree.agent.role)

        if (Coords.distance(ball.estimateCoords(0), gatesCoords) < 30)
            return tree.callState('schema_kick_gates')

        if (Coords.distance(optimalCoords, tree.agent.position.coords) > 20 && !tree.agent.role.startsWith('attacker_front')) {
            console.log("Give pass from role " + tree.agent.role)
            data.schemaGivePass = { frontOnly: !tree.agent.role.startsWith('attacker_front') }
            return tree.callState('schema_give_pass')
        }

        let dribbleTargetCoords = data.schema.helper.calculateAllyRoleAttackTarget(tree.agent.role)
        let dribbleKick = players.calculateDribbleKick({ coords: dribbleTargetCoords })

        if (Math.random() > dribbleKick.quality) {
            console.log("Give pass from role " + tree.agent.role)
            data.schemaGivePass = { frontOnly: !tree.agent.role.startsWith('attacker_front') }
            return tree.callState('schema_give_pass')
        }
        let kickSettings = ball.estimateKickTo(dribbleKick)
        console.log(`Dribble kick to ${JSON.stringify(kickSettings)}`)
        return tree.finishKick(kickSettings.power, kickSettings.direction)
    },
    stateSchemaGivePass(tree, data) {
        let frontOnly = data.schemaGivePass?.frontOnly == true
        let ball = data.init.ball
        let players = data.init.players
        let allies = players.getAllies()

        if (frontOnly) {
            const inFrontOf = function (coords1, coords2) {
                if (tree.agent.side == 'l')
                    return coords1.x > coords2.x + 5
                else
                    return coords1.x - 5 < coords2.x
            }
            allies = allies.filter((t) => inFrontOf(t.coords, tree.agent.position.coords))
        }

        let ally = players.selectAllyToPass(allies)
        if (!ally) {
            if (Utils.vectorLength(ball.estimateVelocity(0)) > 0.4) {
                let kickSettings = ball.estimateKickTo(tree.agent.position)
                return tree.finishKick(kickSettings.power, kickSettings.direction)
            }

            let selectedRole = Utils.selectRandom([
                'attacker_front_top',
                'attacker_front_middle',
                'attacker_front_bottom'
            ], null, [tree.agent.role])
            let rolePosition = Utils.calculateObjectPositioning(tree.agent,
                { coords: data.schema.helper.estimateAllyRoleCoords(selectedRole) })
            return tree.finishTurn(rolePosition.direction)
        }

        let kickSettings = ball.estimateKickTo(ally)

        if (kickSettings.quality < 0.9 && Utils.vectorLength(ball.estimateVelocity(0)) > 0.4) {
            let kickSettings = ball.estimateKickTo({
                coords: Utils.sumVector(tree.agent.position.coords, tree.agent.position.zeroVec)
            })
            return tree.finishKick(kickSettings.power, kickSettings.direction)
        }

        return tree.finishKick(kickSettings.power, kickSettings.direction)
    },
    stateSchemaKickGates(tree, data) {
        let players = data.init.players
        let enemies = players.getEnemies().map((e) => Utils.calculateObjectPositioning(tree.agent, e))
        let best = null
        let enemyGateCoords = Utils.calculateEnemyGatesCoords(tree.agent)
        const applyDirection = function (direction) {
            let quality = 1
            for (let enemy of enemies) {
                let diff = Math.abs(enemy.direction - direction)
                if (diff < 15)
                    quality = Math.min(quality, diff / 15)
            }
            if (!best || best.quality < quality)
                best = {
                    quality: quality,
                    direction: direction,
                }
        }
        for (let offset = 0; offset < 8; offset++) {
            applyDirection(Utils.calculateObjectPositioning(tree.agent, {
                coords: {
                    x: enemyGateCoords.x,
                    y: enemyGateCoords.y - offset
                }
            }).direction)
            applyDirection(Utils.calculateObjectPositioning(tree.agent, {
                coords: {
                    x: enemyGateCoords.x,
                    y: enemyGateCoords.y + offset
                }
            }).direction)
        }
        if (!best) {
            console.log("WTF? Cannot find grestest direction to kick the gates??")
            best = {
                direction: Utils.calculateObjectPositioning(tree.agent, { coords: enemyGateCoords }).direction
            }
        }
        let kickSettings = data.init.ball.estimateKickTo(best)
        return tree.finishKick(kickSettings.power, kickSettings.direction)
    }
}

class Memory {
    constructor() {
        this._data = new Map()
    }

    increaseAge() {
        for (let key of this._data.keys()) {
            this._data.get(key).age++
        }
    }

    updateValue(key, value) {
        this._data.set(key, {
            value: value,
            age: 0
        })
    }

    getValue(key) {
        return this._data.get(key)?.value
    }

    getAge(key) {
        return this._data.get(key)?.age ?? 10000
    }

    has(key) {
        return this._data.has(key)
    }

    delete(key) {
        this._data.delete(key)
    }
}

module.exports = StateTree;