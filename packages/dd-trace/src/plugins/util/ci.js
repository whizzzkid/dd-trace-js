const URL = require('url').URL

const { GIT_BRANCH, GIT_COMMIT_SHA, GIT_TAG } = require('./git')

const CI_PIPELINE_ID = 'ci.pipeline.id'
const CI_PIPELINE_NAME = 'ci.pipeline.name'
const CI_PIPELINE_NUMBER = 'ci.pipeline.number'
const CI_PIPELINE_URL = 'ci.pipeline.url'
const CI_PROVIDER_NAME = 'ci.provider.name'
const CI_WORKSPACE_PATH = 'ci.workspace_path'
const GIT_REPOSITORY_URL = 'git.repository_url'
const CI_JOB_URL = 'ci.job.url'
const CI_JOB_NAME = 'ci.job.name'
const CI_STAGE_NAME = 'ci.stage.name'
const CI_JOB_ID = 'ci.job.id'

function removeEmptyValues (tags) {
  return Object.keys(tags).reduce((filteredTags, tag) => {
    if (!tags[tag]) {
      return filteredTags
    }
    return {
      ...filteredTags,
      [tag]: tags[tag]
    }
  }, {})
}

function normalizeTag (targetTags, tagKey, normalize) {
  if (targetTags[tagKey]) {
    targetTags[tagKey] = normalize(targetTags[tagKey])
  }
}

function normalizeRef (ref) {
  if (!ref) {
    return ref
  }
  return ref.replace(/origin\/|refs\/heads\/|tags\//gm, '')
}

function filterSensitiveInfoFromRepository (repositoryUrl) {
  if (repositoryUrl.startsWith('git@')) {
    return repositoryUrl
  }

  try {
    const { protocol, hostname, pathname } = new URL(repositoryUrl)

    return `${protocol}//${hostname}${pathname}`
  } catch (e) {
    return repositoryUrl
  }
}

function resolveTilde (filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return ''
  }
  // '~/folder/path' or '~'
  if (filePath[0] === '~' && (filePath[1] === '/' || filePath.length === 1)) {
    return filePath.replace('~', process.env.HOME)
  }
  return filePath
}

module.exports = {
  CI_PIPELINE_ID,
  CI_PIPELINE_NAME,
  CI_PIPELINE_NUMBER,
  CI_PIPELINE_URL,
  CI_PROVIDER_NAME,
  CI_WORKSPACE_PATH,
  getCIMetadata () {
    const { env } = process

    let tags = {}

    if (env.JENKINS_URL) {
      const {
        WORKSPACE,
        BUILD_TAG,
        JOB_NAME,
        BUILD_NUMBER,
        BUILD_URL,
        GIT_BRANCH: JENKINS_GIT_BRANCH,
        GIT_COMMIT: JENKINS_GIT_COMMIT,
        GIT_URL: JENKINS_GIT_REPOSITORY_URL
      } = env

      tags = {
        [CI_PIPELINE_ID]: BUILD_TAG,
        [CI_PIPELINE_NUMBER]: BUILD_NUMBER,
        [CI_PIPELINE_URL]: BUILD_URL,
        [CI_PROVIDER_NAME]: 'jenkins',
        [GIT_COMMIT_SHA]: JENKINS_GIT_COMMIT,
        [GIT_REPOSITORY_URL]: JENKINS_GIT_REPOSITORY_URL,
        [CI_WORKSPACE_PATH]: WORKSPACE
      }

      const isTag = JENKINS_GIT_BRANCH && JENKINS_GIT_BRANCH.includes('tags')
      const refKey = isTag ? GIT_TAG : GIT_BRANCH
      const ref = normalizeRef(JENKINS_GIT_BRANCH)

      tags[refKey] = ref

      let finalPipelineName = ''
      if (JOB_NAME) {
        // Job names can contain parameters, e.g. jobName/KEY1=VALUE1,KEY2=VALUE2/branchName
        const jobNameAndParams = JOB_NAME.split('/')
        if (jobNameAndParams.length > 1 && jobNameAndParams[1].includes('=')) {
          finalPipelineName = jobNameAndParams[0]
        } else {
          finalPipelineName = JOB_NAME.replace(`/${ref}`, '')
        }
        tags[CI_PIPELINE_NAME] = finalPipelineName
      }
    }

    if (env.GITLAB_CI) {
      const {
        CI_PIPELINE_ID: GITLAB_PIPELINE_ID,
        CI_PROJECT_PATH,
        CI_PIPELINE_IID,
        CI_PIPELINE_URL: GITLAB_PIPELINE_URL,
        CI_PROJECT_DIR,
        CI_COMMIT_BRANCH,
        CI_COMMIT_TAG,
        CI_COMMIT_SHA,
        CI_REPOSITORY_URL,
        CI_JOB_URL: GITLAB_CI_JOB_URL,
        CI_JOB_STAGE,
        CI_JOB_NAME: GITLAB_CI_JOB_NAME
      } = env

      tags = {
        [CI_PIPELINE_ID]: GITLAB_PIPELINE_ID,
        [CI_PIPELINE_NAME]: CI_PROJECT_PATH,
        [CI_PIPELINE_NUMBER]: CI_PIPELINE_IID,
        [CI_PROVIDER_NAME]: 'gitlab',
        [GIT_COMMIT_SHA]: CI_COMMIT_SHA,
        [GIT_REPOSITORY_URL]: CI_REPOSITORY_URL,
        [CI_JOB_URL]: GITLAB_CI_JOB_URL,
        [GIT_TAG]: CI_COMMIT_TAG,
        [GIT_BRANCH]: CI_COMMIT_BRANCH,
        [CI_WORKSPACE_PATH]: CI_PROJECT_DIR,
        [CI_PIPELINE_URL]: GITLAB_PIPELINE_URL && GITLAB_PIPELINE_URL.replace('/-/pipelines/', '/pipelines/'),
        [CI_STAGE_NAME]: CI_JOB_STAGE,
        [CI_JOB_NAME]: GITLAB_CI_JOB_NAME
      }
    }

    if (env.CIRCLECI) {
      const {
        CIRCLE_WORKFLOW_ID,
        CIRCLE_PROJECT_REPONAME,
        CIRCLE_BUILD_NUM,
        CIRCLE_BUILD_URL,
        CIRCLE_WORKING_DIRECTORY,
        CIRCLE_BRANCH,
        CIRCLE_TAG,
        CIRCLE_SHA1,
        CIRCLE_REPOSITORY_URL,
        CIRCLE_JOB
      } = env

      const pipelineUrl = `https://app.circle.com/pipelines/workflows/${CIRCLE_WORKFLOW_ID}`

      tags = {
        [CI_PIPELINE_ID]: CIRCLE_WORKFLOW_ID,
        [CI_PIPELINE_NAME]: CIRCLE_PROJECT_REPONAME,
        [CI_PIPELINE_URL]: pipelineUrl,
        [CI_JOB_NAME]: CIRCLE_JOB,
        [CI_JOB_ID]: CIRCLE_BUILD_NUM,
        [CI_PROVIDER_NAME]: 'circleci',
        [GIT_COMMIT_SHA]: CIRCLE_SHA1,
        [GIT_REPOSITORY_URL]: CIRCLE_REPOSITORY_URL,
        [CI_JOB_URL]: CIRCLE_BUILD_URL,
        [CI_WORKSPACE_PATH]: CIRCLE_WORKING_DIRECTORY,
        [CIRCLE_TAG ? GIT_TAG : GIT_BRANCH]: CIRCLE_TAG || CIRCLE_BRANCH
      }
    }

    if (env.GITHUB_ACTIONS || env.GITHUB_ACTION) {
      const {
        GITHUB_RUN_ID,
        GITHUB_WORKFLOW,
        GITHUB_RUN_NUMBER,
        GITHUB_WORKSPACE,
        GITHUB_HEAD_REF,
        GITHUB_REF,
        GITHUB_SHA,
        GITHUB_REPOSITORY
      } = env

      const repositoryURL = `https://github.com/${GITHUB_REPOSITORY}.git`
      const pipelineURL = `https://github.com/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA}/checks`

      const ref = GITHUB_HEAD_REF || GITHUB_REF || ''
      const refKey = ref.includes('tags') ? GIT_TAG : GIT_BRANCH

      tags = {
        [CI_PIPELINE_ID]: GITHUB_RUN_ID,
        [CI_PIPELINE_NAME]: GITHUB_WORKFLOW,
        [CI_PIPELINE_NUMBER]: GITHUB_RUN_NUMBER,
        [CI_PIPELINE_URL]: pipelineURL,
        [CI_PROVIDER_NAME]: 'github',
        [GIT_COMMIT_SHA]: GITHUB_SHA,
        [GIT_REPOSITORY_URL]: repositoryURL,
        [CI_JOB_URL]: pipelineURL,
        [CI_WORKSPACE_PATH]: GITHUB_WORKSPACE,
        [refKey]: ref
      }
    }

    if (env.APPVEYOR) {
      const {
        APPVEYOR_REPO_NAME,
        APPVEYOR_REPO_PROVIDER,
        APPVEYOR_BUILD_FOLDER,
        APPVEYOR_BUILD_ID,
        APPVEYOR_BUILD_NUMBER,
        APPVEYOR_REPO_COMMIT,
        APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH,
        APPVEYOR_REPO_BRANCH,
        APPVEYOR_REPO_TAG_NAME
      } = env

      const pipelineUrl = `https://ci.appveyor.com/project/${APPVEYOR_REPO_NAME}/builds/${APPVEYOR_BUILD_ID}`

      tags = {
        [CI_PROVIDER_NAME]: 'appveyor',
        [CI_PIPELINE_URL]: pipelineUrl,
        [CI_PIPELINE_ID]: APPVEYOR_BUILD_ID,
        [CI_PIPELINE_NAME]: APPVEYOR_REPO_NAME,
        [CI_PIPELINE_NUMBER]: APPVEYOR_BUILD_NUMBER,
        [CI_JOB_URL]: pipelineUrl,
        [CI_WORKSPACE_PATH]: APPVEYOR_BUILD_FOLDER
      }

      if (APPVEYOR_REPO_PROVIDER === 'github') {
        const refKey = APPVEYOR_REPO_TAG_NAME ? GIT_TAG : GIT_BRANCH
        const ref = APPVEYOR_REPO_TAG_NAME || APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH || APPVEYOR_REPO_BRANCH
        tags = {
          ...tags,
          [GIT_REPOSITORY_URL]: `https://github.com/${APPVEYOR_REPO_NAME}.git`,
          [GIT_COMMIT_SHA]: APPVEYOR_REPO_COMMIT,
          [refKey]: ref
        }
      }
    }

    if (env.TF_BUILD) {
      const {
        BUILD_SOURCESDIRECTORY,
        BUILD_BUILDID,
        BUILD_DEFINITIONNAME,
        SYSTEM_TEAMFOUNDATIONSERVERURI,
        SYSTEM_TEAMPROJECTID,
        SYSTEM_JOBID,
        SYSTEM_TASKINSTANCEID,
        SYSTEM_PULLREQUEST_SOURCEBRANCH,
        BUILD_SOURCEBRANCH,
        BUILD_SOURCEBRANCHNAME,
        SYSTEM_PULLREQUEST_SOURCECOMMITID,
        SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI,
        BUILD_REPOSITORY_URI,
        BUILD_SOURCEVERSION
      } = env

      const ref = SYSTEM_PULLREQUEST_SOURCEBRANCH || BUILD_SOURCEBRANCH || BUILD_SOURCEBRANCHNAME
      const refKey = ref.includes('tags') ? GIT_TAG : GIT_BRANCH

      tags = {
        [CI_PROVIDER_NAME]: 'azurepipelines',
        [CI_PIPELINE_ID]: BUILD_BUILDID,
        [CI_PIPELINE_NAME]: BUILD_DEFINITIONNAME,
        [CI_PIPELINE_NUMBER]: BUILD_BUILDID,
        [GIT_COMMIT_SHA]: SYSTEM_PULLREQUEST_SOURCECOMMITID || BUILD_SOURCEVERSION,
        [CI_WORKSPACE_PATH]: BUILD_SOURCESDIRECTORY,
        [GIT_REPOSITORY_URL]: SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI || BUILD_REPOSITORY_URI,
        [refKey]: ref
      }

      if (SYSTEM_TEAMFOUNDATIONSERVERURI && SYSTEM_TEAMPROJECTID && BUILD_BUILDID) {
        const baseUrl =
          `${SYSTEM_TEAMFOUNDATIONSERVERURI}${SYSTEM_TEAMPROJECTID}/_build/results?buildId=${BUILD_BUILDID}`
        const pipelineUrl = baseUrl
        const jobUrl = `${baseUrl}&view=logs&j=${SYSTEM_JOBID}&t=${SYSTEM_TASKINSTANCEID}`

        tags = {
          ...tags,
          [CI_PIPELINE_URL]: pipelineUrl,
          [CI_JOB_URL]: jobUrl
        }
      }
    }

    if (env.BITBUCKET_COMMIT) {
      const {
        BITBUCKET_REPO_FULL_NAME,
        BITBUCKET_BUILD_NUMBER,
        BITBUCKET_BRANCH,
        BITBUCKET_COMMIT,
        BITBUCKET_GIT_SSH_ORIGIN,
        BITBUCKET_TAG,
        BITBUCKET_PIPELINE_UUID,
        BITBUCKET_CLONE_DIR
      } = env

      const url =
        `https://bitbucket.org/${BITBUCKET_REPO_FULL_NAME}/addon/pipelines/home#!/results/${BITBUCKET_BUILD_NUMBER}`

      tags = {
        [CI_PROVIDER_NAME]: 'bitbucket',
        [GIT_COMMIT_SHA]: BITBUCKET_COMMIT,
        [CI_PIPELINE_NUMBER]: BITBUCKET_BUILD_NUMBER,
        [CI_PIPELINE_NAME]: BITBUCKET_REPO_FULL_NAME,
        [CI_JOB_URL]: url,
        [CI_PIPELINE_URL]: url,
        [GIT_BRANCH]: BITBUCKET_BRANCH,
        [GIT_TAG]: BITBUCKET_TAG,
        [GIT_REPOSITORY_URL]: BITBUCKET_GIT_SSH_ORIGIN,
        [CI_WORKSPACE_PATH]: BITBUCKET_CLONE_DIR,
        [CI_PIPELINE_ID]: BITBUCKET_PIPELINE_UUID && BITBUCKET_PIPELINE_UUID.replace(/{|}/gm, '')
      }
    }

    if (env.BITRISE_BUILD_SLUG) {
      const {
        BITRISE_GIT_COMMIT,
        GIT_CLONE_COMMIT_HASH,
        BITRISEIO_GIT_BRANCH_DEST,
        BITRISE_GIT_BRANCH,
        BITRISE_BUILD_SLUG,
        BITRISE_APP_TITLE,
        BITRISE_BUILD_NUMBER,
        BITRISE_BUILD_URL,
        BITRISE_SOURCE_DIR,
        GIT_REPOSITORY_URL: BITRISE_GIT_REPOSITORY_URL,
        BITRISE_GIT_TAG
      } = env

      const isTag = !!BITRISE_GIT_TAG
      const refKey = isTag ? GIT_TAG : GIT_BRANCH
      const ref = BITRISE_GIT_TAG || BITRISEIO_GIT_BRANCH_DEST || BITRISE_GIT_BRANCH

      tags = {
        [CI_PROVIDER_NAME]: 'bitrise',
        [CI_PIPELINE_ID]: BITRISE_BUILD_SLUG,
        [CI_PIPELINE_NAME]: BITRISE_APP_TITLE,
        [CI_PIPELINE_NUMBER]: BITRISE_BUILD_NUMBER,
        [CI_PIPELINE_URL]: BITRISE_BUILD_URL,
        [GIT_COMMIT_SHA]: BITRISE_GIT_COMMIT || GIT_CLONE_COMMIT_HASH,
        [GIT_REPOSITORY_URL]: BITRISE_GIT_REPOSITORY_URL,
        [CI_WORKSPACE_PATH]: BITRISE_SOURCE_DIR,
        [refKey]: ref
      }
    }

    if (env.BUILDKITE) {
      const {
        BUILDKITE_BRANCH,
        BUILDKITE_COMMIT,
        BUILDKITE_REPO,
        BUILDKITE_TAG,
        BUILDKITE_BUILD_ID,
        BUILDKITE_PIPELINE_SLUG,
        BUILDKITE_BUILD_NUMBER,
        BUILDKITE_BUILD_URL,
        BUILDKITE_JOB_ID,
        BUILDKITE_BUILD_CHECKOUT_PATH
      } = env

      const ref = BUILDKITE_TAG || BUILDKITE_BRANCH
      const refKey = BUILDKITE_TAG ? GIT_TAG : GIT_BRANCH

      tags = {
        [CI_PROVIDER_NAME]: 'buildkite',
        [CI_PIPELINE_ID]: BUILDKITE_BUILD_ID,
        [CI_PIPELINE_NAME]: BUILDKITE_PIPELINE_SLUG,
        [CI_PIPELINE_NUMBER]: BUILDKITE_BUILD_NUMBER,
        [CI_PIPELINE_URL]: BUILDKITE_BUILD_URL,
        [CI_JOB_URL]: `${BUILDKITE_BUILD_URL}#${BUILDKITE_JOB_ID}`,
        [GIT_COMMIT_SHA]: BUILDKITE_COMMIT,
        [CI_WORKSPACE_PATH]: BUILDKITE_BUILD_CHECKOUT_PATH,
        [GIT_REPOSITORY_URL]: BUILDKITE_REPO,
        [refKey]: ref
      }
    }

    if (env.TRAVIS) {
      const {
        TRAVIS_PULL_REQUEST_BRANCH,
        TRAVIS_BRANCH,
        TRAVIS_COMMIT,
        TRAVIS_REPO_SLUG,
        TRAVIS_TAG,
        TRAVIS_JOB_WEB_URL,
        TRAVIS_BUILD_ID,
        TRAVIS_BUILD_NUMBER,
        TRAVIS_BUILD_WEB_URL,
        TRAVIS_BUILD_DIR
      } = env

      const isTag = !!TRAVIS_TAG
      const ref = TRAVIS_TAG || TRAVIS_PULL_REQUEST_BRANCH || TRAVIS_BRANCH
      const refKey = isTag ? GIT_TAG : GIT_BRANCH

      tags = {
        [CI_PROVIDER_NAME]: 'travisci',
        [CI_JOB_URL]: TRAVIS_JOB_WEB_URL,
        [CI_PIPELINE_ID]: TRAVIS_BUILD_ID,
        [CI_PIPELINE_NAME]: TRAVIS_REPO_SLUG,
        [CI_PIPELINE_NUMBER]: TRAVIS_BUILD_NUMBER,
        [CI_PIPELINE_URL]: TRAVIS_BUILD_WEB_URL,
        [GIT_COMMIT_SHA]: TRAVIS_COMMIT,
        [GIT_REPOSITORY_URL]: `https://github.com/${TRAVIS_REPO_SLUG}.git`,
        [CI_WORKSPACE_PATH]: TRAVIS_BUILD_DIR,
        [refKey]: ref
      }
    }

    normalizeTag(tags, CI_WORKSPACE_PATH, resolveTilde)
    normalizeTag(tags, GIT_REPOSITORY_URL, filterSensitiveInfoFromRepository)
    normalizeTag(tags, GIT_BRANCH, normalizeRef)
    normalizeTag(tags, GIT_TAG, normalizeRef)

    return removeEmptyValues(tags)
  }
}
