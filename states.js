const Utils = require("./utils")
const Coords = require("./coordinates")

class BallAnalyzer {
    constructor(agent, mem) {
        this.agent = agent
        this.mem = mem
        if (!this._hasBall() || this._getBallAge() > 0)
            this._update()
    }

    isReady() {
        return this._hasBall()
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

    _update() {
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

    estimateShortestPath(from, power = 70) {
        let depth = 0
        while (true) {
            let ballCoords = this.ball.estimateCoords(depth)
            let time = this._estimatePathTime(from, ballCoords, power)
            if (time <= depth) {
                return {
                    coords: ballCoords,
                    fromCoords: from.coords,
                    time: depth,
                    power: power,
                }
            }
            depth++
        }
    }

    _estimatePathTime(from, toCoords, power) {
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
        time += Math.ceil((distance / speed) * 1.25)
        return time
    }
}

class PlayersAnalyzer {
    constructor(agent, pathAnalyzer) {
        this.agent = agent
        this.path = pathAnalyzer
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

    _findShortest(players) {
        if (players.length == 0) return null
        let shortest = players[0]
        for (let player of players)
            if (player.path.time < shortest.path.time)
                shortest = player
        return shortest
    }

    _prepare() {
        this._allies = []
        this._enemies = []
        for (let obj of this.agent.position.objects) {
            if (obj.isAlly) {
                let player = this._constructPlayer(obj)
                if (player)
                    this._allies.push(player)
            }
            if (obj.isEnemy) {
                let player = this._constructPlayer(obj)
                if (player)
                    this._enemies.push(player)
            }
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
        }, 70)
        return {
            coords: position.coords,
            zeroVec: zeroVec,
            path: shortestPath,
            uniformNumber: info.uniformNumber,
        }
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

            "team_attack": (t) => AttackerTeamStates.stateTeamAttack(t, t.data),
            "team_dribble": (t) => AttackerTeamStates.stateTeamDribble(t, t.data),
            "team_follow": (t) => AttackerTeamStates.stateTeamFollow(t, t.data),

            "select_goal": (t) => GoalStates.stateSelectGoal(t, t.data),
            "process_goal": (t) => GoalStates.stateProcessGoal(t, t.data),

            "goalie": (t) => GoalieStates.stateGoalie(t, t.data),
            "goalie_intercept": (t) => GoalieStates.stateGoalieIntercept(t, t.data),
            "goalie_kick_out": (t) => GoalieStates.stateGoalieKickOut(t, t.data),
            "goalie_catch": (t) => GoalieStates.stateGoalieCatch(t, t.data),
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
        this.finish({ n: 'kick', v: [power, direction] })
    }

    finishCatch(direction) {
        this.finish({ n: 'catch', v: direction })
    }
}

const CommonStates = {
    stateInit(tree, data) {
        data.init ??= {}
        data.init.agent = tree.agent
        data.init.ball = new BallAnalyzer(data.init.agent, tree.mem)
        data.init.path = new PathAnalyzer(data.init.agent, data.init.ball)
        data.init.players = new PlayersAnalyzer(data.init.agent, data.init.path)
        data.init.params = data.init.agent.params

        let ball = data.init.ball
        if (!ball.isReady() || ball.getAge() > 10) {
            return tree.callState("find_ball")
        }

        data.findBall = {
            estimatedBallCoords: ball.estimateCoords(0)
        }
        return tree.callState("select_goal")
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
    stateDribble(tree, data) {
        let target = Utils.calculateObjectPositioning(data.init.agent, data.dribble.target)
        let power = data.dribble.power ?? 70
        data.dribble = {}

        let kickMargin = data.init.params.kickable_margin
        let agentCoords = data.init.agent.position.coords
        let ballCoords = data.init.ball.estimateCoords(0)
        let distanceToBall = Coords.distance(agentCoords, ballCoords)

        if (distanceToBall < kickMargin)
            return tree.finishKick(35 * power / 100, target.direction)

        if (distanceToBall < 2) {
            data.move = {
                target: { coords: ballCoords },
                power: power
            }
            return tree.callState("move")
        }

        let pathAnalyzer = data.init.path
        let optimalPath = pathAnalyzer.estimateShortestPath({
            coords: data.init.agent.position.coords,
            zeroVec: data.init.agent.position.zeroVec,
        }, power)
        data.move = {
            target: { coords: optimalPath.coords },
            power: power,
        }
        return tree.callState("move")
    },
    stateMove(tree, data) {
        let target = Utils.calculateObjectPositioning(data.init.agent, data.move.target)
        let power = data.move.power ?? 70
        data.move = {}

        let A = target.distance
        let B = 1
        let C = Math.sqrt(A ** 2 + B ** 2)
        let availableAngle = Math.abs(Math.asin(B / C)) * 180 / Math.PI
        if (Math.abs(target.direction) > Math.max(10, availableAngle))
            return tree.finishTurn(target.direction)
        return tree.finishDash(power)
    }
}

const AttackerTeamStates = {
    stateTeamAttack(tree, data) {
        let target = Utils.calculateObjectPositioning(data.init.agent, { coords: Utils.calculateEnemyGatesCoords(data.init.agent) })
        let ball = data.init.ball

        let agentCoords = data.init.agent.position.coords
        let kickMargin = data.init.params.kickable_margin
        let distanceToBall = Coords.distance(agentCoords, ball.estimateCoords(0))
        if (distanceToBall < kickMargin && target.distance < 25) {
            let movedTarget = {
                coords: {
                    x: target.coords.x,
                    y: target.coords.y + (Math.random() * 10 - 5)
                }
            }
            movedTarget = Utils.calculateObjectPositioning(data.init.agent, movedTarget)
            return tree.finishKick(100, movedTarget.direction)
        }

        data.teamDribble = {
            target: target
        }
        return tree.callState("team_dribble")
    },
    stateTeamDribble(tree, data) {
        let target = data.teamDribble.target
        data.teamDribble = {}
        let players = data.init.players
        let path = data.init.path
        let agent = data.init.agent
        let ball = data.init.ball

        let agentPath = path.estimateShortestPath({
            coords: agent.position.coords,
            zeroVec: agent.position.zeroVec,
        })
        let ally = players.findShortestAlly()
        if (ally && agentPath.time > ally.path.time) {
            let ballCoords = ball.estimateCoords(0)
            ally.isBallOwner = true
            data.teamFollow = {
                coords: ballCoords,
                direction: Utils.normalize(Utils.vectorFromPoints(ballCoords, target.coords)),
            }
            return tree.callState("team_follow")
        }

        data.dribble = {
            target: target
        }
        return tree.callState("dribble")
    },
    stateTeamFollow(tree, data) {
        const FollowDistance = 10
        const FollowAngle = 30
        const FollowErrorRadius = 2

        let players = data.init.players
        let targetCoords = data.teamFollow.coords
        let targetDirection = Utils.normalize(data.teamFollow.direction)
        data.teamFollow = {}
        let agentCoords = data.init.agent.position.coords
        let leftCoords = Utils.sumVector(Utils.multVector(Utils.rotateVector(targetDirection, -(180 - FollowAngle)), FollowDistance), targetCoords)
        let rightCoords = Utils.sumVector(Utils.multVector(Utils.rotateVector(targetDirection, 180 - FollowAngle), FollowDistance), targetCoords)
        let preferredPosition = null
        let secondaryPosition = null

        if (Coords.distance(leftCoords, agentCoords) > Coords.distance(rightCoords, agentCoords)) {
            preferredPosition = "right"
        } else {
            preferredPosition = "left"
        }

        let key = "team_follow_side"
        if (tree.mem.has(key) && tree.mem.getAge(key) < 15) {
            preferredPosition = tree.mem.getValue(key)
        }
        secondaryPosition = preferredPosition == "left" ? "right" : "left"

        let isPositionFree = function (preferrecCoords, secondaryCoords, agentCoords) {
            let allies = players.getAllies()
            for (let ally of allies) {
                if (ally.isBallOwner) continue
                let allyDistancePreferred = Coords.distance(ally.coords, preferrecCoords)
                let allyDistanceSecondary = Coords.distance(ally.coords, secondaryCoords)
                let agentDistance = Coords.distance(agentCoords, preferrecCoords)

                if (allyDistancePreferred < allyDistanceSecondary && agentDistance > allyDistancePreferred)
                    return false
            }
            return true
        }
        let preferredCoords = preferredPosition === "left" ? leftCoords : rightCoords
        let secondaryCoords = secondaryPosition === "left" ? leftCoords : rightCoords
        let selectedCoords = null
        if (isPositionFree(preferredCoords, secondaryCoords, agentCoords)) {
            tree.mem.updateValue(key, preferredPosition)
            selectedCoords = preferredCoords
        } else if (isPositionFree(secondaryCoords, preferredCoords, agentCoords)) {
            tree.mem.updateValue(key, secondaryPosition)
            selectedCoords = secondaryCoords
        }

        if (!selectedCoords || Coords.distance(selectedCoords, agentCoords) < FollowErrorRadius)
            return tree.callState("find_ball")

        data.move = {
            target: { coords: selectedCoords },
            power: Coords.distance(agentCoords, selectedCoords) > 10 ? 100 : 70
        }
        tree.callState("move")
    },
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
        let agentPath = path.estimateShortestPath({
            coords: data.init.agent.position.coords,
            zeroVec: data.init.agent.position.zeroVec,
        }, 100)

        if (Coords.distance(agentPath.coords, gatesCoords) < 15) {
            return tree.callState("goalie_intercept")
        }

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
        let agentCoords = data.init.agent.position.coords
        let ballCoords = data.init.ball.estimateCoords(0)
        let gatesCoords = Utils.calculateAllyGatesCoords(data.init.agent)
        if (Coords.distance(ballCoords, agentCoords) < 0.5)
            return tree.callState("goalie_kick_out")
        let ballRelativeCoords = {
            x: Math.abs(ballCoords.x - gatesCoords.x),
            y: Math.abs(ballCoords.y - gatesCoords.y),
        }
        let catchAllowed = ballRelativeCoords.x < 15 && ballRelativeCoords.y < 19
        if (catchAllowed && Coords.distance(ballCoords, agentCoords) < data.init.params.catchable_area_l)
            return tree.callState("goalie_catch")

        let path = data.init.path
        let agentPath = path.estimateShortestPath({
            coords: agentCoords,
            zeroVec: data.init.agent.position.zeroVec,
        }, 100)

        data.move = {
            target: { coords: agentPath.coords },
            power: 100,
        }
        return tree.callState("move")
    },
    stateGoalieKickOut(tree, data) {
        let agentSide = data.init.agent.side
        let gatesTop = agentSide == 'l' ? Coords.fglt : Coords.fgrt
        let gatesBottom = agentSide == 'l' ? Coords.fglb : Coords.fgrb
        let agentCoords = data.init.agent.position.coords
        let agentZero = data.init.agent.position.zeroVec
        /*let directionInGates = function(point, v) {
            let d1 = Utils.vectorDirection(Utils.vectorFromPoints(point, gatesTop), v)
            let d2 = Utils.vectorDirection(Utils.vectorFromPoints(point, gatesBottom), v)
            return d1 * d2 < 0
        }
        let enemyOnDirection = function(point, v) {
            let enemies = tree.manager.enemies
            for (let enemy of enemies) {
                if (!enemy?.coords) continue
                let enemyDirection = Utils.vectorFromPoints(point, enemy.coords)
                if (Math.abs(Utils.vectorDirection(enemyDirection, v)) < 10) return true
            }
            return false
        }*/
        let freeDirectionVector = Utils.normalize(Utils.vectorFromPoints(agentCoords, { x: 0, y: 10 }))
        let freeDirection = Utils.vectorDirection(freeDirectionVector, agentZero)
        return tree.finishKick(100, freeDirection)
    },
    stateGoalieCatch(tree, data) {
        let agent = data.init.agent
        let ballPosition = Utils.calculateObjectPositioning(agent, { coords: data.init.ball.estimateCoords(0) })
        let ballDirection = ballPosition.direction
        return tree.finishCatch(ballDirection)
    }
}

const GoalStates = {
    stateSelectGoal(tree, data) {
        if (data.init.agent.isGoalie)
            return tree.callState("goalie")

        const DribbleErrorRadius = 3

        let agent = data.init.agent
        let ball = data.init.ball
        let goals = agent.goals
        data.selectGoal ??= {}
        let currentGoalIndex = data.selectGoal.currentIndex ?? 0

        let isGoalAchieved = function (goal) {
            if (goal.type === "dribble") {
                let goalCoords = goal.coords
                let ballCoords = ball.estimateCoords(0)
                return Coords.distance(goalCoords, ballCoords) < DribbleErrorRadius
            }
            if (goal.type === "attack") {
                // TODO
                return false
            }
            console.log(`Unknown goal ${goal.type}`)
            return true
        }

        let isAchievingGoal = function (goal) {
            if (goal.type === "dribble") {
                let goalCoords = goal.coords
                let ballCoords = ball.estimateCoords(0)
                let goalDirectionVector = Utils.vectorFromPoints(ballCoords, goalCoords)
                let ballVelocity = ball.estimateVelocity(0)
                if (Utils.vectorLength(ballVelocity) < 0.6) return false
                let diff = Utils.vectorDirection(ballVelocity, goalDirectionVector)
                return Math.abs(diff) < 20
            }
            return false
        }

        while (isGoalAchieved(goals[currentGoalIndex])) {
            currentGoalIndex = (currentGoalIndex + 1) % goals.length
        }

        let goal = goals[currentGoalIndex]
        let nextGoal = goals[(currentGoalIndex + 1) % goals.length]
        if (isAchievingGoal(nextGoal) && !isAchievingGoal(goal)) {
            goal = nextGoal
            currentGoalIndex = (currentGoalIndex + 1) % goals.length
        }

        data.processGoal = {
            goal: goal
        }
        data.selectGoal.currentIndex = currentGoalIndex
        return tree.callState("process_goal")
    },
    stateProcessGoal(tree, data) {
        let goal = data.processGoal.goal

        if (goal.type === "dribble") {
            data.teamDribble = {
                target: { coords: goal.coords }
            }
            return tree.callState("team_dribble")
        }

        if (goal.type === "attack") {
            return tree.callState("team_attack")
        }

        console.log(`unknown goal ${goal.type}`)
        return tree.callState('find_ball')
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