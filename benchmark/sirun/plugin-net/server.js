'use strict'

const net = require('net')

if (process.env.SET_PID === 'server') {
  const fs = require('fs')
  fs.writeFileSync('server.pid', '' + process.pid)
}

let connectionsMade = 0
net.createServer(c => {
  c.on('data', d => {
    c.write(d)

    if (++connectionsMade === 10000 && process.env.SET_PID !== 'server') {
      setImmediate(() => {
        process.exit()
      })
    }
  })
}).listen(process.env.PORT)
