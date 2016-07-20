'use strict';

var tree = require('./');
var merge = require('mixin-deep');
var questions = require('base-questions');
var assemble = require('assemble');
var app = assemble();
app.use(questions());
app.use(tree());

app.question('title', 'Page title?');
app.option('engine', 'hbs');
app.data({site: {title: 'My Blog', description: 'Um, my blog'}});

app.helper('default', function(a, b) {
  return a || b;
});

app.task('default', function(cb) {
  app.layouts('fixtures/templates/hbs/layouts/*.hbs');
  return app.src('fixtures/templates/**/*.*', {dot: true})
    .pipe(app.dest(function(file) {
      file.extname = '.html';
      return 'dist';
    }))
});

app.task('tree', function(cb) {
  return app.src('fixtures/**/*')
    .pipe(tree.create())
    .pipe(app.dest('foo'))
});

module.exports = app;
