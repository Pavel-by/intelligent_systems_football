const utils = require('./utils')
const coords = require('./coordinates')

const MAX_MOVE_DIR_DIFF = 10
const FLAG_PRESISION = 3.0
const BALL_PRESISION = 0.5

class Controller {
    constructor(agent) {
        this.agent = agent
        this.estimatedBallDirection = null

        this.targets = [
            { coords: { x: -20, y: -20 }, t: 'dribble' },
            { coords: { x: 20, y: -20 }, t: 'dribble' },
            { coords: { x: 20, y: 20 }, t: 'dribble' },
            { coords: { x: -20, y: 20 }, t: 'dribble' },
        ]
        this.targetIndex = 0
    }

    onTick() {
        if (this.agent.act != null) return
        if (this.agent.gameStatus !== 'play_on') {
            return
        }
        let targetsTried = 0
        while (targetsTried < this.targets.length) {
            let act = null;
            let target = this.targets[this.targetIndex]
            if (target.t === 'move')
                act = this.constructMoveAct(target)
            if (target.t === 'dribble')
                act = this.constructDribbleAct(target)
            if (target.t === 'goal')
                act = this.constructGoalAct()

            if (act !== null) {
                this.agent.act = act
                break
            }
            this.targetIndex = (this.targetIndex + 1) % this.targets.length
            targetsTried++
        }
        if (targetsTried.length === this.targets.length)
            console.log("Give me a goal, sir")
    }

    constructGoalAct() {
        let ball = this._findBall()
        if (ball === null)
            return this.constructFindBallAct()

        if (!ball.coords || coords.distance(ball.coords, coords.gr) > 30)
            return this.constructDribbleAct({ coords: coords.gr })

        if (ball.distance > BALL_PRESISION)
            return this.constructMoveAct(ball, BALL_PRESISION, 100)

        let target = this._prepareTarget({ coords: coords.gr })
        return this._makeKick(100, target.direction)
    }

    constructMoveAct(target, presision = FLAG_PRESISION, power = 70) {
        target = this._prepareTarget(target)
        if (target === null) {
            console.log("failed to prepare target")
            return null
        }
        if (target.distance < presision)
            return null

        if (Math.abs(target.direction) > MAX_MOVE_DIR_DIFF)
            return this._makeTurn(target.direction)

        return this._makeDash(power)
    }

    constructDribbleAct(target, presision = FLAG_PRESISION, power = 70) {
        target = this._prepareTarget(target)
        if (target == null) {
            console.log("failed to prepare target")
            return null
        }

        let ball = this._findBall()
        if (ball == null) return this.constructFindBallAct();

        if (coords.distance(ball.coords, target.coords) < presision)
            return null

        if (ball.distance < BALL_PRESISION) {
            this.estimatedBallDirection = target.direction
            return this._makeKick(35 * power / 100, target.direction)
        }

        return this.constructMoveAct(ball, BALL_PRESISION, power)
    }

    constructFindBallAct() {
        if (this._findBall() !== null) return null
        if (this.estimatedBallDirection != null) {
            let direction = this.estimatedBallDirection
            this.estimatedBallDirection = 0
            return this._makeTurn(direction)
        }
        return this._makeTurn(90)
    }

    _findBall() {
        if (!this.agent.position.objects) return null
        for (let obj of this.agent.position.objects) {
            if (obj.isBall) {
                this.estimatedBallDirection = null
                return obj
            }
        }
        return null
    }

    _prepareTarget(target) {
        if (!utils.isObject(target)) return null
        let result = {
            coords: target.coords,
            direction: target.direction,
            distance: target.distance,
        }
        if (!utils.isObject(result.coords)) {
            if (!utils.isNumber(result.direction)) return null
            if (!utils.isNumber(result.distance)) result.distance = 100
            this.agent.position.setupObjCoords(result)
        }

        if (utils.isObject(result.coords) && utils.isObject(this.agent.position.coords)) {
            if (!utils.isNumber(result.distance))
                result.distance = coords.distance(result.coords, this.agent.position.coords)
            if (!utils.isNumber(result.direction)) {
                let vec = this.agent.position.makeNormalVec(this.agent.position.coords, result.coords)
                let zeroVec = this.agent.position.zeroVec
                let direction = (Math.atan2(vec.y, vec.x) - Math.atan2(zeroVec.y, zeroVec.x)) * 180 / Math.PI
                if (direction < -180) direction += 360
                if (direction > 180) direction -= 360
                result.direction = -direction
            }
        }

        if (utils.isNumber(result.direction) && utils.isNumber(result.distance))
            return result

        return null
    }

    _makeTurn(turn) {
        return { n: 'turn', v: turn }
    }

    _makeDash(power) {
        return { n: 'dash', v: power }
    }

    _makeKick(power, direction = 0) {
        return { n: 'kick', v: [power, direction] }
    }
}

module.exports = Controller;