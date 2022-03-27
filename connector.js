class AgentConnector {
    constructor(agent) {
        this.agent = agent
        this.connected = false
        this.version = 9
        this.onConnectCallbacks = []
    }

    analyze(cmd, p, socketInfo) {
        if (cmd !== "init") return false
        this.agent.side = p[0]
        this.agent.id = p[1]
        this.agent.playMode = p[2]
        this.agent.socket.port = socketInfo.port
        this.connected = true
        for (let callback of this.onConnectCallbacks) {
            callback(this.agent)
        }
        return true
    }

    connect() {
        if (!this.agent.teamname) {
            console.log("Cannot connect without specified teamname")
            return
        }
        this.agent.socket.sendMsg(`(init ${this.agent.teamname} (version ${this.version})${this.agent.role == "goalie" ? " (goalie)" : ""})`)
    }

    disconnect() {
        this.agent.socketSend("bye")
    }

    executeOnConnect(callback) {
        this.onConnectCallbacks.push(callback)
    }
}

module.exports = AgentConnector