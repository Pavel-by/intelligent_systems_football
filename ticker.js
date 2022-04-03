const TICK_CMD = [
    'see'
]

class AgentTicker {
    constructor(agent) {
        this.agent = agent
        this.tick = 0
        this.callbacks = []
    }

    analyze(cmd, p) {
        /*if (p.length > 0) {
            let newTick = p[0]
            console.log(`${cmd} ${newTick}`)
        }*/
        if (!TICK_CMD.includes(cmd) && !(cmd == 'hear' && cmd[1] == 'referee')) return false
        if (Array.isArray(p) && p.length > 0 && Number.isInteger(p[0])) {
            let newTick = p[0]
            //if (this.tick != newTick) {
            this.tick = newTick
            this.agent.onTick()
            for (let callback of this.callbacks) {
                callback(this.agent)
            }
            //}
        }
        return false
    }

    executeOnTick(callback) {
        this.callbacks.push(callback)
    }
}

module.exports = AgentTicker