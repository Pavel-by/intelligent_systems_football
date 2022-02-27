const Agent = require('./agent')
const setupSocket = require('./socket')

const yargs = require('yargs');
const argv = yargs
    .option('team')
    .option('turn', { type: 'boolean' })
    .option('log', { type: 'boolean' })
    .argv;

let teamName = argv.team
if (!teamName) teamName = "A"

let agent = new Agent()
agent.teamname = teamName
setupSocket(agent)
agent.connector.executeOnConnect((_) => {
    agent.socketSend("move", "-15 0")
})
if (argv.turn)
    agent.ticker.executeOnTick((_) => {
        agent.act = { n: 'turn', v: 10 }
    })
if (argv.log)
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
agent.connector.connect()