const Msg = require('./msg')
const SenseBody = require("./sense");
const Position = require('./position');
const Connector = require('./connector');
const Ticker = require('./ticker');
const Controller = require('./contoller');

class Agent {
    constructor() {
        this.sense = new SenseBody()
        this.position = new Position(this)
        this.connector = new Connector(this)
        this.ticker = new Ticker(this)
        this.controller = new Controller(this)
        this.run = false
        this.gameStatus = "before_kick_off"
        this.act = null
        this.tick = null
        this.teamname = null
        this.uniformNumber = null
    }

    msgGot(msg) {
        // TODO 'utf8'
        let data = msg.toString()
        this.processMsg(data)
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
        this.controller.onTick()
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
            if (data.p[1] === 'referee')
                this.gameStatus = data.p[2]
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
                if (typeof this.act === 'string') {
                    this.socket.sendMsg(`(${this.act})`)
                }

                if (typeof this.act === 'object') {
                    this.socketSend(this.act.n, this.act.v)
                }
                this.act = null
            }
        }
    }
}

module.exports = Agent