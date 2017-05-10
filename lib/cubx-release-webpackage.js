/**
 * Created by Edwin Gamboa on 08/05/2017.
 */

(function () {
  'use strict';

  var fs = require('fs-extra');
  var path = require('path');

  /**
   * The ReleaseWebpackage can be used to release a webpackage
   * @class ReleaseWebpackage
   * @global
   * @constructor
   * @param {string} webpackagePath - path of the webpackage to release
   * @param {string} options - Version options provided by the user
   */
  var ReleaseWebpackage = function (webpackagePath, options) {
    if (!webpackagePath) {
      console.error('WebpackageConverter: Missed parameter for webpackage path.');
      throw new Error('Missed parameter for webpackage path.');
    }
    if (!path.isAbsolute(webpackagePath)) {
      this._webpackagePath = path.join(process.cwd(), webpackagePath);
    } else {
      this._webpackagePath = webpackagePath;
    }
    this.manifestPath = path.resolve(this._webpackagePath, 'manifest.webpackage');
    this.options = options || {};
  };

  /**
   * Validate or set options (releaseVersion and nextVersion), if everything goes well, the
   * version of the manifest is updated to options.releaseVersion
   */
  ReleaseWebpackage.prototype.prepareUpload = function () {
    this.manifest = this._loadManifest();
    var snapshotDeps = this._getDepsInDevelopment(this.manifest.artifacts);
    if (snapshotDeps.length > 0) {
      console.error(
        'ReleaseWebpackage: To release a webpackage its dependencies can not be under ' +
        'development (i.e. their version can not have -SNAPSHOT suffix). Please review ' +
        'following dependencies:\n' + this._dependenciesListToString(snapshotDeps)
      );
      throw new Error('Not released dependencies');
    }
    if (this.options.hasOwnProperty('releaseVersion')) {
      if (!this._isValidReleaseVersion(this.options.releaseVersion)) {
        console.error(
          'ReleaseWebpackage: The provided release version (' + this.options.releaseVersion +
          ') is not valid, it can only contain numbers or numbers separated by dots ' +
          '(e.g. 1.0, 1.3.1, 1)'
        );
        throw new Error('Invalid release version');
      }
    } else {
      this.options.releaseVersion = this._determineReleaseVersion(this.manifest.version);
    }
    if (this.options.hasOwnProperty('nextVersion')) {
      if (!this._isValidDevVersion(this.options.nextVersion)) {
        console.error(
          'ReleaseWebpackage: The provided next development version (' + this.options.nextVersion +
          ') is not valid, it can only contain numbers or dot separated numbers. And it should ' +
          'finish with the \'-SNAPSHOT\' (e.g. 1.0-SNAPSHOT, 1.3.1-SNAPSHOT, 1-SNAPSHOT)'
        );
        throw new Error('Invalid development version');
      }
    } else {
      this.options.releaseVersion = this._determineReleaseVersion(this.manifest.version);
    }
    this.updateManifestToReleaseVersion();
  };

  /**
   * Update (write) the manifest with an the version set to options.releaseVersion
   */
  ReleaseWebpackage.prototype.updateManifestToReleaseVersion = function () {
    this.manifest.version = this.options.releaseVersion;
    this._writeManifest(this.manifest);
  };

  /**
   * Update (write) the manifest with an the version set to options.nextVersion
   */
  ReleaseWebpackage.prototype.updateManifestToNextDevVersion = function () {
    this.manifest.version = this.options.nextVersion;
    this._writeManifest(this.manifest);
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
  ReleaseWebpackage.prototype._dependenciesListToString = function (depsList) {
    var string = '';
    depsList.forEach(function (dep) {
      string += '\tArtifact: ' + dep.artifactId +
        '\tReferred Dependency: ' + JSON.stringify(dep.dependency) + '\n';
    });
    return string;
  };

  /**
   * Write the manifest in a file in this.manifestPath
   * @param {object} manifest - Manifest to be written
   * @private
   */
  ReleaseWebpackage.prototype._writeManifest = function (manifest) {
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  };

  /**
   * Load the manifest from this.manifestPath
   * @returns {object} - Loaded manifest
   * @private
   */
  ReleaseWebpackage.prototype._loadManifest = function () {
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
  ReleaseWebpackage.prototype._getDepsInDevelopment = function (artifacts) {
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
   * Determines whether a version is a valid release or fixed version (e.g. 1, 2.3, 1.0.0)
   * @param {string} version - Version to be validated.
   * @returns {boolean}
   * @private
   */
  ReleaseWebpackage.prototype._isValidReleaseVersion = function (version) {
    var pattern = /^(\d+)(\.[\d]+)*$/;
    return pattern.test(version);
  };

  /**
   * Determines whether a version is a valid development version (e.g. 1-SNAPSHOT, 2.3-SNAPSHOT)
   * @param {string} version - Version to be validated.
   * @returns {boolean}
   * @private
   */
  ReleaseWebpackage.prototype._isValidDevVersion = function (version) {
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
  ReleaseWebpackage.prototype._determineReleaseVersion = function (currentVersion) {
    if (this._isValidDevVersion(currentVersion)) {
      return currentVersion.substr(0, currentVersion.indexOf('-SNAPSHOT'));
    } else {
      console.error(
        'ReleaseWebpackage: The current version of the webpackage (' + currentVersion + ') is not ' +
        'a valid development version, it can only contain numbers or dot separated numbers. And ' +
        'it should finish with the \'-SNAPSHOT\' (e.g. 1.0-SNAPSHOT, 1.3.1-SNAPSHOT, 1-SNAPSHOT)'
      );
      throw new Error('Invalid development version');
    }
  };

  /**
   * Determine the next development version based on currentVersion
   * @param {string} currentVersion - Version which is supposed to be the current version of
   * the webpackage. It should be a release version (i.e. without the '-SNAPSHOT' suffix)
   * @returns {string}
   * @private
   */
  ReleaseWebpackage.prototype._determineNextDevVersion = function (currentVersion) {
    if (this._isValidReleaseVersion(currentVersion)) {
      var lastDotPos = currentVersion.lastIndexOf('.');
      if (lastDotPos === -1) {
        lastDotPos = -1;
      }
      var lastDigit = parseInt(currentVersion.substr(lastDotPos + 1));
      return currentVersion.substr(0, lastDotPos + 1) + (lastDigit + 1) + '-SNAPSHOT';
    } else {
      console.error(
        'ReleaseWebpackage: The provided release version (' + currentVersion + ') is not valid it ' +
        'can only contain numbers or dot separated numbers (e.g. 1.0, 1.3.1, 1)'
      );
      throw new Error('Invalid release version');
    }
  };

  exports = module.exports = ReleaseWebpackage;
}());
