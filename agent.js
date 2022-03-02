const Msg = require('./msg')
const readline = require('readline')
const assert = require("assert");
const SenseBody = require("./sense");
const Position = require('./position');
const Connector = require('./connector');
const { CallTracker } = require('assert');
const Ticker = require('./ticker')

class Agent {
    constructor() {
        this.sense = new SenseBody()
        this.position = new Position(this)
        this.connector = new Connector(this)
        this.ticker = new Ticker(this)
        this.run = false
        this.act = null
        this.tick = null
        this.teamname = null
        this.uniformNumber = null
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        this.rl.on('line', (input) => {
            if (this.run) {
                if (input === "w") this.act = { n: "dash", v: 100 }
                if (input === "d") this.act = { n: "turn", v: 20 }
                if (input === "a") this.act = { n: "turn", v: -20 }
                if (input === "s") this.act = { n: "kick", v: 100 }
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

    socketSend(cmd, value = null) {
        if (Array.isArray(value))
            value = value.join(" ")

        if (value === null || value === undefined)
            this.socket.sendMsg(`(${cmd})`)
        else 
            this.socket.sendMsg(`(${cmd} ${value})`)
    }

    onTick() {
        this.sendCmd()
    }

    processMsg(msg) {
        let data = Msg.parseMsg(msg)
        if (!data) throw new Error("Parse error\n" + msg)
        let analyzed = this.connector.analyze(data.cmd, data.p)
        analyzed |= this.position.analyze(data.cmd, data.p)
        analyzed |= this.sense.analyze(data.cmd, data.p)
        analyzed |= this.ticker.analyze(data.cmd, data.p)

        if (data.cmd === 'hear') {
            this.run = true
            analyzed = true
        }

        if (data.cmd === "player_param" || data.cmd === "player_type" || data.cmd === "server_param")
            analyzed = true

        if (!analyzed) {
            console.log(msg)
        }
    }

    initAgent(p) {
        this.position.updateSide(p[0])
        this.id = p[1]
        this.uniformNumber = parseInt(p[2])
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