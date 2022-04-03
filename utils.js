const Coords = require('./coordinates')

module.exports = {
    isObject(obj) {
        return !this.isNull(obj) && typeof obj === 'object';
    },
    isString(obj) {
        return !this.isNull(obj) && typeof obj === 'string';
    },
    isNumber(obj) {
        return !this.isNull(obj) && typeof obj === 'number' && obj !== NaN;
    },
    isNull(obj) {
        return obj === null || obj === undefined;
    },
    clamp(n, b, t) {
        return Math.min(t, Math.max(b, n))
    },
    rotateVector(vec, angle, inRadian = false) {
        if (!inRadian)
            angle = angle / (180 / Math.PI)

        let sin_b = Math.sin(angle);
        let cos_b = Math.cos(angle);

        return {
            x: vec.x * cos_b + vec.y * sin_b,
            y: -vec.x * sin_b + vec.y * cos_b
        }
    },
    vectorDirection(v, base) {
        var angle = (Math.atan2(v.y, v.x) - Math.atan2(base.y, base.x)) * 180 / Math.PI
        if (angle < -180) angle += 360
        if (angle > 180) angle -= 360
        return -angle
    },
    vectorLength(v) {
        return Math.sqrt(v.x ** 2 + v.y ** 2)
    },
    multVector(v, multiplier) {
        return {
            x: v.x * multiplier,
            y: v.y * multiplier
        }
    },
    sumVector(p, v) {
        return {
            x: p.x + v.x,
            y: p.y + v.y
        }
    },
    normalize(v) {
        let len = Math.sqrt(v.x ** 2 + v.y ** 2)
        return {
            x: v.x / len,
            y: v.y / len
        }
    },
    vectorFromPoints(start, end) {
        return {
            x: end.x - start.x,
            y: end.y - start.y,
        }
    },
    removeEdgeQuotes(s) {
        const quotes = '"\''
        let start = 0
        let end = s.length
        if (quotes.includes(s[0]))
            start = 1
        if (quotes.includes(s[s.length - 1]))
            end = s.length - 1
        return s.substring(start, end)
    },
    calculateObjectPositioning(agent, obj) {
        let Utils = this
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
            agent.position.setupObjCoords(result)
        }

        if (Utils.isObject(result.coords) && Utils.isObject(agent.position.coords)) {
            if (!Utils.isNumber(result.distance))
                result.distance = Coords.distance(result.coords, agent.position.coords)
            if (!Utils.isNumber(result.direction)) {
                let vec = agent.position.makeNormalVec(agent.position.coords, result.coords)
                let zeroVec = agent.position.zeroVec
                let direction = (Math.atan2(vec.y, vec.x) - Math.atan2(zeroVec.y, zeroVec.x)) * 180 / Math.PI
                if (direction < -180) direction += 360
                if (direction > 180) direction -= 360
                result.direction = -direction
            }
        }

        if (Utils.isNumber(result.direction) && Utils.isNumber(result.distance) && Utils.isObject(result.coords))
            return result

        return null
    },
    calculateAllyGatesCoords(agent) {
        return {
            x: agent.side === 'l' ? -52.5 : 52.5,
            y: 0
        }
    }, 
    calculateEnemyGatesCoords(agent) {
        return {
            x: agent.side === 'l' ? 52.5 : -52.5,
            y: 0
        }
    },
    selectRandom(values, probs = null, exclude = []) {
        if (values.length == 0) return null
        if (!probs || probs.length != values.length) {
            probs = Array.from({length: values.length}, (_) => 1)
        }
        let probsSum = probs.reduce((a, b) => a + b, 0)
        if (probsSum == 0) {
            console.trace("Probs sum == 0")
        }
        let result = null;
        let tries = 0
        while (result == null && tries < 1000) {
            tries++
            let rnd = Math.random() * probsSum
            let i = 0
            for (; i < values.length && rnd > 0; i++) {
                rnd -= probs[i]
            }
            i -= 1
            if (!exclude.includes(values[i]))
                result = values[i]
        }
        if (tries >= 1000) {
            console.trace("Too many tries in selectRandom")
        }
        return result
    }
}