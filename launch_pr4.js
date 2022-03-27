const Agent = require('./agent')
const setupSocket = require('./socket')

function setup_agent(props) {
    let agent = new Agent()
    agent.teamname = props.teamName
    agent.role = props.role
    setupSocket(agent)
    agent.connector.connect()
}

function launch_pr4() {
    const Agents = [
        // team A
        {
            teamName: "A",
            role: "attacker_front_bottom"
        },
        {
            teamName: "A",
            role: "attacker_front_top"
        },
        {
            teamName: "A",
            role: "attacker_front_middle"
        },
        // team B
        {
            teamName: "B",
            role: "goalie"
        },
        {
            teamName: "B",
            role: "statist"
        },
    ]
    for (let agent of Agents) {
        setup_agent(agent)
    }
}

module.exports = launch_pr4;