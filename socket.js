const dgram = require('dgram')
const address = '172.18.46.148'

module.exports = function (agent, teamName, version) {
    const socket = dgram.createSocket({type: 'udp4', reuseAddr: true})
    agent.setSocket(socket)
    socket.on('message', (msg, info) => {
        console.log(msg.toString())
        agent.msgGot(msg)
    })
    socket.on('error', (err) => {
        console.log(`server error:\n${err.stack}`);
        socket.close();
    });
    socket.on('listening', () => {
        const address = socket.address();
        console.log(`server listening ${address.address}:${address.port}`);
    });
    socket.sendMsg = function (msg) {
        socket.send(Buffer.from(msg), 6000, address, (err, bytes) => {
            console.log(err, bytes);
            if (err) throw err
        })
    }
    socket.sendMsg(`(init ${teamName} (version ${version}))`)
}