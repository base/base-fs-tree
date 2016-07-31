'use strict';

var utils = require('lazy-cache')(require);
var fn = require;
require = utils;

/**
 * Lazily required module dependencies
 */

require('archy');
require('clone-deep', 'clone');
require('extend-shallow', 'extend');
require('file-contents', 'contents');
require('is-valid-app', 'isValid');
require('isobject', 'isObject');
require('through2', 'through');
require('trim-leading-lines', 'trim');
require('vinyl', 'File');
require('write');
require = fn;

utils.toFilenames = function(str) {
  return str.split('\n').map(function(line) {
    return utils.sanitize(line);
  });
};

utils.sanitize = function(str) {
  if (str === '.' || str === ' .') return ' .';
  if (!str || /^\s+$/.test(str)) return str;
  var m = /[-.\w_]+/g.exec(str);
  return m ? m[0] : str;
};

/**
 * Expose `utils` modules
 */

module.exports = utils;
