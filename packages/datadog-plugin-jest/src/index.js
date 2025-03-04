const { promisify } = require('util')

const id = require('../../dd-trace/src/id')
const { SAMPLING_RULE_DECISION } = require('../../dd-trace/src/constants')
const { SAMPLING_PRIORITY, SPAN_TYPE, RESOURCE_NAME } = require('../../../ext/tags')
const { AUTO_KEEP } = require('../../../ext/priority')
const {
  TEST_TYPE,
  TEST_NAME,
  TEST_SUITE,
  TEST_STATUS,
  ERROR_MESSAGE,
  ERROR_STACK,
  ERROR_TYPE,
  TEST_PARAMETERS,
  getTestEnvironmentMetadata,
  getTestParametersString
} = require('../../dd-trace/src/plugins/util/test')
const { getFormattedJestTestParameters } = require('./util')

function wrapEnvironment (BaseEnvironment) {
  return class DatadogJestEnvironment extends BaseEnvironment {
    constructor (config, context) {
      super(config, context)
      this.testSuite = context.testPath.replace(`${config.rootDir}/`, '')
      this.testSpansByTestName = {}
    }
  }
}

function createWrapTeardown (tracer, instrumenter) {
  return function wrapTeardown (teardown) {
    return async function teardownWithTrace () {
      instrumenter.unwrap(this.global.test, 'each')
      nameToParams = {}
      await new Promise((resolve) => {
        tracer._exporter._writer.flush(resolve)
      })
      return teardown.apply(this, arguments)
    }
  }
}

let nameToParams = {}

const isTimeout = (event) => {
  return event.error &&
  typeof event.error === 'string' &&
  event.error.startsWith('Exceeded timeout')
}

function createHandleTestEvent (tracer, testEnvironmentMetadata, instrumenter) {
  return async function handleTestEventWithTrace (event) {
    if (event.name === 'test_fn_failure') {
      if (!isTimeout(event)) {
        return
      }
      const context = this.getVmContext()
      if (context) {
        const { currentTestName } = context.expect.getState()
        const testSpan = this.testSpansByTestName[currentTestName]
        if (testSpan) {
          testSpan.setTag(ERROR_TYPE, 'Timeout')
          testSpan.setTag(ERROR_MESSAGE, event.error)
          testSpan.setTag(TEST_STATUS, 'fail')
        }
      }
    }
    if (event.name === 'setup') {
      instrumenter.wrap(this.global.test, 'each', function (original) {
        return function () {
          const testParameters = getFormattedJestTestParameters(arguments)
          const eachBind = original.apply(this, arguments)
          return function () {
            const [testName] = arguments
            nameToParams[testName] = testParameters
            return eachBind.apply(this, arguments)
          }
        }
      })
    }

    if (event.name !== 'test_skip' && event.name !== 'test_todo' && event.name !== 'test_start') {
      return
    }
    const childOf = tracer.extract('text_map', {
      'x-datadog-trace-id': id().toString(10),
      'x-datadog-parent-id': '0000000000000000',
      'x-datadog-sampled': 1
    })
    let testName = event.test.name
    const context = this.getVmContext()
    if (context) {
      const { currentTestName } = context.expect.getState()
      testName = currentTestName
    }
    const commonSpanTags = {
      [TEST_TYPE]: 'test',
      [TEST_NAME]: testName,
      [TEST_SUITE]: this.testSuite,
      [SAMPLING_RULE_DECISION]: 1,
      [SAMPLING_PRIORITY]: AUTO_KEEP,
      ...testEnvironmentMetadata
    }

    const testParametersString = getTestParametersString(nameToParams, event.test.name)
    if (testParametersString) {
      commonSpanTags[TEST_PARAMETERS] = testParametersString
    }

    const resource = `${this.testSuite}.${testName}`
    if (event.name === 'test_skip' || event.name === 'test_todo') {
      tracer.startSpan(
        'jest.test',
        {
          childOf,
          tags: {
            ...commonSpanTags,
            [SPAN_TYPE]: 'test',
            [RESOURCE_NAME]: resource,
            [TEST_STATUS]: 'skip'
          }
        }
      ).finish()
      return
    }
    // event.name === test_start at this point
    const environment = this
    let specFunction = event.test.fn
    if (specFunction.length) {
      specFunction = promisify(specFunction)
    }
    event.test.fn = tracer.wrap(
      'jest.test',
      { type: 'test',
        childOf,
        resource,
        tags: commonSpanTags
      },
      async () => {
        let result
        environment.testSpansByTestName[testName] = tracer.scope().active()
        try {
          result = await specFunction()
          // it may have been set already if the test timed out
          if (!tracer.scope().active()._spanContext._tags['test.status']) {
            tracer.scope().active().setTag(TEST_STATUS, 'pass')
          }
        } catch (error) {
          tracer.scope().active().setTag(TEST_STATUS, 'fail')
          tracer.scope().active().setTag(ERROR_TYPE, error.constructor ? error.constructor.name : error.name)
          tracer.scope().active().setTag(ERROR_MESSAGE, error.message)
          tracer.scope().active().setTag(ERROR_STACK, error.stack)
          throw error
        } finally {
          tracer
            .scope()
            .active()
            .context()._trace.started.forEach((span) => {
              span.finish()
            })
        }
        return result
      }
    )
  }
}

module.exports = [
  {
    name: 'jest-environment-node',
    versions: ['>=24.8.0'],
    patch: function (NodeEnvironment, tracer) {
      const testEnvironmentMetadata = getTestEnvironmentMetadata('jest')

      this.wrap(NodeEnvironment.prototype, 'teardown', createWrapTeardown(tracer, this))

      const newHandleTestEvent = createHandleTestEvent(tracer, testEnvironmentMetadata, this)
      newHandleTestEvent._dd_original = NodeEnvironment.prototype.handleTestEvent
      NodeEnvironment.prototype.handleTestEvent = newHandleTestEvent

      return wrapEnvironment(NodeEnvironment)
    },
    unpatch: function (NodeEnvironment) {
      this.unwrap(NodeEnvironment.prototype, 'teardown')
      NodeEnvironment.prototype.handleTestEvent = NodeEnvironment.prototype.handleTestEvent._dd_original
    }
  },
  {
    name: 'jest-environment-jsdom',
    versions: ['>=24.8.0'],
    patch: function (JsdomEnvironment, tracer) {
      const testEnvironmentMetadata = getTestEnvironmentMetadata('jest')

      this.wrap(JsdomEnvironment.prototype, 'teardown', createWrapTeardown(tracer, this))

      const newHandleTestEvent = createHandleTestEvent(tracer, testEnvironmentMetadata, this)
      newHandleTestEvent._dd_original = JsdomEnvironment.prototype.handleTestEvent
      JsdomEnvironment.prototype.handleTestEvent = newHandleTestEvent

      return wrapEnvironment(JsdomEnvironment)
    },
    unpatch: function (JsdomEnvironment) {
      this.unwrap(JsdomEnvironment.prototype, 'teardown')
      JsdomEnvironment.prototype.handleTestEvent = JsdomEnvironment.prototype.handleTestEvent._dd_original
    }
  }
]
