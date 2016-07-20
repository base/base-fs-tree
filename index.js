'use strict';

var path = require('path');
var archy = require('archy');
var isValid = require('is-valid-app');
var write = require('write');
var extend = require('extend-shallow');
var through = require('through2');
var File = require('vinyl');
var cache;

/**
 * Create file trees
 */

module.exports = function(options) {
  options = options || {};
  var obj = {};
  return function(app) {
    if (!isValid(app, 'base-fs-tree')) return;
    var dest = path.resolve.bind(path, __dirname);

    app.postWrite(/./, function(file, next) {
      if (options.tree === false) return;
      addFile(obj, file);
      next();
    });

    app.on('taskEnd', function(name) {
      if (options.tree === false) return;
      var str = create(obj, {label: name});
      var destPath = options.destPath || `trees/${name}.txt`;
      write.sync(dest(destPath), str);
      obj = {};
    });
  };
};

module.exports.capture = function(options) {
  options = options || {};
  cache = {};
  return through.obj(function(file, enc, next) {
    if (options.tree !== false) {
      addFile(cache, file, options);
    }
    if (options.treeOnly === true) {
      next();
    } else {
      next(null, file);
    }
  });
};

module.exports.create = function(options) {
  options = options || {};
  cache = cache || {};
  return through.obj(function(file, enc, next) {
    if (options.tree !== false) {
      addFile(cache, file, options);
    }
    next();
  }, function(next) {
    if (options.tree !== false) {
      var str = create(cache, {label: 'cwd'});
      var file = new File({path: 'tree.txt', contents: new Buffer(str)});
      this.push(file);
      cache = {};
    }
    next();
  });
};

function addFile(tree, file, options) {
  if (file._added) return;
  file._added = true;
  options = options || {};
  if (typeof options.filter === 'function' && !options.filter(file)) {
    return;
  }
  if (/(\.DS_Store|Thumbs\.db)/.test(file.path)) {
    return;
  }
  var opts = extend({label: 'cwd', prefix: ''}, options);
  var cwd = typeof opts.cwd === 'string' ? opts.cwd : process.cwd();
  addBranch(tree, path.join(opts.label, path.relative(cwd, file.path)));
}

function create(tree, options) {
  var opts = extend({label: 'cwd', prefix: ''}, options);
  var obj = tree[opts.label] || tree.cwd;
  var archytree = createTree(obj, {}, opts.label);
  var str = archy(archytree, opts.prefix, opts);
  return str.replace(/^[^\n]+/, '.');
}

function addBranch(tree, path) {
  var segs = path.split(/[\\\/]/);
  var len = segs.length;
  var end = len - 1;
  var idx = -1;
  while (++idx < len) {
    tree[segs[idx]] = tree[segs[idx]] || (idx === end ? null : {});
    tree = tree[segs[idx]];
  }
}

function createTree(tree, obj, label) {
  obj.label = label;
  for (var key in tree) {
    obj.nodes = obj.nodes || [];
    obj.nodes.push(tree[key] ? createTree(tree[key], {}, key) : key);
  }
  return obj;
}
