'use strict';

var path = require('path');
var tree = require('./')({name: 'assemblefile', tree: true});
var del = require('delete');
var handle = require('assemble-handle');
var gitignore = require('gulp-gitignore');
var assemble = require('assemble');
var through = require('through2');
var app = assemble();

app.handler('prePlugins');
app.use(tree);

app.task('delete', function(cb) {
  del('trees', cb);
});

app.task('other', function(cb) {
  return app.src('other/**/*.*', {dot: true})
    .pipe(gitignore())
    .pipe(handle.once(app, 'prePlugins'))
    .pipe(app.dest(function(file) {
      file.writeFile = false;
      file.extname = '.html';
      return 'fixtures/other';
    }))
    .on('end', createTree(app, this, cb));
    // .on('end', function() {
    //   app.createTrees({name: 'other', dest: 'trees'});
    //   cb();
    // });
});

app.task('default', ['delete', 'other'], function(cb) {
  app.layouts('fixtures/templates/hbs/layouts/*.hbs');
  app.src('fixtures/templates/**/*.*', {dot: true})
    .pipe(gitignore())
    .pipe(handle.once(app, 'prePlugins'))
    .pipe(app.dest(function(file) {
      file.writeFile = false;
      file.extname = '.html';
      return 'dist';
    }))
    .on('end', createTree(app, this, cb));
});

app.task('tree', function(cb) {
  return app.src('fixtures/**/*.*', {dot: true})
    .pipe(gitignore())
    .pipe(handle.once(app, 'prePlugins'))
    .pipe(through.obj(function(file, enc, next) {
      file.extname = '.foo';
      next(null, file);
    }))
    .pipe(tree.create())
    .pipe(app.dest('trees'));
});

function createTree(app, task, cb) {
  var dest = app.option.tree || path.join(app.cwd, 'trees');
  return function() {
    app.createTrees({name: task.name, dest: dest});
    cb();
  };
}

module.exports = app;
