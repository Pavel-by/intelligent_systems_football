const Utils = require("./utils")
const Coords = require("./coordinates")

const BALL_HISTORY_DEPTH = 15
const OPTIMAL_INTERCEPT_SPEED = 0.3
const DANGER_INTERCEPT_SPEED = 0.6
const MAX_ANALYZE_DEPTH = 20

class Manager {
    constructor(agent) {
        this.agent = agent
        this.allies = []
        this.enemies = []
        this.ball = null
        this.tree = new StateTree(this)
    }

    onTick() {
        let cmd = this.tree.makeCmd()
        this.agent.act = cmd
    }

    analyze(cmd, p) {
        if (cmd === 'hear' && p[2] === '"kick"')
            this.ball = null
        if (cmd === 'see') {
            this._updateObjects()
        }
    }

    estimateBallCoords(depth) {
        return this._estimateCoords(this.ball, depth, this.agent.params.ball_decay) ?? this.ball?.coords
    }

    analyzeBallIntercepts() {
        let depth = 0
        let result = []
        let playerMaxSpeed = this.agent.params.player_speed_max
        let ballCoords = this.ball?.coords
        if (ballCoords == null) return null

        let isOptimal = (coords) => {
            if (!coords) return false
            let distance = Coords.distance(ballCoords, coords)
            return distance <= depth * playerMaxSpeed * OPTIMAL_INTERCEPT_SPEED
        }

        let isDanger = (coords) => {
            if (!coords) return false
            let distance = Coords.distance(ballCoords, coords)
            return distance <= depth * playerMaxSpeed * DANGER_INTERCEPT_SPEED
        }

        while (result.length == 0 || !result[result.length - 1].isOptimal) {
            ballCoords = this._estimateCoords(this.ball, depth, this.agent.params.ball_decay) ?? ballCoords
            if (!ballCoords) return null
            let cur = {
                depth: depth,
                isOptimal: isOptimal(this.agent.position.coords),
                isDanger: isDanger(this.agent.position.coords),
                hasAllyOptimal: false,
                hasAllyDanger: false,
                coords: ballCoords,
                optimalAllies: [],
                dangerAllies: [],
                hasEnemyOptimal: false,
                hasEnemyDanger: false,
            }

            for (let ally of this.allies) {
                let allyOptimal = isOptimal(ally.coords)
                let allyDanger = isDanger(ally.coords)
                cur.hasAllyOptimal |= allyOptimal
                cur.hasAllyDanger |= allyDanger
                if (allyOptimal)
                    cur.optimalAllies.push(ally)
                if (allyDanger)
                    cur.dangerAllies.push(ally)
            }

            for (let enemy of this.enemies) {
                let enemyOptimal = isOptimal(enemy.coords)
                let enemyDanger = isDanger(enemy.coords)
                cur.hasEnemyOptimal |= enemyOptimal
                cur.hasEnemyDanger |= enemyDanger
            }

            result.push(cur)
            depth++
        }

        return result
    }

    calculateAllyGatesCoords() {
        return {
            x: this.agent.side === 'l' ? -52.5 : 52.5,
            y: 0
        }
    }

    calculateEnemyGatesCoords() {
        return {
            x: this.agent.side === 'l' ? 52.5 : -52.5,
            y: 0
        }
    }

    _updateObjects() {
        this.allies = [];
        this.enemies = [];

        let visibleBallInfo = null
        for (let obj of this.agent.position.objects) {
            if (obj.isBall) {
                visibleBallInfo = obj
            }
            if (obj.isAlly) {
                this.allies.push(obj)
            }
            if (obj.isEnemy) {
                this.enemies.push(obj)
            }
        }
        this._updateBall(visibleBallInfo)
    }

    _updateBall(visibleBallInfo) {
        let position = this.calculateObjectPositioning(visibleBallInfo)
        if (!position) {
            position = this.calculateObjectPositioning({
                coords: this.estimateBallCoords(1)
            })
        }
        this.ball = {
            visible: visibleBallInfo != null,
            old: this.ball,
        }

        if (position && position.distanceEstimated) {
            this.ball.direction = position.direction
            let estimatedCoords = _estimateCoords(this.ball.old, 1, this.agent.params.ball_decay)
            if (estimatedCoords) {
                this.ball.distance = Coords.distance(this.agent.position.coords, estimatedCoords)
                this.ball.coords = this.calculateObjectPositioning(this.ball).coords
            } else {
                this.ball.distance = position.distance
                this.ball.coords = position.coords
                this.ball.unknownPosition = true
            }
        } else if (position) {
            this.ball.direction = position.direction
            this.ball.distance = position.distance
            this.ball.coords = position.coords
        } else {
            this.ball.coords = this.ball.old?.coords
        }
        this.ball.velocity = this._calculateVisibleVelocity(visibleBallInfo)

        if (!this.agent.position.coordsEnsured)
            this.ball.old = null

        this._wipeExtraSpack(this.ball, BALL_HISTORY_DEPTH)
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

    estimateBallCoords(depth) {
        return this._estimateCoords(this.ball, depth, this.agent.params.ball_decay)
    }

    estimateBallVelocityNormalized() {
        let ball = this.ball
        let directions = []
        while (ball) {
            if (ball.velocity) {
                let curDirection = Utils.vectorDirection(ball.velocity, { x: 1, y: 0 })
                directions.push(curDirection)
            }
            ball = ball.old
        }
        if (directions.length == 0) return null
        let direction = directions.reduce((total, cur) => total + cur, 0) / directions.length
        return Utils.rotateVector({ x: 1, y: 0 }, direction)
    }

    _estimateCoords(obj, depth, decay) {
        if (!obj || !obj.coords) return null
        if (depth <= 0) return obj.coords

        if (!obj.velocity) {
            if (obj.old) {
                return this._estimateCoords(obj.old, depth + 1, decay)
            }
            return null
        }

        let velocity = obj.velocity
        let progression = (1 - decay ** depth) / (1 - decay)
        if (Utils.vectorLength(velocity) < 0.1) return null;
        let offset = {
            x: velocity.x * progression,
            y: velocity.y * progression
        }
        let coords = {
            x: obj.coords.x + offset.x,
            y: obj.coords.y + offset.y,
        }
        let oldEstimating = this._estimateCoords(obj.old, depth + 1, decay)
        if (oldEstimating)
            coords = {
                x: (coords.x + 0.8 * oldEstimating.x) / 1.8,
                y: (coords.y + 0.8 * oldEstimating.y) / 1.8
            }
        return coords
    }

    _estimateCurrentVelosity(obj, decay) {
        if (!obj || !obj.old || !obj.coords || !obj.old.coords || obj.old.unknownPosition) return null
        let old = obj.old
        return {
            x: (obj.coords.x - old.coords.x) * decay,
            y: (obj.coords.y - old.coords.y) * decay
        }
    }

    _wipeExtraSpack(obj, maxDepth) {
        if (!obj) return

        let depth = 1
        while (depth < maxDepth && obj.old) {
            obj = obj.old
            depth++
        }
        obj.old = null
    }

    calculateObjectPositioning(obj) {
        if (!Utils.isObject(obj)) return null
        let result = {
            coords: obj.coords,
            direction: obj.direction,
            distance: obj.distance,
        }
        if (!Utils.isObject(result.coords)) {
            if (!Utils.isNumber(result.direction)) return null
            if (!Utils.isNumber(result.distance)) {
                result.distanceEstimated = true
                result.distance = 100
            }
            this.agent.position.setupObjCoords(result)
        }

        if (Utils.isObject(result.coords) && Utils.isObject(this.agent.position.coords)) {
            if (!Utils.isNumber(result.distance))
                result.distance = Coords.distance(result.coords, this.agent.position.coords)
            if (!Utils.isNumber(result.direction)) {
                let vec = this.agent.position.makeNormalVec(this.agent.position.coords, result.coords)
                let zeroVec = this.agent.position.zeroVec
                let direction = (Math.atan2(vec.y, vec.x) - Math.atan2(zeroVec.y, zeroVec.x)) * 180 / Math.PI
                if (direction < -180) direction += 360
                if (direction > 180) direction -= 360
                result.direction = -direction
            }
        }

        if (Utils.isNumber(result.direction) && Utils.isNumber(result.distance) && Utils.isObject(result.coords))
            return result

        return null
    }
}

class StateTree {
    constructor(manager) {
        this.manager = manager
        this.mem = new Memory()
        this.states = {
            "init": (t) => CommonStates.stateInit(t),
            "find_ball": (t) => CommonStates.stateFindBall(t),
            "dribble": (t) => CommonStates.stateDribble(t),
            "move": (t) => CommonStates.stateMove(t),

            "team_attack": (t) => AttackerTeamStates.stateTeamAttack(t),
            "team_dribble": (t) => AttackerTeamStates.stateTeamDribble(t),
            "team_follow": (t) => AttackerTeamStates.stateTeamFollow(t),

            "select_goal": (t) => GoalStates.stateSelectGoal(t),
            "process_goal": (t) => GoalStates.stateProcessGoal(t),

            "goalie": (t) => GoalieStates.stateGoalie(t),
            "goalie_intercept": (t) => GoalieStates.stateGoalieIntercept(t),
            "goalie_kick_out": (t) => GoalieStates.stateGoalieKickOut(t),
            "goalie_catch": (t) => GoalieStates.stateGoalieCatch(t),
        }
        this.data = {}
    }

    makeCmd() {
        this.mem.increaseAge()
        this._cmd = null
        this.callState("init")
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
        this.finish({ n: 'catch', v: direction})
    }
}

const CommonStates = {
    stateInit(tree) {
        let manager = tree.manager
        let data = tree.data
        let ball = manager.ball
        let firstVisible = -1;
        for (let i = 0; ;) {
            if (!ball) break;
            if (ball.visible) {
                firstVisible = i;
                break;
            }
            i++
            ball = ball.old
        }

        data.params = manager.agent.params
        data.agent = manager.agent

        if (firstVisible == -1 || firstVisible > 10) {
            return tree.callState("find_ball")
        }
        data.ball = manager.ball
        data.intercepts = manager.analyzeBallIntercepts()
        data.estimatedBallCoords = ball?.coords
        return tree.callState("select_goal")
    },
    stateFindBall(tree) {
        let data = tree.data
        let estimatedDirection = null

        if (data.estimatedBallCoords) {
            let ballPosition = tree.manager.calculateObjectPositioning({ coords: data.estimatedBallCoords })
            if (Utils.isNumber(ballPosition.direction))
                estimatedDirection = ballPosition.direction
        }
        if (Utils.isNumber(data.estimatedBallDirection)) {
            estimatedDirection = data.estimatedBallDirection
        }
        data.estimatedBallCoords = null
        data.estimatedBallDirection = null
        if (estimatedDirection != null)
            return tree.finishTurn(estimatedDirection)
        return tree.finishTurn(90)
    },
    stateDribble(tree) {
        let data = tree.data
        let target = tree.manager.calculateObjectPositioning(data.dribbleTarget)
        data.dribbleTarget = null
        let power = data.dribblePower ?? 60
        data.dribblePower = null
        let kickMargin = data.params.kickable_margin
        let agentCoords = data.agent.position.coords
        let ballCoords = data.ball.coords
        let distanceToBall = Coords.distance(agentCoords, ballCoords)

        if (distanceToBall < kickMargin)
            return tree.finishKick(35 * power / 100, target.direction)

        //if (distanceToBall > 2)
        for (let intercept of data.intercepts) {
            if (intercept.isOptimal) {
                data.moveTarget = { coords: intercept.coords }
                data.movePower = power
                return tree.callState("move")
            }
        }
        data.moveTarget = { coords: ballCoords }
        data.movePower = power
        return tree.callState("move")
    },
    stateMove(tree) {
        let manager = tree.manager
        let data = tree.data
        let target = manager.calculateObjectPositioning(data.moveTarget)
        let power = data.movePower ?? 70
        data.movePower = null
        data.moveTarget = null

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
    stateTeamAttack(tree) {
        let data = tree.data
        let target = tree.manager.calculateObjectPositioning({coords: tree.manager.calculateEnemyGatesCoords()})
        let ball = data.ball
        let agentCoords = data.agent.position.coords
        data.teamFollowBallOwners = []
        for (let intercept of data.intercepts) {
            if (intercept.isOptimal) {
                data.dribbleTarget = target
                let kickMargin = data.params.kickable_margin
                let distanceToBall = Coords.distance(agentCoords, ball.coords)
                if (distanceToBall < kickMargin && target.distance < 25)
                    return tree.finishKick(100, target.direction)
                return tree.callState("dribble")
            }
            if (intercept.hasAllyOptimal) {
                data.teamFollowCoords = ball.coords
                data.teamFollowDirection = Utils.normalize(Utils.vectorFromPoints(ball.coords, target.coords))
                for (let ally of intercept.optimalAllies)
                    if (Utils.isNumber(ally.uniformNumber))
                        data.teamFollowBallOwners.push(ally.uniformNumber)
                return tree.callState("team_follow")
            }
        }

        return tree.callState("find_ball")
    },
    stateTeamDribble(tree) {
        let data = tree.data
        let target = data.teamDribbleTarget
        let ball = data.ball
        data.teamDribbleTarget = null
        data.teamFollowBallOwners = []
        for (let intercept of data.intercepts) {
            if (intercept.isOptimal) {
                data.dribbleTarget = target
                return tree.callState("dribble")
            }
            if (intercept.hasAllyOptimal) {
                data.teamFollowCoords = ball.coords
                data.teamFollowDirection = Utils.normalize(Utils.vectorFromPoints(ball.coords, target.coords))
                for (let ally of intercept.optimalAllies)
                    if (Utils.isNumber(ally.uniformNumber))
                        data.teamFollowBallOwners.push(ally.uniformNumber)
                return tree.callState("team_follow")
            }
        }

        return tree.callState("find_ball")
    },
    stateTeamFollow(tree) {
        const FollowDistance = 10
        const FollowAngle = 30
        const FollowErrorRadius = 2

        let data = tree.data
        let targetCoords = data.teamFollowCoords
        let targetDirection = Utils.normalize(data.teamFollowDirection)
        let agentCoords = data.agent.position.coords
        data.teamFollowCoords = null
        data.teamFollowDirection = null
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
            let allies = tree.manager.allies
            let ballOwners = data.teamFollowBallOwners
            for (let ally of allies) {
                if (!ally?.coords) continue
                let allyDistancePreferred = Coords.distance(ally.coords, preferrecCoords)
                let allyDistanceSecondary = Coords.distance(ally.coords, secondaryCoords)
                let agentDistance = Coords.distance(agentCoords, preferrecCoords)

                /*if (Coords.distance(ally.coords, preferrecCoords) < FollowErrorRadius)
                    return false*/

                if (!ballOwners.includes(ally.uniformNumber) && allyDistancePreferred < allyDistanceSecondary && agentDistance > allyDistancePreferred)
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

        data.moveTarget = { coords: selectedCoords }
        data.movePower = Coords.distance(agentCoords, selectedCoords) > 10 ? 100 : 70
        tree.callState("move")
    },
}

const GoalieStates = {
    stateGoalie(tree) {
        let data = tree.data
        let ball = data.ball
        if (!ball?.coords) return tree.callState("find_ball")
        let gatesCoords = tree.manager.calculateAllyGatesCoords()
        let ballVector = Utils.normalize(Utils.vectorFromPoints(gatesCoords, ball.coords))
        ballVector = Utils.multVector(ballVector, 7.5)
        ballVector.x /= 4
        ballVector.y *= 0.8
        let optimalCoords = Utils.sumVector(gatesCoords, ballVector)

        if (Coords.distance(ball.coords, gatesCoords) < 10)
            return tree.callState("goalie_intercept")

        for (let intercept of data.intercepts) {
            if (intercept.hasEnemyOptimal || intercept.hasEnemyDanger) break
            if (Coords.distance(intercept.coords, gatesCoords) < 20 && (intercept.isOptimal || intercept.isDanger)) {
                return tree.callState("goalie_intercept")
            }
        }

        let agentCoords = data.agent.position.coords
        if (Coords.distance(agentCoords, optimalCoords) > 1.5) {
            data.moveTarget = {coords: optimalCoords}
            data.movePower = 80
            return tree.callState("move")
        }
        return tree.callState("find_ball")
    },
    stateGoalieIntercept(tree) {
        let data = tree.data

        let agentCoords = data.agent.position.coords
        let ballCoords = data.ball.coords
        if (Coords.distance(ballCoords, agentCoords) < 0.5)
            return tree.callState("goalie_kick_out")
        if (Coords.distance(ballCoords, agentCoords) < data.params.catchable_area_l) 
            return tree.callState("goalie_catch")

        let selectedIntercept = null
        let firstDanger = null
        for (let intercept of data.intercepts) {
            if (intercept.isDanger && firstDanger == null)
                firstDanger = intercept
            if (firstDanger != null && (intercept.hasEnemyOptimal || intercept.hasEnemyDanger)) {
                selectedIntercept = firstDanger
                break
            }
            if (intercept.isOptimal) {
                selectedIntercept = intercept
                break
            }
        }
        data.moveTarget = {coords: selectedIntercept.coords}
        data.movePower = 100
        return tree.callState("move")
    },
    stateGoalieKickOut(tree) {
        let data = tree.data
        let agentSide = data.agent.side
        let gatesTop = agentSide == 'l' ? Coords.fglt : Coords.fgrt
        let gatesBottom = agentSide == 'l' ? Coords.fglb : Coords.fgrb
        let agentCoords = data.agent.position.coords
        let agentZero = data.agent.position.zeroVec
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
        let freeDirectionVector = Utils.normalize(Utils.vectorFromPoints(agentCoords, {x: 0, y: 10}))
        let freeDirection = Utils.vectorDirection(freeDirectionVector, agentZero)
        return tree.finishKick(100, freeDirection)
    },
    stateGoalieCatch(tree) {
        let data = tree.data
        let ballPosition = tree.manager.calculateObjectPositioning(data.ball)
        let ballDirection = ballPosition.direction
        return tree.finishCatch(ballDirection)
    }
}

const GoalStates = {
    stateSelectGoal(tree) {
        if (tree.data.agent.isGoalie)
            return tree.callState("goalie")

        const DribbleErrorRadius = 3

        let data = tree.data
        let goals = data.agent.goals
        let currentGoalIndex = data.selectGoalCurrentIndex ?? 0

        let isGoalAchieved = function (goal) {
            if (goal.type === "dribble") {
                let goalCoords = goal.coords
                let ballCoords = data.ball.coords
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
                let ballCoords = data.ball.coords
                let goalDirectionVector = Utils.vectorFromPoints(ballCoords, goalCoords)
                let ballVelocity = data.ball.velocity
                if (!ballVelocity || Utils.vectorLength(ballVelocity) < 0.6) return false
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

        data.goal = goal
        data.selectGoalCurrentIndex = currentGoalIndex
        return tree.callState("process_goal")
    },
    stateProcessGoal(tree) {
        let data = tree.data
        let goal = data.goal

        if (goal.type === "dribble") {
            data.teamDribbleTarget = { coords: goal.coords }
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

module.exports = Manager;