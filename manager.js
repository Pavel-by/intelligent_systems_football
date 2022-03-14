const Utils = require("./utils")
const Coords = require("./coordinates")

const BALL_HISTORY_DEPTH = 5

class Manager {
    constructor(agent) {
        this.agent = agent
        this.allies = []
        this.enemies = []
        this.ball = null
    }

    analyze(cmd, p) {
        if (cmd === 'hear' && p[2] === '"kick"')
            this.ball?.old = null
        if (cmd === 'see')
            this._updateObjects()
    }

    _updateObjects() {
        this.allies.forEach((e) => e.visible = false);
        this.enemies.forEach((e) => e.visible = false);

        let visibleBallInfo = null
        for (let obj of this.agent.position.objects) {
            if (obj.isBall) {
                visibleBallInfo = obj
            }
        }
        this._updateBall(visibleBallInfo)
    }

    _updateBall(visibleBallInfo) {
        this.ball = {
            visible: visibleBallInfo != null,
            old: this.ball,
        }
        let position = this._calculateObjectPositioning(visibleBallInfo)
        
        if (position && position.distanceEstimated) {
            this.ball.direction = position.direction
            let estimatedCoords = _estimateCoords(this.ball.old, 1, this.agent.params.ball_decay)
            if (estimatedCoords) {
                this.ball.distance = Coords.distance(this.agent.position.coords, estimatedCoords)
                this.ball.coords = this._calculateObjectPositioning(this.ball).coords
            } else {
                this.ball.distance = position.distance
                this.ball.coords = position.coords
                this.ball.unknownPosition = true
            }
        }

        this._wipeExtraSpack(this.ball, BALL_HISTORY_DEPTH)
    }

    _estimateCoords(obj, depth, decay) {
        if (!obj || !obj.coords) return null
        if (depth <= 0) return obj.coords
        let velocity = obj.velocity ?? this._estimateCurrentVelosity(obj, decay)
        let progression = (1 - decay ** depth) / (1 - decay)
        let coords = {
            x: velocity.x * progression,
            y: velocity.y * progression
        }
        let oldEstimating = this._estimateCoords(obj.old, depth + 1, decay)
        if (oldEstimating)
            coords = {
                x: (coords.x + 0.8*oldEstimating.x) / 1.8,
                y: (coords.y + 0.8*oldEstimating.y) / 1.8
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
        }
        obj.old = null
    }

    _calculateObjectPositioning(obj) {
        if (!Utils.isObject(target)) return null
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
                result.distance = coords.distance(result.coords, this.agent.position.coords)
            if (!Utils.isNumber(result.direction)) {
                let vec = this.agent.position.makeNormalVec(this.agent.position.coords, result.coords)
                let zeroVec = this.agent.position.zeroVec
                let direction = (Math.atan2(vec.y, vec.x) - Math.atan2(zeroVec.y, zeroVec.x)) * 180 / Math.PI
                if (direction < -180) direction += 360
                if (direction > 180) direction -= 360
                result.direction = -direction
            }
        }

        if (Utils.isNumber(result.direction) && Utils.isNumber(result.distance) && Utils.isNull(result.coords))
            return result

        return null
    }
}