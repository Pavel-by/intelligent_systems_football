const yargs = require('yargs');
const launch_default = require('./launch_default');
const launch_pr3 = require('./launch_pr3');
const launch_pr4 = require('./launch_pr4');
const launch_pr6 = require('./launch_pr6');

const argv = yargs
    .option('mode', { type: 'string' })
    .argv;

if (argv.mode === "pr3") {
    launch_pr3()
} else if (argv.mode === "pr4") { 
    launch_pr4()
} else {
    launch_pr6()
}