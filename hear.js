class Hear {
    constructor(agent) {
        this.agent = agent
        this.mode = 'before_kick_off'
        this.hears = []
    }

    analyze(cmd, p) {
        if (cmd != 'hear') return false

        if (p[1] == 'referee') {
            this.mode = p[2]
        } else {
            this.hears.push({
                owner: p[1],
                hear: p[2],
            })
        }
        
        return true
    }

    onTick() {
        this.hears = []
    }

    isPlayOn() {
        return this.mode == 'play_on'
    }

    isKickOffAlly() {
        return this.mode == `kick_off_${this.agent.side}`
    }

    canMove() {
        return this.mode == 'before_kick_off' || this.mode.startsWith('goal_')
    }
}

module.exports = Hear;