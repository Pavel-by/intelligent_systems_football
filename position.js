const Coords = require("./coordinates")
const Utils = require("./utils")

const MIN_ANGLE = 1

class Position {
    constructor(agent) {
        this.agent = agent
        this.coords = null
        this.coordsError = null
        this.zeroVec = null
        this.zeroVecError = null
        this.objects = null
        this.coordsNotEnsuredTicks = 100
    }

    analyze(cmd, p) {
        if (cmd !== "see") return false
        if (!Array.isArray(p)) {
            console.log('Invalid parameters were got in Position.analyzeSee')
            console.log(p)
            return
        }

        for (let i of p) {
            if (typeof i != 'object' || Array.isArray(i)) continue
            this._setupObjInfo(i)
        }

        this._analyzeObjInfos(p)
        this.objects = p
        return true
    }

    _setupObjInfo(data) {
        if (!data.p || !data.cmd || !data.cmd.p || !Array.isArray(data.p)) return
        let cmd = data.cmd.p
        let p = data.p
        let flagName = Array.isArray(cmd) ? cmd.join("") : cmd
        data.coords = Coords[flagName] ?? null
        data.distance = null
        data.direction = null
        data.distChange = null
        data.dirChange = null
        data.bodyFacingDir = null
        data.headFacingDir = null

        if (p.length === 1) {
            data.direction = p[0]
        } else if (p.length === 2) {
            data.distance = p[0]
            data.direction = p[1]
        } else if (p.length === 4) {
            data.distance = p[0]
            data.direction = p[1]
            data.distChange = p[2]
            data.dirChange = p[3]
        } else if (p.length === 6) {
            data.distance = p[0]
            data.direction = p[1]
            data.distChange = p[2]
            data.dirChange = p[3]
            data.bodyFacingDir = p[4]
            data.headFacingDir = p[5]
        } else {
            console.log("Failed to parse see ObjInfo - unexpected parameters count")
            console.log(p)
            throw "Failed to parse see ObjInfo - unexpected parameters count"
        }

        if (data.coords !== null)
            data.isFlag = true

        if (flagName.toLowerCase() === "b") {
            data.isBall = true
        }

        if (Array.isArray(cmd) && cmd.length > 0 && cmd[0].toLowerCase() === "p") {
            data.isPlayer = true
            if (cmd.length > 1) {
                data.teamname = Utils.removeEdgeQuotes(cmd[1])
                data.isAlly = data.teamname === this.agent.teamname
                data.isEnemy = !data.isAlly
            }

            if (cmd.length > 2) {
                data.uniformNumber = parseInt(cmd[2])
            }

            if (cmd.length > 3) {
                data.isGoalie = true
            }
        }
    }

    _analyzeObjInfos(infos) {
        let flags = infos.filter(info => info.coords)
        flags.sort((a, b) => {
            let d1 = a.distance ?? -1, d2 = b.distance ?? -1
            return d1 - d2
        })
        let flags_copy = flags.slice()
        let min_error = null, best_coords = null
        while (true) {
            let coords = this._computeSelfPosition(flags_copy)
            if (coords === null) break;

            let error = this._computeSelfDistanceError(flags, coords)
            if (min_error === null || min_error > error) {
                min_error = error; best_coords = coords
            }
            flags_copy.shift()
        }
        if (best_coords !== null) {
            this.coords = best_coords
            this.coordsError = min_error
            this.coordsEnsured = true
            this.coordsNotEnsuredTicks = 0
        } else {
            //console.log("Failed to compute self coords; estimating self coords");
            var act = this.agent.lastAct
            if (act.n === 'turn') {
                let turn = act.v;
                this.zeroVec = Utils.rotateVector(this.zeroVec, turn);
            }
            let relativeSpeed = this.agent.sense.relativeSpeed()
            let zeroDirection = Utils.vectorDirection(this.zeroVec, {x:1,y:0})
            let absoluteSpeed = Utils.rotateVector(relativeSpeed, zeroDirection)
            this.coords = {
                x: this.coords.x + absoluteSpeed.x,
                y: this.coords.y + absoluteSpeed.y
            }
            this.coordsEnsured = false
            this.coordsNotEnsuredTicks++
        }

        if (this.coords !== null) {
            let best_zero_vec = null, best_zero_vec_error = null

            for (let flag of flags) {
                let zero_vec = this._rotateVec(this.makeNormalVec(this.coords, flag.coords), flag.direction, true)
                let zero_vec_error = this._computeZeroVecError(flags, zero_vec)
                if (best_zero_vec_error === null || best_zero_vec_error > zero_vec_error) {
                    best_zero_vec = zero_vec
                    best_zero_vec_error = zero_vec_error
                }
            }

            if (best_zero_vec !== null) {
                this.zeroVec = best_zero_vec
                this.zeroVecError = best_zero_vec_error
            }

            if (this.zeroVec !== null) {
                for (let obj of infos)
                    this.setupObjCoords(obj)
            }
        }
    }

    setupObjCoords(obj) {
        if (typeof obj !== 'object') return
        if (obj.coords != null) return
        if (this.zeroVec === null || obj.distance === null || obj.direction === null) return
        let vec = this._rotateVec(this.zeroVec, -obj.direction, true)
        vec.x *= obj.distance
        vec.y *= obj.distance
        obj.coords = {
            x: this.coords.x + vec.x,
            y: this.coords.y + vec.y
        }
    }

    _computeZeroVecError(flags, zero_vec) {
        let error = 0
        for (let flag of flags) {
            if (flag.coords === null) continue
            let f_vec = this.makeNormalVec(this.coords, flag.coords)
            let test_direction = Math.acos(zero_vec.x * f_vec.x + zero_vec.y + f_vec.y)
            let visible_direction = flag.direction * (Math.PI / 180)
            error += Math.abs(test_direction - visible_direction)
        }
        return error
    }

    makeNormalVec(p1, p2) {
        let vec = {
            x: p2.x - p1.x,
            y: p2.y - p1.y
        }
        let vec_len = Math.sqrt(vec.x ** 2 + vec.y ** 2)
        vec.x /= vec_len
        vec.y /= vec_len
        return vec
    }

    _computeSelfDistanceError(flags, coords) {
        let error = 0
        for (let flag of flags) {
            if (flag.distance === null || flag.direction === null || flag.coords === null) continue
            let estimated = Coords.distance(coords, flag.coords)
            error += Math.abs(estimated - flag.distance)
            //error = Math.max(Math.abs(estimated - flag.distance), error)
        }
        return error
    }

    _computeSelfPosition(flags) {
        if (flags.length < 2) {
            return null
        }

        let f1 = flags[0], f2 = flags[1]
        let d = Coords.distance(f1.coords, f2.coords)
        let alpha = (f1.direction - f2.direction) / 180 * Math.PI
        if (f1.distance === null) {
            return null
        }
        let d1 = f1.distance, d2 = 0

        if (f2.distance === null) {
            let cos_a = Math.cos(alpha)
            let D = (2 * d1 * cos_a) ** 2 - 4 * (d1 ** 2- d ** 2)
            if (D < 0) {
                D = 0
            }
            d2 = (2 * d1 * cos_a + Math.sqrt(D)) / 2
        } else {
            d2 = f2.distance
        }

        if (alpha < 0) {
            let t = f1; f1 = f2; f2 = t
            t = d1; d1 = d2; d2 = t
        }
        let vec = {
            x: f2.coords.x - f1.coords.x,
            y: f2.coords.y - f1.coords.y
        }
        let vec_len = Math.sqrt(vec.x ** 2 + vec.y ** 2)
        vec.x = vec.x / vec_len
        vec.y = vec.y / vec_len
        let cos_b = Utils.clamp((d ** 2 + d1 ** 2 - d2 ** 2) / (2 * d * d1), -1, 1)
        let sin_b = Math.sqrt(Math.abs(1 - cos_b ** 2))
        let self_vec = {
            x: vec.x * cos_b - vec.y * sin_b,
            y: vec.x * sin_b + vec.y * cos_b
        }
        self_vec.x *= d1
        self_vec.y *= d1
        let computed = {
            x: f1.coords.x + self_vec.x,
            y: f1.coords.y + self_vec.y
        }
        return computed
    }

    _rotateVec(vec, angle, inDegrees = false) {
        if (vec === null || vec === undefined || angle === null || angle === undefined) {
            console.log("_rotateVec received invalid parameters")
            return vec
        }

        if (inDegrees) {
            angle = angle * (Math.PI / 180)
        }
        let sin_a = Math.sin(angle), cos_a = Math.cos(angle)

        return {
            x: vec.x * cos_a - vec.y * sin_a,
            y: vec.x * sin_a + vec.y * cos_a
        }
    }
}

module.exports = Position