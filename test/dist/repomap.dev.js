"use strict";

var _require = require("../utils/repomap"),
    RepoMap = _require.RepoMap;

var fs = require("fs");

var path = require('path');

var file1Path = path.resolve(__dirname, 'data', 'file1.js');
var file2Path = path.resolve(__dirname, 'data', 'file2.js');
var chatFnames = [file1Path, file2Path];
var otherFnames = [];
var mentionedFnames = [file1Path];
var mentionedIdents = [];
repoMap = new RepoMap(); // Call the method

var rankedTags = repoMap.get_ranked_tags(chatFnames, otherFnames, mentionedFnames, mentionedIdents);
console.log(rankedTags);