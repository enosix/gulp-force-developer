# gulp-force-developer

> A gulp library for salesforce and force.com development.  Designed to help force.com developers to work using the benefits of gulp and a folder structure when developing. 

See: (https://github.com/jkentjnr/sfdc-gulp-travisci-boilerplate) for a boilplate solution.

```shell
npm install gulp-force-developer --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gulpfile with this line of JavaScript:

```js
var gulp = require('gulp'),
    gutil = require('gulp-util');
    forceDeveloper = require('./gulp-force-developer').registerForGulp(gulp, gutil);
```

### Overview

Using gulp and the `gulp-force-developer` tasks, developers for salesforce & force.com can:

* Manage their projects / packages in any folder structure they like.
* Integrate the full suite of gulp tasks into their deployment process.
* Ensure only new & modified code is published as part of each deployment / build.  This enables a developer to code using any IDE, pushing changes via gulp. 

To use `gulp-force-developer` as quickly as possible, we recommend starting with the `gulpfile.js` in examples.

### Folder Structures

#### Traditional Folder Structure
Traditionally, when a developer is developing for salesforce / force.com, they are constrained by the mandated package structure.  This structure is extremely limiting and, as the size of projects / packages grow, raplidly becomes unwieldy.

```
package.xml
== classes
    -- PaymentController.cls
    -- PaymentController.cls-meta.xml
    -- UserManagement.cls
    -- UserManagement.cls-meta.xml
== pages
    -- Payment.page
    -- Payment.page-meta.xml
    -- UserManagement.page
    -- UserManagement.page-meta.xml
== objects
    -- Payment__c.object
```

#### gulp-force-developer Folder Structure
Using `gulp-force-developer`, a developer can adopt a fully dynamic file structure that operates independent of the prescribed salesforce package structure.  The below example is a snippet from a developer managing their package in structure with little constraints, appropriate for their project.

```
== .metadata
    -- Payment.page-meta.xml
    -- PaymentController.cls-meta.xml
    -- UserManagement.page-meta.xml
    -- UserManagementController.cls-meta.xml
== Admin
   == Users
      -- UserManagementController.cls
      -- UserManagement.page
== Payments
    -- PaymentController.cls
    -- Payment.page
    -- Payment__c.object
```

### Gulp Tasks

To register the gulp tasks, you must use:

```js
require('gulp-force-developer').registerForGulp(gulp, gutil);
```

#### force-package-config
Loads the options from the package.json

#### force-reset
Deletes the file used to track changes between `force-commit` calls

#### force-package
Packages files that have changed since the previous `force-commit` call

#### force-package-all
Packages all files

#### force-zip
Generates the output from the `force-package` and `force-package-all` calls as a zip, ready for deployment

#### force-commit
Updates the track changes file to refect the current state

#### force-mock-resources
Mocks resources from the package.json file.  This is required when completing checkOnly tests that have Visualforce pages bound to resources. 

### Usage

To change your configuration, you may alter your project's package.json file.

```js
{
  "name": "salesforce project",
  "version": "1.0.0",
  "description": "",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "MIT",
  "forceDeveloperConfig": {
    "projectBaseDirectory": "src"
  }
}
```

Or you may modify the options from within your gulpfile.

```js
var gulp = require('gulp'),
    gutil = require('gulp-util'),
    forceDeveloper = require('gulp-force-developer').registerForGulp(gulp, gutil);

forceDeveloper.options.projectBaseDirectory = 'src';
```

In your project's gulpfile, register the tasks with gulp and extend as appropriate.  

```js
var salesforcePackageFile = './.package/package.zip',
    username = 'testuser@force.com',
    password ='password',
    token = 'Qr1ScFquCn1uT0YO6ywUj5je';

// ----------------------------------------------------------------

var gulp = require('gulp'),
    gutil = require('gulp-util'),
    forceDeploy = require('gulp-jsforce-deploy');
    forceDeveloper = require('gulp-force-developer').registerForGulp(gulp, gutil);

// ----------------------------------------------------------------
// REGISTER GULP TASKS

gulp.task('deploy', function(done) {
  
  return gulp.src(salesforcePackageFile)
      .pipe(forceDeploy({
        username: username,
        password: password + token,
        pollInterval: 5*1000 
        //, loginUrl: 'https://test.salesforce.com' 
        //, pollTimeout: 120*1000 
        //, version: '33.0' 
      }));
      
});

gulp.task('default', gulp.series(
  'force-package-config',
  'force-package',
  'force-zip',
  'deploy',
  'force-commit'
));
```

### Options

#### options.fileChangeHashFile
Type: `String`
Default value: `'.force-developer.filehash.json'`

Persists the file hashes to determine modified and new files.

#### options.forcePackageContinueSilent
Type: `Boolean`
Default value: `false`

By default `force-package` ends the gulp sequence with an error when no new or modified code is available for deployment. When `forcePackageContinueSilent` is `true` it causes `force-package` to continue with the subsequent gulp tasks. This behavior modification can be useful in complex deployment scenarios where multiple projects are merged together into one deployment.

#### options.metadataSourceDirectory
Type: `String`
Default value: `'app-metadata'`

The folder used to store all `'-meta.xml'` files for the project.  A corresponding file is required for all pages, components, trigger and classes.  If the `projectBaseDirectory` isn't altered, the default location is `./project/app-metadata`.

#### options.projectBaseDirectory
Type: `String`
Default value: `'project'`

Used to determine the root of the project folder.

#### options.outputDirectory
Type: `String`
Default value: `'.package'`

The folder used when the files are copied from the project folder into a salesforce package-compliant folder structure.

#### options.outputPackageZip
Type: `String`
Default value: `'./.package/package.zip'`

The location where the zipped package is to be stored.

#### options.apiVersion
Type: `Integer`
Default value: `34`

The api version to be used by the library.  Used when creating on-demand meta-xml files.

#### options.mockResources
Type: `Array (String)`
Default value: `[]`

A list of resource names required to be mocked so a test deployment can be completed successfully.

## Contributing
All contributions welcome!

## Release History
* 0.1.16
  * Added Lightning / Aura definition bundle support
* 0.1.15
  * Added support for modifying options from gulpfile
* 0.1.10
  * Added resource mocking support
* 0.1.3
  * Documentation updates.
* 0.1.0
  * Inital release.