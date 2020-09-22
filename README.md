# create-merge-pr

This action downloads creates a pull request and automatically merges it.

It will create a pull request for a branch based on a github token provided. 
Every 30 seconds it will attempt to get the PR state. Onces the state is clean it will auto merge into the repo specified

## Parameters

| Parameter | Description |
| ----------- | -------- |
| github-token | Personal access token used to approve and merge the pull request (github action bot can be used for this using ${{ secrets.GITHUB_TOKEN }}) |
| artifact-github-token | Personal access token used to create the pull request |
| github-owner | The owner of the repo being used |
| github-repo | The repo you want to create and merge the PR |
| branch-ref | The branch to base the pull request from |
| title | Name of the pull request |

## Usage

To use the action you will need to add in several parameters

```
name: Build and Release
on:
  pull_request:
jobs:
  create-and-merge-pr:
    name: Create Kubernetes Manifest PR And Merge
    runs-on: zendesk-stable
    # we only run jobs after a merge to master and if a pull_request doesn't have the `skip_manifest_generation` label
    if: github.event.pull_request.merged == true && !contains(github.event.pull_request.labels.*.name, 'skip_manifest_generation')
    needs:
      - generate_kubernetes_manifests
    steps:
      - uses: zendesk/talk-create-merge-pr@v12
        with:
           github-token: ${{ secrets.GITHUB_TOKEN }}
           artifact-github-token: ${{ secrets.ZD_SVC_TALK }}
           github-owner: "zendesk"
           github-repo: "voice"
           branch-ref: ${{ needs.generate_kubernetes_manifests.outputs.deploy_branch }}
           title: "Automatic Merge of Re-generated Kubernetes Manifests"
```
