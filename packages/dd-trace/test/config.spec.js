'use strict'

const { expect } = require('chai')

describe('Config', () => {
  let Config
  let pkg
  let env

  beforeEach(() => {
    pkg = {
      name: '',
      version: ''
    }

    env = process.env
    process.env = {}

    Config = proxyquire('../src/config', {
      './pkg': pkg
    })
  })

  afterEach(() => {
    process.env = env
  })

  it('should initialize with the correct defaults', () => {
    const config = new Config()

    expect(config).to.have.property('service', 'node')
    expect(config).to.have.property('enabled', true)
    expect(config).to.have.property('debug', false)
    expect(config).to.have.property('protocolVersion', '0.4')
    expect(config).to.have.nested.property('dogstatsd.hostname', '127.0.0.1')
    expect(config).to.have.nested.property('dogstatsd.port', '8125')
    expect(config).to.have.property('flushInterval', 2000)
    expect(config).to.have.property('sampleRate', 1)
    expect(config).to.have.property('runtimeMetrics', false)
    expect(config).to.have.property('trackAsyncScope', true)
    expect(config.tags).to.have.property('service', 'node')
    expect(config).to.have.property('plugins', true)
    expect(config).to.have.property('env', undefined)
    expect(config).to.have.property('reportHostname', false)
    expect(config).to.have.property('scope', undefined)
    expect(config).to.have.property('logLevel', 'debug')
    expect(config).to.have.nested.property('experimental.b3', false)
    expect(config).to.have.nested.property('experimental.runtimeId', false)
    expect(config).to.have.nested.property('experimental.exporter', undefined)
    expect(config).to.have.nested.property('experimental.enableGetRumData', false)
    expect(config).to.have.nested.property('experimental.internalErrors', false)
  })

  it('should initialize from the default service', () => {
    pkg.name = 'test'

    const config = new Config()

    expect(config).to.have.property('service', 'test')
    expect(config.tags).to.have.property('service', 'test')
  })

  it('should initialize from the default version', () => {
    pkg.version = '1.2.3'

    const config = new Config()

    expect(config).to.have.property('version', '1.2.3')
    expect(config.tags).to.have.property('version', '1.2.3')
  })

  it('should initialize from environment variables', () => {
    process.env.DD_TRACE_AGENT_HOSTNAME = 'agent'
    process.env.DD_TRACE_AGENT_PORT = '6218'
    process.env.DD_DOGSTATSD_HOSTNAME = 'dsd-agent'
    process.env.DD_DOGSTATSD_PORT = '5218'
    process.env.DD_TRACE_ENABLED = 'false'
    process.env.DD_TRACE_DEBUG = 'true'
    process.env.DD_TRACE_AGENT_PROTOCOL_VERSION = '0.5'
    process.env.DD_TRACE_ANALYTICS = 'true'
    process.env.DD_SERVICE = 'service'
    process.env.DD_VERSION = '1.0.0'
    process.env.DD_RUNTIME_METRICS_ENABLED = 'true'
    process.env.DD_TRACE_REPORT_HOSTNAME = 'true'
    process.env.DD_ENV = 'test'
    process.env.DD_TRACE_GLOBAL_TAGS = 'foo:bar,baz:qux'
    process.env.DD_TRACE_SAMPLE_RATE = '0.5'
    process.env.DD_TRACE_RATE_LIMIT = '-1'
    process.env.DD_TRACE_EXPERIMENTAL_B3_ENABLED = 'true'
    process.env.DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED = 'true'
    process.env.DD_TRACE_EXPERIMENTAL_EXPORTER = 'log'
    process.env.DD_TRACE_EXPERIMENTAL_GET_RUM_DATA_ENABLED = 'true'
    process.env.DD_TRACE_EXPERIMENTAL_INTERNAL_ERRORS_ENABLED = 'true'

    const config = new Config()

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.property('protocolVersion', '0.5')
    expect(config).to.have.property('analytics', true)
    expect(config).to.have.property('hostname', 'agent')
    expect(config).to.have.nested.property('dogstatsd.hostname', 'dsd-agent')
    expect(config).to.have.nested.property('dogstatsd.port', '5218')
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('version', '1.0.0')
    expect(config).to.have.property('runtimeMetrics', true)
    expect(config).to.have.property('reportHostname', true)
    expect(config).to.have.property('env', 'test')
    expect(config.tags).to.include({ foo: 'bar', baz: 'qux' })
    expect(config.tags).to.include({ service: 'service', 'version': '1.0.0', 'env': 'test' })
    expect(config).to.have.deep.nested.property('experimental.sampler', { sampleRate: '0.5', rateLimit: '-1' })
    expect(config).to.have.nested.property('experimental.b3', true)
    expect(config).to.have.nested.property('experimental.runtimeId', true)
    expect(config).to.have.nested.property('experimental.exporter', 'log')
    expect(config).to.have.nested.property('experimental.enableGetRumData', true)
    expect(config).to.have.nested.property('experimental.internalErrors', true)
  })

  it('should read case-insensitive booleans from environment variables', () => {
    process.env.DD_TRACE_ENABLED = 'False'
    process.env.DD_TRACE_DEBUG = 'TRUE'
    process.env.DD_TRACE_ANALYTICS = '1'
    process.env.DD_RUNTIME_METRICS_ENABLED = '0'

    const config = new Config()

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.property('analytics', true)
    expect(config).to.have.property('runtimeMetrics', false)
  })

  it('should initialize from environment variables with url taking precedence', () => {
    process.env.DD_TRACE_AGENT_URL = 'https://agent2:7777'
    process.env.DD_SITE = 'datadoghq.eu'
    process.env.DD_TRACE_AGENT_HOSTNAME = 'agent'
    process.env.DD_TRACE_AGENT_PORT = '6218'
    process.env.DD_TRACE_ENABLED = 'false'
    process.env.DD_TRACE_DEBUG = 'true'
    process.env.DD_SERVICE = 'service'
    process.env.DD_ENV = 'test'

    const config = new Config()

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.nested.property('dogstatsd.hostname', 'agent')
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent2')
    expect(config).to.have.nested.property('url.port', '7777')
    expect(config).to.have.property('site', 'datadoghq.eu')
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('env', 'test')
  })

  it('should initialize from the options', () => {
    const logger = {}
    const tags = {
      'foo': 'bar'
    }
    const logLevel = 'error'
    const config = new Config({
      enabled: false,
      debug: true,
      protocolVersion: '0.5',
      analytics: true,
      site: 'datadoghq.eu',
      hostname: 'agent',
      port: 6218,
      dogstatsd: {
        hostname: 'agent-dsd',
        port: 5218
      },
      service: 'service',
      version: '0.1.0',
      env: 'test',
      sampleRate: 0.5,
      logger,
      tags,
      flushInterval: 5000,
      runtimeMetrics: true,
      trackAsyncScope: false,
      reportHostname: true,
      plugins: false,
      scope: 'noop',
      logLevel: logLevel,
      experimental: {
        b3: true,
        runtimeId: true,
        exporter: 'log',
        enableGetRumData: true,
        sampler: {
          sampleRate: 1,
          rateLimit: 1000
        },
        internalErrors: true
      }
    })

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.property('protocolVersion', '0.5')
    expect(config).to.have.property('analytics', true)
    expect(config).to.have.property('site', 'datadoghq.eu')
    expect(config).to.have.property('hostname', 'agent')
    expect(config).to.have.property('port', '6218')
    expect(config).to.have.nested.property('dogstatsd.hostname', 'agent-dsd')
    expect(config).to.have.nested.property('dogstatsd.port', '5218')
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('version', '0.1.0')
    expect(config).to.have.property('env', 'test')
    expect(config).to.have.property('sampleRate', 0.5)
    expect(config).to.have.property('logger', logger)
    expect(config.tags).to.have.property('foo', 'bar')
    expect(config.tags).to.have.property('service', 'service')
    expect(config.tags).to.have.property('version', '0.1.0')
    expect(config.tags).to.have.property('env', 'test')
    expect(config).to.have.property('flushInterval', 5000)
    expect(config).to.have.property('runtimeMetrics', true)
    expect(config).to.have.property('trackAsyncScope', false)
    expect(config).to.have.property('reportHostname', true)
    expect(config).to.have.property('plugins', false)
    expect(config).to.have.property('scope', 'noop')
    expect(config).to.have.property('logLevel', logLevel)
    expect(config).to.have.property('tags')
    expect(config.tags).to.have.property('foo', 'bar')
    expect(config.tags).to.have.property('runtime-id')
    expect(config.tags['runtime-id']).to.match(/^[0-9a-f]{32}$/)
    expect(config).to.have.nested.property('experimental.b3', true)
    expect(config).to.have.nested.property('experimental.runtimeId', true)
    expect(config).to.have.nested.property('experimental.exporter', 'log')
    expect(config).to.have.nested.property('experimental.enableGetRumData', true)
    expect(config).to.have.nested.property('experimental.internalErrors', true)
    expect(config).to.have.deep.nested.property('experimental.sampler', { sampleRate: 1, rateLimit: 1000 })
  })

  it('should initialize from the options with url taking precedence', () => {
    const logger = {}
    const tags = { foo: 'bar' }
    const config = new Config({
      enabled: false,
      debug: true,
      hostname: 'agent',
      url: 'https://agent2:7777',
      site: 'datadoghq.eu',
      port: 6218,
      service: 'service',
      env: 'test',
      sampleRate: 0.5,
      logger,
      tags,
      flushInterval: 5000,
      plugins: false
    })

    expect(config).to.have.property('enabled', false)
    expect(config).to.have.property('debug', true)
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent2')
    expect(config).to.have.nested.property('url.port', '7777')
    expect(config).to.have.property('site', 'datadoghq.eu')
    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('env', 'test')
    expect(config).to.have.property('sampleRate', 0.5)
    expect(config).to.have.property('logger', logger)
    expect(config.tags).to.have.property('foo', 'bar')
    expect(config).to.have.property('flushInterval', 5000)
    expect(config).to.have.property('plugins', false)
  })

  it('should give priority to the common agent environment variable', () => {
    process.env.DD_TRACE_AGENT_HOSTNAME = 'trace-agent'
    process.env.DD_AGENT_HOST = 'agent'
    process.env.DD_TRACE_GLOBAL_TAGS = 'foo:foo'
    process.env.DD_TAGS = 'foo:bar,baz:qux'

    const config = new Config()

    expect(config).to.have.property('hostname', 'agent')
    expect(config.tags).to.include({ foo: 'foo', baz: 'qux' })
  })

  it('should give priority to the options', () => {
    process.env.DD_TRACE_AGENT_URL = 'https://agent2:6218'
    process.env.DD_SITE = 'datadoghq.eu'
    process.env.DD_TRACE_AGENT_HOSTNAME = 'agent'
    process.env.DD_TRACE_AGENT_PORT = '6218'
    process.env.DD_DOGSTATSD_PORT = '5218'
    process.env.DD_TRACE_ENABLED = 'false'
    process.env.DD_TRACE_DEBUG = 'true'
    process.env.DD_TRACE_AGENT_PROTOCOL_VERSION = '0.4'
    process.env.DD_TRACE_ANALYTICS = 'true'
    process.env.DD_SERVICE = 'service'
    process.env.DD_VERSION = '0.0.0'
    process.env.DD_RUNTIME_METRICS_ENABLED = 'true'
    process.env.DD_TRACE_REPORT_HOSTNAME = 'true'
    process.env.DD_ENV = 'test'
    process.env.DD_API_KEY = '123'
    process.env.DD_APP_KEY = '456'
    process.env.DD_TRACE_GLOBAL_TAGS = 'foo:bar,baz:qux'
    process.env.DD_TRACE_EXPERIMENTAL_B3_ENABLED = 'true'
    process.env.DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED = 'true'
    process.env.DD_TRACE_EXPERIMENTAL_EXPORTER = 'log'
    process.env.DD_TRACE_EXPERIMENTAL_GET_RUM_DATA_ENABLED = 'true'
    process.env.DD_TRACE_EXPERIMENTAL_INTERNAL_ERRORS_ENABLED = 'true'

    const config = new Config({
      enabled: true,
      debug: false,
      protocolVersion: '0.5',
      analytics: false,
      protocol: 'https',
      site: 'datadoghq.com',
      hostname: 'server',
      port: 7777,
      dogstatsd: {
        port: 8888
      },
      runtimeMetrics: false,
      reportHostname: false,
      service: 'test',
      version: '1.0.0',
      env: 'development',
      tags: {
        foo: 'foo'
      },
      experimental: {
        b3: false,
        runtimeId: false,
        exporter: 'agent',
        enableGetRumData: false,
        internalErrors: false
      }
    })

    expect(config).to.have.property('enabled', true)
    expect(config).to.have.property('debug', false)
    expect(config).to.have.property('protocolVersion', '0.5')
    expect(config).to.have.property('analytics', false)
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent2')
    expect(config).to.have.nested.property('url.port', '6218')
    expect(config).to.have.nested.property('dogstatsd.hostname', 'server')
    expect(config).to.have.nested.property('dogstatsd.port', '8888')
    expect(config).to.have.property('site', 'datadoghq.com')
    expect(config).to.have.property('runtimeMetrics', false)
    expect(config).to.have.property('reportHostname', false)
    expect(config).to.have.property('service', 'test')
    expect(config).to.have.property('version', '1.0.0')
    expect(config).to.have.property('env', 'development')
    expect(config.tags).to.include({ foo: 'foo', baz: 'qux' })
    expect(config.tags).to.include({ service: 'test', version: '1.0.0', env: 'development' })
    expect(config).to.have.nested.property('experimental.b3', false)
    expect(config).to.have.nested.property('experimental.runtimeId', false)
    expect(config).to.have.nested.property('experimental.exporter', 'agent')
    expect(config).to.have.nested.property('experimental.enableGetRumData', false)
    expect(config).to.have.nested.property('experimental.internalErrors', false)
  })

  it('should give priority to non-experimental options', () => {
    const config = new Config({
      ingestion: {
        sampleRate: 0.5,
        rateLimit: 500
      },
      experimental: {
        sampler: {
          sampleRate: 0.1,
          rateLimit: 100
        }
      }
    })

    expect(config).to.have.deep.nested.property('experimental.sampler', {
      sampleRate: 0.5, rateLimit: 500
    })
  })

  it('should give priority to the options especially url', () => {
    process.env.DD_TRACE_AGENT_URL = 'http://agent2:6218'
    process.env.DD_TRACE_AGENT_HOSTNAME = 'agent'
    process.env.DD_TRACE_AGENT_PORT = '6218'
    process.env.DD_TRACE_ENABLED = 'false'
    process.env.DD_TRACE_DEBUG = 'true'
    process.env.DD_SERVICE_NAME = 'service'
    process.env.DD_ENV = 'test'

    const config = new Config({
      enabled: true,
      debug: false,
      url: 'https://agent3:7778',
      protocol: 'http',
      hostname: 'server',
      port: 7777,
      service: 'test',
      env: 'development'
    })

    expect(config).to.have.property('enabled', true)
    expect(config).to.have.property('debug', false)
    expect(config).to.have.nested.property('url.protocol', 'https:')
    expect(config).to.have.nested.property('url.hostname', 'agent3')
    expect(config).to.have.nested.property('url.port', '7778')
    expect(config).to.have.property('service', 'test')
    expect(config).to.have.property('env', 'development')
  })

  it('should give priority to individual options over tags', () => {
    process.env.DD_SERVICE = 'test'
    process.env.DD_ENV = 'dev'
    process.env.DD_VERSION = '1.0.0'
    process.env.DD_TAGS = 'service=foo,env=bar,version=0.0.0'

    const config = new Config()

    expect(config.tags).to.include({
      service: 'test',
      env: 'dev',
      version: '1.0.0'
    })
  })

  it('should sanitize the sample rate to be between 0 and 1', () => {
    expect(new Config({ sampleRate: -1 })).to.have.property('sampleRate', 0)
    expect(new Config({ sampleRate: 2 })).to.have.property('sampleRate', 1)
    expect(new Config({ sampleRate: NaN })).to.have.property('sampleRate', 1)
  })

  it('should ignore empty service names', () => {
    process.env.DD_SERVICE = ''

    const config = new Config()

    expect(config.tags).to.include({
      service: 'node'
    })
  })

  it('should support tags for setting primary fields', () => {
    const config = new Config({
      tags: {
        service: 'service',
        env: 'test',
        version: '0.1.0'
      }
    })

    expect(config).to.have.property('service', 'service')
    expect(config).to.have.property('version', '0.1.0')
    expect(config).to.have.property('env', 'test')
  })
})
