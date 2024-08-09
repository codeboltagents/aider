const {
    RepoMap
} = require("../utils/repomap");
const fs = require("fs");
const path = require('path')




const file1Path = path.resolve(__dirname, 'data', 'file1.js');
const file2Path = path.resolve(__dirname, 'data', 'file2.js');

const chatFnames = [file1Path, file2Path];
const otherFnames = [];
const mentionedFnames = [file1Path];
const mentionedIdents = [];

repoMap = new RepoMap();
// Call the method
const rankedTags = repoMap.get_ranked_tags(chatFnames, otherFnames, mentionedFnames, mentionedIdents);
console.log(rankedTags)