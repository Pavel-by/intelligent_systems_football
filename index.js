const Agent = require('./agent')
const VERSION = 7

const yargs = require('yargs');
const argv = yargs.option('team').argv;

console.log(argv)

let teamName = argv.team
if (!teamName) teamName = "A"

let agent = new Agent()
agent.teamname = teamName
require('./socket')(agent, teamName, VERSION)
process.on('SIGINT', function() {
    agent.sendCmd('bye')
    process.exit();
});

agent.socketSend("move", "-15 0")