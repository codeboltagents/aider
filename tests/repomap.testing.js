const {RepoMap} = require("../utils/repomap");
const fs = require("fs");

const chatFnames = [];
const otherFnames = [];

args = ["/Users/ravirawat/Documents/Files/aider/coders/editblock_coder.js"]

const getAllFilesRecursively = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllFilesRecursively(filePath);
        } else {
            chatFnames.push(filePath);
        }
    });
};

args.forEach(fname => {
    if (fs.statSync(fname).isDirectory()) {
        getAllFilesRecursively(fname);
    } else {
        chatFnames.push(fname);
    }
});

const rm = new RepoMap();
 rm.get_ranked_tags_map(chatFnames, otherFnames).then(data=>{
    console.log(data);
  
})


