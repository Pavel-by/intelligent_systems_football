const yargs = require('yargs');
const launch_default = require('./launch_default');
const launch_pr3 = require('./launch_pr3');

const argv = yargs
    .option('mode', { type: 'string' })
    .argv;

if (argv.mode === "pr3") {
    launch_pr3()
} else {
    launch_default()
}