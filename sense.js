class SenseBody {
    constructor() {
        this.viewQuality = ""
        this.viewWidth = ""
        this.stamina = 0
        this.effort = 1
        this.speed = 0
        this.speedDirection = 0
        this.headAngle = 0
        this.kick = 0
        this.dash = 0
        this.turn = 0
        this.turnNeck = 0
        this.say = 0
        this.catch = 0
        this.move = 0
        this.changeView = 0
    }

    analyze(cmd, p) {
        if (cmd !== "sense_body") return false
        if (!Array.isArray(p)) {
            console.log("Cannot parse body sence: unknown parameters type")
            return false
        }

        for (let i of p) {
            if (i.cmd) {
                if (i.cmd === 'view_mode') {
                    this.viewQuality = i.p[0]
                    this.viewWidth = i.p[1]
                } else if (i.cmd === 'stamina') {
                    this.stamina = i.p[0]
                    this.effort = i.p[1]
                } else if (i.cmd === 'speed') {
                    this.speed = i.p[0]
                    this.speedDirection = i.p[1]
                } else if (i.cmd === 'head_angle') {
                    this.headAngle = i.p[0]
                } else if (i.cmd === 'kick') {
                    this.kick = i.p[0]
                } else if (i.cmd === 'dash') {
                    this.dash = i.p[0]
                } else if (i.cmd === 'turn') {
                    this.turn = i.p[0]
                } else if (i.cmd === 'say') {
                    this.say = i.p[0]
                } else if (i.cmd === 'turn_neck') {
                    this.turnNeck = i.p[0]
                } else if (i.cmd === 'catch') {
                    this.catch = i.p[0]
                } else if (i.cmd === 'move') {
                    this.move = i.p[0]
                } else if (i.cmd === 'change_view') {
                    this.changeView = i.p[0]
                } else {
                    console.log("Unknown sense parameter")
                    console.log(i)
                }
            }
        }
        return true
    }
}

module.exports = SenseBody