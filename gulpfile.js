'use strict';

var through = require('through2');
var path = require('path');
var gulp = require('gulp');
var tree = require('./');
var argv = require('yargs-parser')(process.argv.slice(2), {
  default: {tree: false}
});

gulp.task('default', function(cb) {
  return gulp.src('fixtures/**/*.*')
    .pipe(tree.capture(argv))
    .pipe(through.obj(function(file, enc, next) {
      file.path = path.join(path.dirname(file.path), path.basename(file.path, path.extname(file.path)) + '.foo');
      next(null, file);
    }))
    .pipe(tree.create(argv))
    .pipe(gulp.dest('trees'))
});
