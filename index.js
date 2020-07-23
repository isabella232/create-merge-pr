const core = require('@actions/core')
const github = require('@actions/github')

const DEFAULT_ALLOWED_SOURCE_BRANCH_LIST = ['master']
const GITHUB_OWNER = core.getInput('github-owner')
const GITHUB_REPO = core.getInput('github-repo')
const BRANCH_REF = core.getInput('branch-ref')
const PR_AUTO_LABEL_NAME = core.getInput('label')
const BOT_USER_NAME = core.getInput('bot-user-name')

const githubToken_action = core.getInput('github-token')
const githubToken_artifact = core.getInput('artifact-github-token')
const octokit_action = new github.GitHub(githubToken_action)
const octokit_artifact = new github.GitHub(githubToken_artifact)


function writeError(msg) {
  console.log(`Error: ${msg}`)
}

async function createPullRequest (head, base, title, body) {
  try {
    const { data: pullRequest } = await octokit_artifact.pulls.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,

      head: head,
      base: base,
      title: title,
      body: body,

      maintainer_can_modify: true
    })

    return pullRequest
  } catch (error) {
    writeError(`failed to create pull request: ${error}`)
  }
}

async function createLabel (pullRequestNum) {
  try {
    const { data: label } = await octokit_artifact.issues.addLabels({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      issue_number: pullRequestNum,
      labels: [PR_AUTO_LABEL_NAME]
    })

    return label
  } catch (error) {
    writeError(`failed to create label for pull request: ${error}`)
  }
}

async function getPrMergeableState (pullRequestNum) {
  return new Promise((resolve, reject) => {
    let tries = 0
    const retryUntilStateKnown = async () => {
      try {
        tries++
        const pullRequest = await getPullRequest(pullRequestNum)
        const prMergeState = pullRequest.mergeable_state
        console.log(prMergeState)
        if (prMergeState === 'clean' || prMergeState === 'dirty') {
          resolve(prMergeState)
          return
        } else if (tries > 7) {
          console.log('Pull request mergeable state is unknown')
          reject(new Error('Pull request mergeable state is unknown'))
          return
        } else {
          if (prMergeState === 'unstable') {
            const state = await stateOfChecksAndStatus(pullRequest.head.sha)
            if (state === 'resolve') {
              console.log('Pull request clean state because of github action')
              resolve('clean')
              return
            } else if (state === 'reject') {
              console.log('Pull request rejected because of some failure')
              reject(prMergeState)
              return
            }
          }
          // Total time given to PR stable minutes:seconds
          // Interval 1 - 0:33
          // Interval 2 - 1:07
          // Interval 3 - 1:40
          // Interval 4 - 2:13
          // Interval 5 - 2:47
          // Interval 6 - 3.20
          // Total      - 10.6
          const timeout = Math.floor((10000 * (tries * 10)) / 3)
          console.log('timeout', timeout)
          setTimeout(retryUntilStateKnown, timeout)
        }
      } catch (error) {
        console.log(`Failed getting merge state of pull request: ${error}`)
        reject(error)
      }
    }
    retryUntilStateKnown()
  })
}

async function approvePullRequest (pullRequestNum) {	
  try {	
    console.log('Approving pull request')	
    await octokit_action.pulls.createReview({	
      owner: GITHUB_OWNER,	
      repo: GITHUB_REPO,	
      pull_number: pullRequestNum,	
      event: 'APPROVE'	
    })	
  } catch (error) {	
    core.setFailed(`Failed to approve pull request: ${error}`)	
  }	
}

async function mergePullRequest (pullRequestNum) {
  try {
    console.log('Merging pull request')
    await octokit_action.pulls.merge({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: pullRequestNum
    })
  } catch (error) {
    core.setFailed(`Failed to merge pull request: ${error}`)
  }
}

async function getPullRequest (pullRequestNum) {
  try {
    const { data: pullRequest } = await octokit_action.pulls.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      pull_number: pullRequestNum
    })

    return pullRequest
  } catch (error) {
    console.log(`Failed to get pull request data: ${error}`)
  }
}

try {
  const run = async () => {
    // fetch action inputs
    const title = core.getInput('title') 
    const body = core.getInput('body')
    let base = core.getInput('base')

    if (base === '') {
      // if not given, default target branch for the created PR is 'master'
      base = 'master'
    }

    console.log(`GitHub owner: ${GITHUB_OWNER} GitHub repo: ${GITHUB_REPO}`) 

    function defaultMsg(str, markdown) {
      if (str === '') {
        let quoteIt = ''
        if (markdown) {
          quoteIt = '`'
        }
      }

      return str
    }

    console.log(`BRANCH REF: ${BRANCH_REF}`) 
    const pullRequest = await createPullRequest(BRANCH_REF, base, defaultMsg(title), defaultMsg(body, true))
    if (pullRequest === undefined) {
      core.setFailed('unable to create pull request')
      return
    }
    const pullRequestNum = pullRequest.number

    console.log(`Pull request #${pullRequestNum} successfully created`)
    createLabel(pullRequest.number)

    // Start of PR Merge
    isApproved = await approvePullRequest(pullRequestNum)

    mergePullRequest(pullRequestNum)

  }

  run()
} catch (error) {
  core.setFailed(`Action failed: ${error}`)
}
