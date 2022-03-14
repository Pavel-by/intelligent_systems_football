const dgram = require('dgram')
const address = 'localhost'
const port = 6000

module.exports = function (agent) {
    const socket = dgram.createSocket({type: 'udp4', reuseAddr: true})
    agent.setSocket(socket)
    socket.port = port
    socket.on('message', (msg, info) => {
        agent.msgGot(msg, info)
    })
    socket.on('error', (err) => {
        console.log(`server error:\n${err.stack}`);
        socket.close();
    });
    socket.on('listening', () => {
        const address = socket.address();
    });
    socket.sendMsg = function (msg) {
        if (!msg.endsWith("\u0000"))
            msg += "\u0000"
        socket.send(Buffer.from(msg), socket.port, address, (err, bytes) => {
            if (err) throw err
        })
    }
}