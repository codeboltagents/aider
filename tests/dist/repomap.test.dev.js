"use strict";

var _require = require("../utils/repomap"),
    RepoMap = _require.RepoMap;

var fs = require("fs");

var chatFnames = [];
var otherFnames = [];
args = ["/Users/ravirawat/Documents/Files/aider/coders/editblock_coder.js"];

var getAllFilesRecursively = function getAllFilesRecursively(dir) {
  var files = fs.readdirSync(dir);
  files.forEach(function (file) {
    var filePath = path.join(dir, file);

    if (fs.statSync(filePath).isDirectory()) {
      getAllFilesRecursively(filePath);
    } else {
      chatFnames.push(filePath);
    }
  });
};

args.forEach(function (fname) {
  if (fs.statSync(fname).isDirectory()) {
    getAllFilesRecursively(fname);
  } else {
    chatFnames.push(fname);
  }
});
var rm = new RepoMap();
rm.get_ranked_tags_map(chatFnames, otherFnames).then(function (data) {
  console.log(data);
});