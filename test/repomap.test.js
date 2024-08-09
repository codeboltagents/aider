const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const {RepoMap} = require('./../utils/repomap'); // Adjust the path as necessary

describe('RepoMap', function() {
  let repoMap;

  beforeEach(function() {
    repoMap = new RepoMap();
    // Initialize any other setup needed
  });

  it('should rank tags correctly', function() {
    const file1Path = path.resolve(__dirname, 'data', 'file1.js');
    const file2Path = path.resolve(__dirname, 'data', 'file2.js');

    const chatFnames = [file1Path, file2Path];
    const otherFnames = [];
    const mentionedFnames = [file1Path];
    const mentionedIdents = [];


   

    // Call the method
    const rankedTags = repoMap.get_ranked_tags(chatFnames, otherFnames, mentionedFnames, mentionedIdents);
       console.log(rankedTags)
    // Assertions
    expect(rankedTags).to.be.an('array');
    console.log(rankedTags); // Log the result for manual inspection if needed
  });
});
