# cubx-prepare-webpackage-release

[![Build Status](https://travis-ci.org/cubbles/cubx-prepare-webpackage-release.svg?branch=master)](https://travis-ci.org/cubbles/cubx-prepare-webpackage-release)

Module for releasing a new version of a webpackage.

## Usage: 
### Command line: 

```
cubx-prepare-webpackage-release -p <webpackagPath> [-r <releaseVersion> -n <nextVersion>]
```

### Other npm modules

```
var webpackagePath = ...
var releaseVersion = ...
var nextVersion = ...
var options = {releaseVersion: releaseVersion, nextVersion: nextVersion}
var WebpackageReleasePreparer = requiere('cubx-prepare-webpackage-release');
var wpReleasePreparer = new WebpackageReleasePreparer(webpackagePath, options);
wpReleasePreparer.prepareUpload();
```

### Optional parameters

`-r (releaseVersion)` and `-n (nextVersion)` are optional parameters. If not provided, 
their default values will be:
* `-r (releaseVersion)`: current version without _-SNAPSHOT_ suffix (e.g. 1.2.3-SNAPSHOT -> 1.2.3).
* `-n (nextVersion)`: next minor development version (e.g. 1.2.3 -> 1.3.0-SNAPSHOT).