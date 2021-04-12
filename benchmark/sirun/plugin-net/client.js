'use strict'

const net = require('net')

if (process.env.SET_PID === 'client') {
  const fs = require('fs')
  fs.writeFileSync('client.pid', '' + process.pid)
}

let connectionsMade = 0
function run () {
  const client = net.connect(process.env.PORT, () => {
    client.write('hello')
    client.on('data', () => {
      client.end(() => {
        if (++connectionsMade === 10000 && process.env.SET_PID !== 'client') {
          process.exit()
        }
        run()
      })
    })
  }).on('error', () => {
    setTimeout(run, 100)
  })
}
run()
