const Agent = require('./agent')
const setupSocket = require('./socket')
const clamp = (n, b, t) => Math.min(t, Math.max(b, n))

const yargs = require('yargs');
const argv = yargs
    .option('team', { type: 'string' })
    .option('coords', { type: 'string' })
    .option('turn', { type: 'number' })
    .option('log', { type: 'boolean' })
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
        console.log(`Agent position: ${coordsToString(agent.position.coords)}`)
        if (Array.isArray(agent.position.objects))
            for (let obj of agent.position.objects) {
                if (obj.isBall)
                    console.log(`\tBall position: ${coordsToString(obj.coords)}`)
                if (obj.isPlayer)
                    console.log(`\tPlayer ${obj.isAlly ? 'ally' : (obj.isEnemy ? 'enemy' : 'unknown team')}: ${coordsToString(obj.coords)}`)
            }
    })
}
agent.connector.connect()