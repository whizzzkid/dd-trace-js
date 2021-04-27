'use strict'

if (!global.ddtrace) {
  const TracerProxy = require('./src/proxy')

  global.ddtrace = new TracerProxy()
  global.ddtrace.default = global.ddtrace
  global.ddtrace.tracer = global.ddtrace
}

module.exports = global.ddtrace
