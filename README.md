# ftrack-actions

This is a collection of reusable actions and workflow that we use on ftrack owned repositories.

## Actions

### check-pr-title

Checks the PR title to make sure it confirms to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### ftrack-sync

Syncs the status of a PR with an ftrack task.

## Workflows

### pr-base

A collection of generic workflows that should be run on all PRs.

## External usage

ftrack-actions is currently only supported for use in repositories within the ftrack organization.

If you have issues running them in external repositories, while it might work and we try not to introduce breaking changes, this is currently not a supported use case and actions may break for any reason.
