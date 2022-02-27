const dgram = require('dgram')
const address = 'localhost'
const port = 6000

module.exports = function (agent) {
    const socket = dgram.createSocket({type: 'udp4', reuseAddr: true})
    agent.setSocket(socket)
    socket.on('message', (msg, info) => {
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
        socket.send(Buffer.from(msg), port, address, (err, bytes) => {
            if (err) throw err
        })
    }
}