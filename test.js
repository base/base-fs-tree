'use strict';

require('mocha');
var fs = require('fs');
var path = require('path');
var File = require('vinyl');
var vfs = require('vinyl-fs');
var assert = require('assert');
var through = require('through2');
var tree = require('./');

var cwd = path.resolve.bind(path, __dirname, 'fixtures');
function isMatch(re, file) {
  var str = file.contents.toString();
  return re.test(str);
}

describe('tree()', function() {
  it('should create a file tree', function(cb) {
    var buffer = [];
    var stream = vfs.src('**/*.*', {cwd: cwd(), dot: true})
      .pipe(tree.create())
      .on('data', function(file) {
        buffer.push(file);
      })
      .on('end', function() {
        assert.equal(buffer.length, 1);
        assert.equal(buffer[0].basename, 'tree.txt');
        assert(isMatch(/fixtures/, buffer[0]));
        assert(isMatch(/index\.ejs/, buffer[0]));
        assert(isMatch(/index\.hbs/, buffer[0]));
        cb();
      });
  });

  it('should create a file tree with modified file paths', function(cb) {
    var buffer = [];
    var stream = vfs.src('**/*.*', {cwd: cwd(), dot: true})
      .pipe(through.obj(function(file, enc, next) {
        file.path = path.join(path.dirname(file.path), path.basename(file.path, path.extname(file.path)) + '.foo');
        next(null, file);
      }))
      .pipe(tree.create())
      .on('data', function(file) {
        buffer.push(file);
      })
      .on('end', function() {
        assert.equal(buffer.length, 1);
        assert.equal(buffer[0].basename, 'tree.txt');
        assert(isMatch(/fixtures/, buffer[0]));
        assert(isMatch(/index\.foo/, buffer[0]));
        assert(isMatch(/index\.foo/, buffer[0]));
        cb();
      });
  });

  it('should create a file tree with unmodified file paths', function(cb) {
    var buffer = [];
    var stream = vfs.src('**/*.*', {cwd: cwd(), dot: true})
      .pipe(tree.capture())
      .pipe(through.obj(function(file, enc, next) {
        file.path = path.join(path.dirname(file.path), path.basename(file.path, path.extname(file.path)) + '.foo');
        next(null, file);
      }))
      .pipe(tree.create())
      .on('data', function(file) {
        buffer.push(file);
      })
      .on('end', function() {
        assert.equal(buffer.length, 1);
        assert.equal(buffer[0].basename, 'tree.txt');
        assert(isMatch(/fixtures/, buffer[0]));
        assert(isMatch(/index\.ejs/, buffer[0]));
        assert(isMatch(/index\.hbs/, buffer[0]));
        cb();
      });
  });
});
