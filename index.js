/*
 * gulp-force-developer
 * https://github.com/jkentjnr/gulp-force-developer
 *
 * Copyright (c) 2015 James Kent
 * Licensed under the MIT license.
 */

'use strict';

const gulpPluginName = 'gulp-force-developer';

var gulp = require('gulp'),
  crypto = require('crypto'),
  fs = require('fs-extra'),
    path = require('path'),
    archiver = require('archiver'),
    //nforce = require('nforce'),
    //meta = require('nforce-metadata')(nforce),
    glob = require('glob-all');

// Default options
var opt = {
  action: 'package',
  apiVersion: 34,
  fileChangeHashFile: '.force-developer.filehash.json',
  fileChangeHashStagingFile: '.force-developer.filehash.staging.json',
  forcePackageContinueSilent: false,
  projectBaseDirectory: 'project',
  outputDirectory: '.package',
  outputTempDirectory: 'src',
  outputPackageZip: './.package/package.zip',
  metadataSourceDirectory: 'app-metadata',
  environment: 'production',
  pollInterval: 500,
  mockResources: []
};

var force = {
  options: opt,

  parsePackageJsonConfiguration: function(options) {

    const packageFile = './package.json';

    // Read configuration from package.json (if possible).
    if (fs.existsSync(packageFile) === true) {
      var config = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      if (config.forceDeveloperConfig !== undefined) {
        for (var attrname in config.forceDeveloperConfig) {
          options[attrname] = config.forceDeveloperConfig[attrname];
        }
      }
    }

    return options;
  },

  deletePackageOutput: function(options, cache) {

    if (cache === true) {
      if (fs.existsSync('./' + options.outputDirectory))
        fs.removeSync('./' + options.outputDirectory);
    }
    else {
      if (fs.existsSync('./' + options.outputDirectory + '/package.xml'))
        fs.removeSync('./' + options.outputDirectory + '/package.xml');

      if (fs.existsSync('./' + options.outputDirectory + '/' + options.outputTempDirectory))
        fs.removeSync('./' + options.outputDirectory + '/' + options.outputTempDirectory);
    }
  },

  commitChangesToHashfile: function(options) {

    var fileDiffLive = './' + options.outputDirectory + '/' + options.fileChangeHashFile;
    var fileDiffStage = './' + options.outputDirectory + '/' + options.fileChangeHashStagingFile;

    // Commit the staged changes to the most recent hashfile.
    fs.copySync(fileDiffStage, fileDiffLive);
  },

  evaluateProjectFiles: function(options, packageAll) {

    // TODO: Add support for delete (?)

    // Used to track what actions need to take place.
    var metadataAction = {};

    var fileDiffLive = './' + options.outputDirectory + '/' + options.fileChangeHashFile;
    var fileDiffStage = './' + options.outputDirectory + '/' + options.fileChangeHashStagingFile;

    // Read the hash file (if possible)
    var fileDiff = (fs.existsSync(fileDiffLive))
      ? fs.readJsonSync(fileDiffLive)
      : {};

    // Iterate through all folders under the project folder.
    glob.sync('./' + options.projectBaseDirectory + '/**/').forEach(function(dir) {
    //grunt.file.expand({ filter: 'isDirectory' }, './' + options.projectBaseDirectory + '/**').forEach(function(dir) {

      // TODO - check for config file.
      // If config file - check for processor.  If custom processor, hand off processing
      // customProc(dir, metadataAction, fillDiff)

      // If no custom provider, iterate through all files in the folder.
      glob.sync([dir + '*.*', '!' + dir, '!' + dir + 'force.config', '!' + dir + '*-meta.xml']).forEach(function(f) {
      //grunt.file.expand({ filter: 'isFile' }, [dir + '/*', '!' + dir + '/force.config', '!' + dir + '/*-meta.xml']).forEach(function(f) {

        var bIncludeFile = (packageAll === true);

        // Check to see if there is any difference in the file.
        if (packageAll !== true) {

          // Read the file into memory
          var data = fs.readFileSync(f, 'utf8') //grunt.file.read(f);

          // Get any previous hash for the file.
          var existingHash = fileDiff[f];

          // Generate a hash for the data in the current file.
          var currentHash = crypto
            .createHash('md5')
            .update(data)
            .digest('hex');

          // Save the latest hash for the file.
          fileDiff[f] = currentHash;

          if (existingHash != currentHash) {
            // If yes -- put an 'add' action for the file in the action collection.
            bIncludeFile = true;
          }

        }

        // Add the file to the package.
        if (bIncludeFile === true) {
          console.log((packageAll === true ? 'Include' : 'Change') + ': ' + f);
          metadataAction[f] = { add: true };
        }

      });

    });

    // Persist the hashes to the staging file.
    fs.ensureFileSync(fileDiffStage);
    fs.writeJsonSync(fileDiffStage, fileDiff);

    // Return the actions to be performed.
    return metadataAction;

  },

  mockResources: function(options) {

    const staticResourcePath = 'staticresources';
    const staticResourceExt = '.resource';

    // Create a path to the temp output dir.  This will house the unpackaged package.xml and source
    var target = './' + options.outputDirectory + '/' + options.outputTempDirectory + '/' + staticResourcePath + '/';

    options.mockResources.forEach(function(resource) {

      var staticResourceFilename = resource + staticResourceExt;

      // ----------------------------------
      // Build the metadata

      var metadataFilename = staticResourceFilename + '-meta.xml';
      var metadataTarget = target + '/' + metadataFilename;

      buildMetadata(staticResourceFilename, metadataTarget, options, true);

      // ----------------------------------
      // Create a text file as the resource

      console.log('Mocking Resource: ' + staticResourceFilename);
      var output = fs.createWriteStream(target + staticResourceFilename);
      output.end();

    });

  },

  generatePackageStructure: function(options, metadataAction) {

    // TODO: make the packager customisable.
    // Suggestion: Make a packager for classes, pages and components that allows you to put the metadata in the source.

    // Create a path to the temp output dir.  This will house the unpackaged package.xml and source
    var targetSrc = './' + options.outputDirectory + '/' + options.outputTempDirectory + '/';

    //
    var copier = function(options, f, objectDir, hasMetadata) {

      var target = targetSrc + objectDir;

      var sourceFilename = path.basename(f);
      var targetFilename = target + '/' + sourceFilename;

      fs.ensureFileSync(targetFilename);
      fs.copySync(f, targetFilename);

      if (hasMetadata) {

        var metadataFilename = sourceFilename + '-meta.xml';
        var metadataTarget = target + '/' + metadataFilename;

        var matches = glob.sync(
          options.projectBaseDirectory + '/**/*' + metadataFilename
        );

        if (matches.length > 0) {
          fs.ensureFileSync(metadataTarget);
          fs.copySync(matches[0], metadataTarget);
        }
        else {
          var metadataSource = './' + options.projectBaseDirectory + '/' + options.metadataSourceDirectory + '/' + metadataFilename;

          console.log('Generating metadata - ' + metadataTarget);
          buildMetadata(f, metadataTarget, options);
        }

      }
    };

    var includeBundleSibblings = function(bundleDir, packagePaths) {
      var dirListing = fs.readdirSync(bundleDir);
      for (var bundleFile of dirListing) {
        var bundleFilePath = bundleDir + '/' + bundleFile;
        if (!packagePaths[bundleFilePath] && !fs.statSync(bundleFilePath).isDirectory()) {
          var packagePath = getPackagePath(dir, path.extname(bundleFilePath), bundleFilePath);
          if (packagePath && packagePath.isBundleItem) {
            console.log('Include: ' + bundleFilePath);
            packagePaths[bundleFilePath] = packagePath;
          } else {
            console.log('Skipping file (Not a Bundle Item) - ' + bundleFilePath);
          }
        }
      }
    };

    var packagePaths = {};
    for(var f in metadataAction) {

      var ext = path.extname(f);
      var dir = path.basename(path.dirname(f));

      // TODO: Check for custom packager for a file ext.

      var packagePath = getPackagePath(dir, ext, f);
      if (packagePath !== undefined) {
        packagePaths[f] = packagePath;
        if (packagePath.isBundleItem) {
          // include everything in the bundle
          includeBundleSibblings(path.dirname(f), packagePaths);
        }
      }
      else {
        console.log('Skipping file (Missing Extension Support) - ' + f);
      }

    }

    for (var f in packagePaths) {
      copier(options, f, packagePaths[f].folderName, packagePaths[f].hasMetadata);
    }

    // TODO: load generic package XML file from filesystem.
    var packageXml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Package xmlns="http:/soap.sforce.com/2006/04/metadata">',
        '    <types>',
        '        <members>*</members>',
        '        <name>AnalyticSnapshot</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ApexClass</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ApexComponent</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ApexPage</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ApexTrigger</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ApprovalProcess</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>AssignmentRules</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>AuraDefinitionBundle</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>AuthProvider</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>AutoResponseRules</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>BusinessProcess</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CallCenter</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Community</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CompactLayout</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ConnectedApp</name>',
        '    </types>',
        '     <types>',
        '        <members>*</members>',
        '        <name>CustomApplication</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomApplicationComponent</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomField</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomLabels</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomMetadata</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomObject</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomObjectTranslation</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomPageWebLink</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomSite</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>CustomTab</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Dashboard</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>DataCategoryGroup</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Document</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>EmailTemplate</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>EntitlementProcess</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>EntitlementTemplate</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ExternalDataSource</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>FieldSet</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Flow</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Group</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>HomePageComponent</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>HomePageLayout</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Layout</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Letterhead</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ListView</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>LiveChatAgentConfig</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>LiveChatButton</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>LiveChatDeployment</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>MilestoneType</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>NamedFilter</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Network</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>PermissionSet</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Portal</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>PostTemplate</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Profile</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Queue</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>QuickAction</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>RecordType</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>RemoteSiteSetting</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Report</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ReportType</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Role</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>SamlSsoConfig</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Scontrol</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>SharingReason</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Skill</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>StaticResource</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Territory</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>Translations</name>',
        '    </types>',
        '    <types>',
        '        <members>*</members>',
        '        <name>ValidationRule</name>',
        '    </types>',
        '    <version>' + options.apiVersion + '</version>',
        '</Package>'
    ].join('\r\n');

    fs.writeFileSync(targetSrc + 'package.xml', packageXml, 'utf8');

  },

  generatePackageZip: function(options) {

    return new Promise(function(resolve, reject) {

      // Create a path to the temp output dir.  This will house the unpackaged package.xml and source
      var packageSrc = './' + options.outputDirectory + '/' + options.outputTempDirectory + '/';

      if (fs.existsSync(options.outputPackageZip) === true)
        fs.unlinkSync(options.outputPackageZip);

      var archive = archiver('zip');
      var output = fs.createWriteStream(options.outputPackageZip);

      archive.on('error', function(err) {
        reject(err);
      });

      output.on('close', function() {
        resolve();
      });

      archive.pipe(output);
      archive.directory(packageSrc, 'unpackaged');
      archive.finalize();

   });

  },

  registerForGulp: function(gulp, gutil) {

    // TODO: consider moving output Directory to system temp dir & use https://www.npmjs.com/package/temporary

    // Modify the default options with any stored in a package json file.
    gulp.task('force-package-config', function(done) {
      opt = force.parsePackageJsonConfiguration(opt);
        done();
    });

    // -------------------------------------------

    // Clear the meta data output directory & difference cache file.
    gulp.task('force-reset', function(done) {
        force.deletePackageOutput(opt, true);
        done();
    });

    // -------------------------------------------

    // Generate a zip package with all or changed files.
    var packageFiles = function(done, packageAll) {

      // Detect any new file or modified files.
      var metadataAction = force.evaluateProjectFiles(opt, packageAll);

      // Clear the meta data output directory.
      force.deletePackageOutput(opt, false);

      // Check to see if any file changes were detected.
      if (Object.keys(metadataAction).length == 0) {
        // Silently return without an error when forcePackageContinueSilent is true
        if (opt.forcePackageContinueSilent) {
          done();
          return;
        }

        var msg = 'No new or modified files detected.';

        // Throw a gulp error to note no file changes detected.
        if (gutil !== undefined && gutil !== null)
          throw new gutil.PluginError(gulpPluginName, msg, { showProperties: false, showStack: false });

        // Return an error to gulp.
        console.log(msg);
        done(msg);

        return;
      }

      // Generate package folder structure.
      force.generatePackageStructure(opt, metadataAction);

      done();

    };

    gulp.task('force-package', function(done) { packageFiles(done, false); });
    gulp.task('force-package-all', function(done) { packageFiles(done, true); });

   // -------------------------------------------

    // Wanted to keep everything in the force class so delegate the zipping instead of using gulp.
    gulp.task('force-zip', function() {
      return force.generatePackageZip(opt);
    });

    // -------------------------------------------

    // Replace the hashfile with the staging hashfile.
    gulp.task('force-commit', function(done) {
      force.commitChangesToHashfile(opt);
      done();
    });

    // -------------------------------------------

    // Mock resources for test deployments
    gulp.task('force-mock-resources', function(done) {
      force.mockResources(opt);
      done();
    });

    return module.exports;
  }

};

// ---------------------------------------------------------------------------------------------------

function buildMetadata(f, metadataTarget, options, isText) {

  var ext = path.extname(f);
  var name = path.basename(f, ext);

  var data = buildMetadataContent(name, options, ext, isText);

  fs.ensureFileSync(metadataTarget);
  fs.writeFileSync(metadataTarget, data, 'utf8');

}

function buildMetadataContent(name, options, ext, isText) {

  var data = null;
  switch (ext) {
    case '.cls':
      data = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<ApexClass xmlns=\"http:\/\/soap.sforce.com\/2006\/04\/metadata\">\r\n    <apiVersion>' + options.apiVersion + '.0<\/apiVersion>\r\n    <status>Active<\/status>\r\n<\/ApexClass>';
      break;
    case '.app':
    case '.cmp':
    case '.evt':
    case '.intf':
    case '.tokens':
      data = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<AuraDefinitionBundle xmlns=\"http:\/\/soap.sforce.com\/2006\/04\/metadata\">\r\n    <apiVersion>' + options.apiVersion + '.0<\/apiVersion>\r\n    <description>' + name + '<\/description>\r\n<\/AuraDefinitionBundle>';
      break;
    case '.trigger':
      data = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<ApexTrigger xmlns=\"http:\/\/soap.sforce.com\/2006\/04\/metadata\">\r\n    <apiVersion>' + options.apiVersion + '.0<\/apiVersion>\r\n    <status>Active<\/status>\r\n<\/ApexTrigger>';
      break;
    case '.page':
      data = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<ApexPage xmlns=\"http:\/\/soap.sforce.com\/2006\/04\/metadata\">\r\n    <apiVersion>' + options.apiVersion + '.0<\/apiVersion>\r\n    <availableInTouch>false<\/availableInTouch>\r\n    <confirmationTokenRequired>false<\/confirmationTokenRequired>\r\n    <label>' + name + '<\/label>\r\n<\/ApexPage>';
      break;
    case '.component':
      data = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<ApexComponent xmlns=\"http:\/\/soap.sforce.com\/2006\/04\/metadata\">\r\n    <apiVersion>' + options.apiVersion + '.0<\/apiVersion>\r\n    <label>' + name + '<\/label>\r\n<\/ApexComponent>';
      break;
    case '.resource':
      data = (isText)
        ? '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<StaticResource xmlns=\"http:\/\/soap.sforce.com\/2006\/04\/metadata\">\r\n    <cacheControl>Public<\/cacheControl>\r\n    <contentType>text/plain<\/contentType>\r\n<\/StaticResource>'
        : '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<StaticResource xmlns=\"http:\/\/soap.sforce.com\/2006\/04\/metadata\">\r\n    <cacheControl>Public<\/cacheControl>\r\n    <contentType>application/zip<\/contentType>\r\n<\/StaticResource>';
      break;
  }

  return data;

}

function getPackagePath(dir, ext, filePath) {
  switch (ext) {
    // Lightning bundles first
    case '.auradoc':
    case '.css':
    case '.design':
    case '.js':
    case '.svg':
      return { folderName: 'aura/' + dir, isBundleItem: true, hasMetadata: false };
    case '.cmp':
    case '.evt':
    case '.intf':
    case '.tokens':
      return { folderName: 'aura/' + dir, isBundleItem: true, hasMetadata: true };

    // Distinguish between aura .app vs classic .app
    case '.app':
      var fileContents = fs.readFileSync(filePath, 'utf8');
      // Lightning app
      if (-1 !== fileContents.indexOf('<aura:application'))
        return { folderName: 'aura/' + dir, isBundleItem: true, hasMetadata: true };
      // Classic app
      if (-1 !== fileContents.indexOf('<CustomApplication'))
        return { folderName: 'applications', isBundleItem: false, hasMetadata: false };

    case '.approvalProcess':
      return { folderName: 'approvalProcesses', isBundleItem: false, hasMetadata: false };
    case '.assignmentRules':
      return { folderName: 'assignmentRules', isBundleItem: false, hasMetadata: false };
    case '.authproviders':
      return { folderName: 'authprovider', isBundleItem: false, hasMetadata: false };
    case '.autoResponseRules':
      return { folderName: 'autoResponseRules', isBundleItem: false, hasMetadata: false };
    case '.cls':
      return { folderName: 'classes', isBundleItem: false, hasMetadata: true };
    case '.community':
      return { folderName: 'communities', isBundleItem: false, hasMetadata: false };
    case '.component':
      return { folderName: 'components', isBundleItem: false, hasMetadata: true };
    case '.group':
      return { folderName: 'group', isBundleItem: false, hasMetadata: false };
    case '.homePageLayout':
      return { folderName: 'homePageLayouts', isBundleItem: false, hasMetadata: false };
    case '.labels':
      return { folderName: 'labels', isBundleItem: false, hasMetadata: false };
    case '.layout':
      return { folderName: 'layouts', isBundleItem: false, hasMetadata: false };
    case '.letter':
      return { folderName: 'letterhead', isBundleItem: false, hasMetadata: false };
    case '.md':
      return { folderName: 'customMetadata', isBundleItem: false, hasMetadata: false };
    case '.object':
      return { folderName: 'objects', isBundleItem: false, hasMetadata: false };
    case '.objectTranslation':
      return { folderName: 'objectTranslations', isBundleItem: false, hasMetadata: false };
    case '.page':
      return { folderName: 'pages', isBundleItem: false, hasMetadata: true };
    case '.permissionset':
      return { folderName: 'permissionsets', isBundleItem: false, hasMetadata: false };
    case '.profile':
      return { folderName: 'profiles', isBundleItem: false, hasMetadata: false };
    case '.queue':
      return { folderName: 'queues', isBundleItem: false, hasMetadata: false };
    case '.quickAction':
      return { folderName: 'quickActions', isBundleItem: false, hasMetadata: false };
    case '.remoteSite':
      return { folderName: 'remoteSiteSettings', isBundleItem: false, hasMetadata: false };
    case '.reportType':
      return { folderName: 'reportTypes', isBundleItem: false, hasMetadata: false };
    case '.role':
      return { folderName: 'role', isBundleItem: false, hasMetadata: false };
    case '.resource':
      return { folderName: 'staticresources', isBundleItem: false, hasMetadata: true };
    case '.tab':
      return { folderName: 'tabs', isBundleItem: false, hasMetadata: false };
    case '.translation':
      return { folderName: 'translations', isBundleItem: false, hasMetadata: false };
    case '.trigger':
      return { folderName: 'triggers', isBundleItem: false, hasMetadata: true };
  }
}

// ---------------------------------------------------------------------------------------------------


module.exports = force;
