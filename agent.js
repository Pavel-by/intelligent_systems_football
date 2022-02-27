const Msg = require('./msg')
const readline = require('readline')
const assert = require("assert");
const SenseBody = require("./sense");
const Position = require('./position');

class Agent {
    constructor() {
        this.sense = new SenseBody()
        this.position = new Position()
        this.run = false
        this.act = null
        this.tick = null
        this.teamname = null
        this.uniformNumber = null
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        //---
        this.time = 0
        //---
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

    processMsg(msg) {
        let data = Msg.parseMsg(msg)
        if (!data) throw new Error("Parse error\n" + msg)
        if (data.cmd === "hear") this.run = true
        else if (data.cmd === "init") this.initAgent(data.p)
        else this.analyzeEnv(data.msg, data.cmd, data.p)

        let newTick = this.findTick(data.p)
        if (newTick != null && this.tick != newTick) {
            if (this.position.coords !== null)
                console.log(`${this.position.coords.x.toFixed(2)}: ${this.position.coords.y.toFixed(2)} - ${this.position.coordsError.toFixed(2)}`)
            if (this.position.objects !== null) {
                for (let obj of this.position.objects) {
                    if (obj.isBall) {
                        console.log(`ball `, obj.coords)
                    }
                    if (obj.isPlayer) {
                        console.log(`player `, obj.coords)
                    }
                }
            }
            this.tick = newTick
            if (this.act == null)
                this.act = { n: 'turn', v: 10 }
        }
    }

    findTick(p) {
        if (p.length > 0 && Number.isInteger(p[0]))
            return p[0]
        return null
    }

    initAgent(p) {
        this.position.updateSide(p[0])
        this.id = p[1]
        this.uniformNumber = parseInt(p[2])
    }

    analyzeEnv(msg, cmd, p) {
        if (cmd === "see")
            this.position.analyzeSee(p)
        else if (cmd === "sense_body")
            this.sense.analyze(p)
        else
            console.log(`Unknown message ${msg}`)
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