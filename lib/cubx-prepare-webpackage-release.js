/**
 * Created by Edwin Gamboa on 08/05/2017.
 */

(function () {
  'use strict';

  var fs = require('fs-extra');
  var path = require('path');
  var WebpackageVersionSetter = require('cubx-set-webpackage-version');

  /**
   * The WebpackageReleasePreparer can be used to release a webpackage
   * @class WebpackageReleasePreparer
   * @global
   * @constructor
   * @param {string} webpackagePath - path of the webpackage to release
   * @param {string} options - Version options provided by the user
   */
  var WebpackageReleasePreparer = function (webpackagePath, options) {
    if (!webpackagePath) {
      console.error('WebpackageReleasePreparer: Missed parameter for webpackage path.');
      throw new Error('Missed webpackagePath parameter');
    }
    if (!path.isAbsolute(webpackagePath)) {
      this._webpackagePath = path.join(process.cwd(), webpackagePath);
    } else {
      this._webpackagePath = webpackagePath;
    }
    this.manifestPath = path.resolve(this._webpackagePath, 'manifest.webpackage');
    this.options = options || {};
    this.manifest = this._loadManifest();
  };

  /**
   * Validate or set options (releaseVersion and nextVersion), if everything goes well, the
   * version of the manifest is updated to options.releaseVersion
   */
  WebpackageReleasePreparer.prototype.prepareUpload = function () {
    var snapshotDeps = this._getDepsInDevelopment(this.manifest.artifacts);
    if (snapshotDeps.length > 0) {
      console.error(
        'WebpackageReleasePreparer: To release a webpackage its dependencies can not be under ' +
        'development (i.e. their version can not have the -SNAPSHOT suffix). Please review ' +
        'following dependencies:\n' + this._dependenciesListToString(snapshotDeps)
      );
      throw new Error('Not released dependencies');
    }
    if (this.options.hasOwnProperty('releaseVersion')) {
      if (!this.isValidReleaseVersion(this.options.releaseVersion)) {
        console.error(
          'WebpackageReleasePreparer: The provided release version (' + this.options.releaseVersion +
          ') is not valid, it can only contain numbers or numbers separated by dots ' +
          '(e.g. 1.0, 1.3.1, 1)'
        );
        throw new Error('Invalid release version');
      }
    } else {
      this.options.releaseVersion = this.getDefaultReleaseVersion(this.manifest.version);
    }
    if (this.options.hasOwnProperty('nextVersion')) {
      if (!this.isValidDevVersion(this.options.nextVersion)) {
        console.error(
          'WebpackageReleasePreparer: The provided next development version (' + this.options.nextVersion +
          ') is not valid, it can only contain numbers or dot separated numbers. And it should ' +
          'finish with the \'-SNAPSHOT\' (e.g. 1.0-SNAPSHOT, 1.3.1-SNAPSHOT, 1-SNAPSHOT)'
        );
        throw new Error('Invalid development version');
      }
    } else {
      this.options.releaseVersion = this.getDefaultReleaseVersion(this.manifest.version);
    }
    this.updateManifestToReleaseVersion();
  };

  /**
   * Update (write) the manifest with an the version set to options.releaseVersion
   */
  WebpackageReleasePreparer.prototype.updateManifestToReleaseVersion = function () {
    this._updateVersion(this.options.releaseVersion);
  };

  /**
   * Update (write) the manifest with an the version set to options.nextVersion
   */
  WebpackageReleasePreparer.prototype.updateManifestToNextDevVersion = function () {
    this._updateVersion(this.options.nextVersion);
  };

  /**
   * Determines whether a version is a valid release or fixed version (e.g. 1, 2.3, 1.0.0)
   * @param {string} version - Version to be validated.
   * @returns {boolean}
   * @private
   */
  WebpackageReleasePreparer.prototype.isValidReleaseVersion = function (version) {
    var pattern = /^(\d+)(\.[\d]+)*$/;
    return pattern.test(version);
  };

  /**
   * Determines whether a version is a valid development version (e.g. 1-SNAPSHOT, 2.3-SNAPSHOT)
   * @param {string} version - Version to be validated.
   * @returns {boolean}
   * @private
   */
  WebpackageReleasePreparer.prototype.isValidDevVersion = function (version) {
    var pattern = /^(\d+)(\.[\d]+)*(-SNAPSHOT)$/;
    return pattern.test(version);
  };

  /**
   * Determine the release version based on currentVersion
   * @param {string} currentVersion - Version which is supposed to be the current version of
   * the webpackage. It should be a development version (i.e. with the '-SNAPSHOT' suffix)
   * @returns {string}
   * @private
   */
  WebpackageReleasePreparer.prototype.getDefaultReleaseVersion = function (currentVersion) {
    if (this.isValidDevVersion(currentVersion)) {
      return currentVersion.substr(0, currentVersion.indexOf('-SNAPSHOT'));
    } else {
      console.error(
        'WebpackageReleasePreparer: The current version of the webpackage (' + currentVersion + ') is not ' +
        'a valid development version, it can only contain numbers or dot separated numbers. And ' +
        'it should finish with the \'-SNAPSHOT\' (e.g. 1.0-SNAPSHOT, 1.3.1-SNAPSHOT, 1-SNAPSHOT)'
      );
      throw new Error('Invalid development version');
    }
  };

  /**
   * Determine the next development version based on currentVersion (minor version)
   * @param {string} currentVersion - Version which is supposed to be the current version of
   * the webpackage. It should be a release version (i.e. without the '-SNAPSHOT' suffix)
   * @returns {string}
   * @private
   */
  WebpackageReleasePreparer.prototype.getDefaultNextDevVersion = function (currentVersion) {
    if (this.isValidReleaseVersion(currentVersion)) {
      var firstDotPos = currentVersion.indexOf('.');
      if (firstDotPos === -1) {
        currentVersion += '.';
        firstDotPos = currentVersion.indexOf('.');
      }
      var lastDotPos = currentVersion.lastIndexOf('.');
      var minorDigit = parseInt(currentVersion.substr(firstDotPos + 1, lastDotPos)) || 0;
      return currentVersion.substr(0, firstDotPos + 1) + (minorDigit + 1) + '.0-SNAPSHOT';
    } else {
      console.error(
        'WebpackageReleasePreparer: The provided release version (' + currentVersion + ') is not valid it ' +
        'can only contain numbers or dot separated numbers (e.g. 1.0, 1.3.1, 1)'
      );
      throw new Error('Invalid release version');
    }
  };

  /**
   * Load the manifest from this.manifestPath
   * @returns {object} - Loaded manifest
   * @private
   */
  WebpackageReleasePreparer.prototype._loadManifest = function () {
    var manifest = fs.readFileSync(this.manifestPath, 'utf8');
    return typeof manifest === 'string' ? JSON.parse(manifest) : manifest;
  };

  /**
   * Get the list of the dependencies, which are under development and are referred by some
   * artifact in the webpackage
   * @param {object} artifacts - Artifacts of the manifest
   * @returns {Array}
   * @private
   */
  WebpackageReleasePreparer.prototype._getDepsInDevelopment = function (artifacts) {
    var snapshotDeps = [];
    Object.keys(artifacts).forEach(function (artifactType) {
      artifacts[ artifactType ].forEach(function (artifact) {
        if (artifact.hasOwnProperty('dependencies') && artifact.dependencies.length > 0) {
          artifact.dependencies.forEach(function (dep) {
            if (dep.hasOwnProperty('webpackageId') && dep.webpackageId.indexOf('-SNAPSHOT') !== -1) {
              snapshotDeps.push(
                {
                  artifactId: artifact.artifactId,
                  dependency: {artifactId: dep.artifactId, webpackageId: dep.webpackageId}
                });
            }
          });
        }
      });
    });
    return snapshotDeps;
  };

  /**
   * Write the manifest in a file in this.manifestPath
   * @param {object} manifest - Manifest to be written
   * @private
   */
  WebpackageReleasePreparer.prototype._updateVersion = function (version) {
    var wpVersionSetter = new WebpackageVersionSetter(this._webpackagePath, version);
    wpVersionSetter.setManifestVersion();
  };

  /**
   * Creates a string describing each dependency in depsList
   * @param {Array} depsList - Array containing the dependencies in development, which are to be
   * described by the string. Elements in the list have following structure:
   *    {
   *      artifactId: 'my-artifact',
   *      dependency: {artifactId: 'my-dep', webpackageId: 'my-dep-wp@1.0'}
   *    }
   * @returns {string}
   * @private
   */
  WebpackageReleasePreparer.prototype._dependenciesListToString = function (depsList) {
    var string = '';
    depsList.forEach(function (dep) {
      string += '\tArtifact: ' + dep.artifactId +
        '\tReferred Dependency: ' + JSON.stringify(dep.dependency) + '\n';
    });
    return string;
  };

  exports = module.exports = WebpackageReleasePreparer;
}());
