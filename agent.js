const Msg = require('./msg')
const SenseBody = require("./sense");
const Position = require('./position');
const Connector = require('./connector');
const Ticker = require('./ticker');
const Params = require('./params')
const StateTree = require('./states')
const Hear = require('./hear')

class Agent {
    constructor() {
        this.sense = new SenseBody()
        this.position = new Position(this)
        this.connector = new Connector(this)
        this.ticker = new Ticker(this)
        this.params = new Params(this)
        this.stateTree = new StateTree(this)
        this.hear = new Hear(this)
        this.role = null
        this.act = null
        this.lastAct = null
        this.tick = null
        this.teamname = null
        this.uniformNumber = null
        this.baseCoords = { x: 0, y: 0 }
        this.goals = [
            /*{
                type: "dribble",
                coords: {x: -30, y: -15},
            },
            {
                type: "dribble",
                coords: {x: 25, y: 20},
            },
            {
                type: "dribble",
                coords: {x: -30, y: 15},
            },*/
            {
                type: "attack",
            }
        ]
    }

    msgGot(msg, socketInfo) {
        // TODO 'utf8'
        let data = msg.toString()
        this.processMsg(data, socketInfo)
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
        this.act = this.stateTree.makeCmd()
        this.sendCmd()
        this.hear.onTick()
    }

    processMsg(msg, socketInfo) {
        let data = Msg.parseMsg(msg)
        if (!data) throw new Error("Parse error\n" + msg)
        let analyzed = this.connector.analyze(data.cmd, data.p, socketInfo)
        analyzed |= this.params.analyze(data.cmd, data.p)
        analyzed |= this.position.analyze(data.cmd, data.p)
        analyzed |= this.sense.analyze(data.cmd, data.p)
        analyzed |= this.hear.analyze(data.cmd, data.p)
        this.ticker.analyze(data.cmd, data.p)

        if (data.cmd === "player_param"
            || data.cmd === "player_type")
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
        if (this.act) {
            if (typeof this.act === 'string') {
                this.socket.sendMsg(`(${this.act})`)
            }

            if (typeof this.act === 'object') {
                this.socketSend(this.act.n, this.act.v)
            }
            this.lastAct = this.act
            this.act = null
        }
    }
}

module.exports = Agent