const Agent = require('./agent')
const setupSocket = require('./socket')
const clamp = (n, b, t) => Math.min(t, Math.max(b, n))
const readline = require('readline')
const util = require('util')
const yargs = require('yargs');
const { exit } = require('process')

function launch_default() {
    const argv = yargs
        .option('team', { type: 'string' })
        .option('coords', { type: 'string' })
        .option('turn', { type: 'number' })
        .option('log', { type: 'boolean' })
        .option('control', { type: 'boolean' })
        .argv;

    let teamName = argv.team
    if (!teamName) teamName = "A"

    let turn = parseInt(argv.turn)
    if (isNaN(turn)) turn = 0

    let coords = argv.coords
    if (coords && coords.includes(':')) {
        coords = coords.split(':')
        coords = [parseFloat(coords[0]), parseFloat(coords[1])]
        if (isNaN(coords[0])) coords[0] = -15
        if (isNaN(coords[1])) coords[1] = 0
        coords[0] = clamp(coords[0], -54, 0)
        coords[1] = clamp(coords[1], -32, 32)
    } else {
        coords = [-15, 0]
    }

    let agent = new Agent()
    agent.teamname = teamName
    setupSocket(agent)
    agent.connector.executeOnConnect((_) => {
        console.log("move to coords ", coords.join(":"))
        agent.socketSend("move", coords)
    })
    if (turn) {
        console.log("turn applied: ", turn)
        agent.ticker.executeOnTick((_) => {
            agent.act = { n: 'turn', v: turn }
        })
    }
    if (argv.log) {
        console.log("position logging enabled")
        agent.ticker.executeOnTick((_) => {
            let coordsToString = (coords) => {
                if (!coords || coords.x === undefined || coords.y === undefined)
                    return 'unknown coords'
                return `${coords.x.toFixed(2)}:${coords.y.toFixed(2)}`
            }

            let playerCoords = coordsToString(agent.position.coords)
            let ballCoords = coordsToString(agent.manager.ball?.coords)
            let myVelocity = agent.sense.speed.toString()
            let ballVelocity = coordsToString(agent.manager.ball?.velocity)

            let msg = util.format("%15s, %15s, %15s, %15s", playerCoords, ballCoords, myVelocity, ballVelocity)
            let estimatedCoords = coordsToString(agent.manager.estimateBallCoords(20))
            process.stdout.write("\033[2K\r" + estimatedCoords)
        })
    }

    if (argv.control) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        rl.on('line', (input) => {
            if (input === "w") agent.act = { n: "dash", v: 100 }
            else if (input === "d") agent.act = { n: "turn", v: 20 }
            else if (input === "a") agent.act = { n: "turn", v: -20 }
            else if (input === "s") agent.act = { n: "kick", v: 100 }
            else if (input) agent.act = input
        })
    }

    agent.connector.connect()
}

module.exports = launch_default;