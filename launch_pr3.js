const Agent = require('./agent')
const setupSocket = require('./socket')

function setup_agent(props) {
    let agent = new Agent()
    agent.teamname = props.teamName
    agent.isGoalie = props.isGoalie === true
    setupSocket(agent)
    agent.connector.executeOnConnect((_) => {
        agent.socketSend("move", props.coords)
    })
    agent.connector.connect()
}

function launch_pr3() {
    const Agents = [
        {
            teamName: "A",
            coords: [-15, 0]
        },
        {
            teamName: "A",
            coords: [-25, -10]
        },
        {
            teamName: "A",
            coords: [-25, 10]
        },
        {
            teamName: "B",
            coords: [-50, 0],
            isGoalie: true
        },
    ]
    for (let agent of Agents) {
        setup_agent(agent)
    }
}

module.exports = launch_pr3;