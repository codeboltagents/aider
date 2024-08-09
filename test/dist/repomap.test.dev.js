"use strict";

var fs = require('fs');

var path = require('path');

var _require = require('chai'),
    expect = _require.expect;

var _require2 = require('./../utils/repomap'),
    RepoMap = _require2.RepoMap; // Adjust the path as necessary


describe('RepoMap', function () {
  var repoMap;
  beforeEach(function () {
    repoMap = new RepoMap(); // Initialize any other setup needed
  });
  it('should rank tags correctly', function () {
    var file1Path = path.resolve(__dirname, 'data', 'file1.js');
    var file2Path = path.resolve(__dirname, 'data', 'file2.js');
    var chatFnames = [file1Path, file2Path];
    var otherFnames = [];
    var mentionedFnames = [file1Path];
    var mentionedIdents = []; // Call the method

    var rankedTags = repoMap.get_ranked_tags(chatFnames, otherFnames, mentionedFnames, mentionedIdents);
    console.log(rankedTags); // Assertions

    expect(rankedTags).to.be.an('array');
    console.log(rankedTags); // Log the result for manual inspection if needed
  });
});