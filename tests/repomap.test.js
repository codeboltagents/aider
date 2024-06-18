const {RepoMap} = require("../utils/repomap");
const fs = require("fs");

const chatFnames = [];
const otherFnames = [];

args = ["../coders/editblock_coder.js"]

args.forEach(fname => {
    if (fs.lstatSync(fname).isDirectory()) {
        // chatFnames.push(...findSrcFiles(fname));
    } else {
        chatFnames.push(fname);
    }
});

const rm = new RepoMap();
const repoMap = rm.getRankedTagsMap(chatFnames, otherFnames);

console.log(repoMap);
console.log(repoMap);
