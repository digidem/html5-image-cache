var contentTypes = require('./image-content-types')
var extname = require('path').extname

module.exports = function lookup (path) {
  if (!path || typeof path !== 'string') {
    return false
  }

  // get the extension ("ext" or ".ext" or full path)
  var extension = extname('x.' + path)
    .toLowerCase()
    .substr(1)

  return contentTypes[extension] || false
}
