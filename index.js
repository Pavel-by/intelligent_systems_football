const Agent = require('./agent')
const VERSION = 7

const yargs = require('yargs');
const argv = yargs.option('team').argv;

console.log(argv)

let teamName = argv.team
if (!teamName) teamName = "A"

let agent = new Agent()
require('./socket')(agent, teamName, VERSION)
agent.socketSend("move", "-15 0")