const Agent = require('./agent')
const setupSocket = require('./socket')

function setup_agent(props) {
    let agent = new Agent()
    agent.teamname = props.teamName
    agent.role = props.role
    setupSocket(agent)
    agent.connector.connect()
}

function launch_pr6() {
    const teamA = "Mironchik"
    const teamB = "B";
    const Agents = [
        // team A
        {
            teamName: teamA,
            role: "attacker_front_bottom"
        },
        {
            teamName: teamA,
            role: "attacker_front_top"
        },
        {
            teamName: teamA,
            role: "attacker_front_middle"
        },
        {
            teamName: teamA,
            role: "attacker_back_bottom"
        },
        {
            teamName: teamA,
            role: "attacker_back_top"
        },
        {
            teamName: teamA,
            role: "attacker_back_middle"
        },
        {
            teamName: teamA,
            role: "defender_out_top"
        },
        {
            teamName: teamA,
            role: "defender_in_top"
        },
        {
            teamName: teamA,
            role: "defender_in_bottom"
        },
        {
            teamName: teamA,
            role: "defender_out_bottom"
        },
        {
            teamName: teamA,
            role: "goalie"
        },
        // team B
        {
            teamName: teamB,
            role: "attacker_front_bottom"
        },
        {
            teamName: teamB,
            role: "attacker_front_top"
        },
        {
            teamName: teamB,
            role: "attacker_front_middle"
        },
        {
            teamName: teamB,
            role: "attacker_back_bottom"
        },
        {
            teamName: teamB,
            role: "attacker_back_top"
        },
        {
            teamName: teamB,
            role: "attacker_back_middle"
        },
        {
            teamName: teamB,
            role: "defender_out_top"
        },
        {
            teamName: teamB,
            role: "defender_in_top"
        },
        {
            teamName: teamB,
            role: "defender_in_bottom"
        },
        {
            teamName: teamB,
            role: "defender_out_bottom"
        },
        {
            teamName: teamB,
            role: "goalie"
        },
    ]
    for (let agent of Agents) {
        setup_agent(agent)
    }
}

module.exports = launch_pr6;