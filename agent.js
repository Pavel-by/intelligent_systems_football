const Msg = require('./msg')
const readline = require('readline')

class Agent {
    constructor() {
        this.position = "1"
        this.run = false
        this.act = null
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        this.rl.on('line', (input) => {
            if (this.run) {
                if (input === "w") this.act = {n: "dash", v: 100}
                if (input === "d") this.act = {n: "turn", v: 20}
                if (input === "a") this.act = {n: "turn", v: -20}
                if (input === "s") this.act = {n: "kick", v: 100}
            }
        })
    }

    msgGot(msg) {
        // TODO 'utf8'
        let data = msg.toString()
        this.processMsg(data)
        this.sendCmd()
    }

    setSocket(socket) {
        this.socket = socket
    }

    socketSend(cmd, value) {
        this.socket.sendMsg(`(${cmd} ${value}`)
    }

    processMsg(msg) {
        let data = Msg.parseMsg(msg)
        if (!data) throw new Error("Parse error\n" + msg)
        if (data.cmd === "hear") this.run = true
        if (data.cmd === "init") this.initAgent(data.p)
        this.analyzeEnv(data.msg, data.cmd, data.p)
    }

    initAgent(p) {
        if (p[0] === "r") this.position = "r"
        if (p[1]) this.id = p[1]
    }

    analyzeEnv(msg, cmd, p) {
        // TODO
    }

    sendCmd() {
        if (this.run) {
            if (this.act) {
                if (this.act.n === "kick")
                    this.socketSend(this.act.n, this.act.v + " 0")
                else
                    this.socketSend(this.act.n, this.act.v)
                this.act = null
            }
        }
    }
}

module.exports = Agent