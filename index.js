'use strict';

var path = require('path');
var utils = require('./utils');
var cache;

/**
 * Create file trees
 */

module.exports = function(config) {
  config = config || {};
  cache = cache || {};
  var namespace = config.name || 'default';
  cache[namespace] = cache[namespace] || {src: {}, dest: {}};

  function plugin(app) {
    if (!utils.isValid(app, 'base-fs-tree')) return;

    /**
     * Create a `tree` view collection if one doesn't already exist
     */

    if (typeof app.tree !== 'function') {
      app.create('tree', {viewType: 'partial'});
    }
    if (typeof app.srcTree !== 'function') {
      app.create('srcTree', {viewType: 'partial'});
    }

    var method = app.prePlugins ? 'prePlugins' : 'onStream';
    app[method](/./, function(file, next) {
      var opts = utils.extend({}, config, app.options);
      if (opts.tree !== false && !file.isTree) {
        addFile(cache[namespace], file, {}, 'src');
      }
      next();
    });

    app.preWrite(/./, function(file, next) {
      var opts = utils.extend({}, config, app.options);
      file.writeFile = !opts.treeOnly && file.isTree;
      next();
    });

    app.postWrite(/./, function(file, next) {
      var opts = utils.extend({}, config, app.options);
      if (opts.tree !== false && !file.isTree) {
        addFile(cache[namespace], file, {}, 'dest');
      }
      next();
    });

    app.define('createTrees', function(options) {
      var opts = utils.extend({name: 'default'}, config, app.options, options);
      if (opts.tree !== false) {
        writeFile(app, cache, 'dest', namespace, opts);
        writeFile(app, cache, 'src', namespace, opts);
      }
      // always reset the cache
      cache[namespace] = {src: {}, dest: {}};
    });

    app.define('compareTrees', function(fn) {
      return compare(this, app.trees.views, fn);
    });

    app.define('createSrcTrees', function(fn) {
      return createSrcTrees(this, app.srcTrees.views, fn);
    });

    return plugin;
  };

  plugin.capture = function(name, options) {
    if (utils.isObject(name)) {
      options = name;
      name = null;
    }
    var opts = utils.extend({name: name || 'default'}, config, options);
    var prop = opts.name;

    cache = cache || {};
    cache[prop] = {src: {}, dest: {}};

    return utils.through.obj(function(file, enc, next) {
      if (opts.tree !== false) {
        file._isCaptured = true;
        addFile(cache[prop], file, opts, 'src');
      }
      file.writeFile = opts.treeOnly === false;
      next(null, file);
    });
  };

  plugin.create = function(name, options) {
    if (utils.isObject(name)) {
      options = name;
      name = null;
    }

    var opts = utils.extend({name: name || 'default'}, config, options);
    var prop = opts.name;

    cache = cache || {};
    cache[prop] || (cache[prop] = {src: {}, dest: {}});

    return utils.through.obj(function(file, enc, next) {
      if (opts.tree !== false) {
        if (!file._isCaptured) {
          addFile(cache[prop], file, opts, 'src');
        }
        addFile(cache[prop], file, opts, 'dest');
      }
      file.writeFile = opts.treeOnly === false;
      next();
    }, function(next) {
      if (opts.tree !== false) {
        this.push(createFile(cache[prop], 'dest', prop, opts));
        this.push(createFile(cache[prop], 'src', prop, opts));
        cache[prop] = cache[prop] = {src: {}, dest: {}};
      }
      next();
    });
  };

  /**
   * Create a file
   */

  function createFile(tree, name, prop, options) {
    var opts = utils.extend({}, options);
    var str = create(tree[name], {label: 'cwd'});
    var file = new utils.File({path: `${prop}-${name}.txt`, contents: new Buffer(str)});

    if (typeof opts.treename === 'function') {
      opts.treename(file);
    }
    file.writeFile = true;
    file.render = false;
    file.layout = null;
    file.isTree = true;
    utils.contents.sync(file);
    return file;
  }

  function writeFile(app, tree, prop, namespace, options) {
    var opts = utils.extend({label: 'cwd'}, config, options);
    var obj = tree[namespace][prop];
    var str = create(obj, {label: namespace});

    var destPath = opts.destPath || `${opts.name}-${prop}.txt`;
    if (typeof opts.dest === 'string') {
      destPath = path.resolve(opts.dest, destPath);
    }

    var file = new utils.File({path: destPath, contents: new Buffer(str)});
    utils.contents.sync(file);

    if (typeof opts.treename === 'function') {
      opts.treename(file);
    }

    var destBase = file.dirname;
    if (typeof opts.dest === 'function') {
      destBase = path.resolve(opts.dest(file) || destBase);
    }

    destPath = path.resolve(destBase, file.path);

    if (prop === 'dest') {
      var keys = Object.keys(utils.clone(obj[opts.label]));
      app.tree(opts.name, {contents: new Buffer(str), tree: keys});
    } else {
      app.srcTree(opts.name, {contents: new Buffer(str)});
    }

    if (opts.write !== false) {
      utils.write.sync(destPath, file.contents.toString());
    }
  }

  function addFile(tree, file, options, name) {
    if (isCached(file, name)) return;
    var opts = utils.extend({label: 'cwd', prefix: ' '}, options);
    var cwd = typeof opts.cwd === 'string' ? opts.cwd : process.cwd();
    var relative = path.relative(cwd, file.path);
    if (name === 'dest') {
      relative = file.relative;
    }
    var filepath = path.join(opts.label, relative);
    addBranch(tree[name], filepath);
  }

  return plugin;
};

function isCached(file, name) {
  if (!name && file._added) {
    return true;
  }
  if (name) {
    file._added = file._added || {};
    if (file._added[name]) {
      return true;
    }
    file._added[name] = true;
    return false;
  }
  file._added = true;
  return false;
}

function create(tree, options) {
  var opts = utils.extend({label: 'cwd', prefix: ' '}, options);
  var obj = tree[opts.label] || tree.cwd;
  var archytree = createTree(obj, {}, opts.label);
  var str = utils.archy(archytree, opts.prefix, opts);
  return str.replace(/^[^\n]+/, ' .');
}

function addBranch(tree, path) {
  var segs = path.split(/[\\\/]+/);
  var len = segs.length;
  var idx = -1;

  while (++idx < len) {
    if (!tree[segs[idx]]) {
      tree[segs[idx]] = {};
    } else if (idx === len - 1) {
      tree[segs[idx]] = null;
    }
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

function compare(app, views, fn) {
  if (typeof views.default === 'undefined') {
    throw new Error('expected a "default" task to be defined');
  }

  var lines = utils.toFilenames(views.default.content);
  var str = '';

  for (var key in views) {
    if (views.hasOwnProperty(key)) {
      var view = views[key];

      view.treeDiff = diff(views.default, lines, view.content);
      if (typeof fn === 'function') {
        fn(view);
      }

      str += '\n### ' + view.stem;
      str += '\n';
      str += '\n';
      str += `Files generated by the [${view.stem} task](#${view.stem}):`;
      str += '\n';
      str += '\n```diff\n';
      str += view.treeDiff;
      str += '```\n';
    }
  }
  return str;
}

function createSrcTrees(app, views, fn) {
  var str = '';
  for (var key in views) {
    if (views.hasOwnProperty(key)) {
      var view = views[key];

      if (typeof fn === 'function') {
        fn(view);
      }

      str += '\n### ' + view.stem;
      str += '\n';
      str += '\n';
      str += `Source files used by the [${view.stem} task](#${view.stem}):`;
      str += '\n';
      str += '\n```diff\n';
      str += view.content;
      str += '```\n';
    }
  }
  return str;
}

function diff(defaultView, lines, content) {
  var orig = content.split('\n');
  var arr = utils.toFilenames(content);
  var temp = arr.slice();
  var len = arr.length;
  var idx = -1;

  while (++idx < len) {
    var filename = arr[idx];
    if (!filename.trim()) continue;
    if (lines.indexOf(filename) === -1) {
      arr[idx] = orig[idx].replace(/^ /, '+');
    } else {
      arr[idx] = orig[idx];
    }
  }

  var origDefault = defaultView.content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (temp.indexOf(line) === -1) {
      arr.splice(i, 0, origDefault[i].replace(/^ /, '-'));
    }
  }

  return utils.trim(arr.join('\n'));
}

/**
 * Expose `compare`
 */

module.exports.compare = compare;

