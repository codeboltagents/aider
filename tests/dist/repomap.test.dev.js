"use strict";

var _require = require("../utils/repomap"),
    RepoMap = _require.RepoMap;

var fs = require("fs");

var chatFnames = [];
var otherFnames = [];
args = ["../coders/editblock_coder.js"];
args.forEach(function (fname) {
  if (fs.lstatSync(fname).isDirectory()) {// chatFnames.push(...findSrcFiles(fname));
  } else {
    chatFnames.push(fname);
  }
});
var rm = new RepoMap();
var repoMap = rm.getRankedTagsMap(chatFnames, otherFnames).then(function (data) {
  console.log(repoMap);
  console.log(repoMap);
});