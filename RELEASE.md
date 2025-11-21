# Release Process

This document describes how to create a new release of `playwright-ibutsu`.

## Overview

The package uses dynamic versioning - the version number is automatically set from the Git tag during the release process. The `package.json` file contains a development version (`0.0.0-development`) that is replaced at publish time.

## Creating a Release

### 1. Ensure main branch is ready

Make sure all changes you want to include in the release are merged to the `main` branch and all tests pass.

### 2. Create and push a Git tag

Create a Git tag with the version number (with or without a `v` prefix):

```bash
# Create a tag for version 0.0.2
git tag v0.0.2

# Or without the 'v' prefix (both work)
git tag 0.0.2

# Push the tag to GitHub
git push origin v0.0.2
```

### 3. Create a GitHub Release

1. Go to the [Releases page](https://github.com/ibutsu/playwright-ibutsu/releases)
2. Click "Draft a new release"
3. Select the tag you just created (e.g., `v0.0.2`)
4. Enter a release title (e.g., `v0.0.2`)
5. Add release notes describing what changed
6. Click "Publish release"

### 4. Automatic Publication

Once the GitHub release is published, the following happens automatically:

1. The `publish.yml` workflow is triggered
2. The workflow extracts the version from the tag
3. It updates `package.json` with the correct version
4. Tests are run
5. The package is built
6. The package is published to npm with the tagged version

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **Major version** (X.0.0): Breaking changes
- **Minor version** (0.X.0): New features, backwards compatible
- **Patch version** (0.0.X): Bug fixes, backwards compatible

Examples:
- `v0.0.2` - Patch release
- `v0.1.0` - Minor release with new features
- `v1.0.0` - Major release with breaking changes

## Troubleshooting

### Release workflow failed

1. Check the [Actions tab](https://github.com/ibutsu/playwright-ibutsu/actions) for error details
2. Common issues:
   - Tests failed: Fix the tests and create a new tag
   - NPM authentication failed: Check the `NPM_TOKEN` secret
   - Version already exists on npm: Use a different version number

### Fixing a failed release

If a release fails:

1. Delete the GitHub release
2. Delete the Git tag locally and remotely:
   ```bash
   git tag -d v0.0.2
   git push origin :refs/tags/v0.0.2
   ```
3. Fix the issue
4. Create a new tag and release

## Pre-release Versions

For testing, you can create pre-release versions:

```bash
git tag v0.0.2-beta.1
git push origin v0.0.2-beta.1
```

When creating the GitHub release, check the "This is a pre-release" checkbox.

