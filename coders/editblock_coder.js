const codebolt = require('@codebolt/codeboltjs').default;

const Coder = require('./base_coder');
const EditBlockPrompts = require('./editblock_prompts');
// const codebolt = require('@codebolt/codeboltjs').default

const codeEdit = require('./../utils/codeEdit');
const {
    replace_most_similar_chunk,
    strip_quoted_wrapping,
    find_original_update_blocks
} = codeEdit

class EditBlockCoder extends Coder {
    partial_response_content;
    constructor(args) {
        super(args);
        this.gpt_prompts = new EditBlockPrompts();
    }
    edit_format = "diff";


   async get_edits() {
        try {
            let content = this.partial_response_content;
            // might raise Error for malformed ORIG/UPD blocks
            let edits = Array.from(find_original_update_blocks(content, this.fence));

            return edits;
        } catch (error) {
            console.log(error);
        }


    }
    async apply_edits(edits) {
        let failed = [];
        let passed = [];
        for (let edit of edits) {
            let [path, original, updated] = edit;
            let full_path = path //this.abs_root_path(path);
            let {
                content
            } = await codebolt.fs.readFile(path);
            let new_content = await codeEdit.do_replace(full_path, content, original, updated, this.fence);
            if (!new_content) {
                // try patching any of the other files in the chat
                for (full_path of this.abs_fnames) {
                    let {
                        content
                    } = await codebolt.fs.readFile(path);
                    new_content = await codeEdit.do_replace(full_path, content, original, updated, this.fence);
                    if (new_content) {
                        break;
                    }
                }
            }

            if (new_content) {
                //create or update
                await codebolt.fs.createFile(full_path, new_content, null);

                passed.push(edit);
            } else {
                failed.push(edit);
            }
        }

        if (!failed.length) {
            return;
        }

        let blocks = failed.length === 1 ? "block" : "blocks";

        let res = `# ${failed.length} SEARCH/REPLACE ${blocks} failed to match!\n`;
        for (let edit of failed) {
            let [path, original, updated] = edit;

            let full_path = path;
            let {
                content
            } = await codebolt.fs.readFile(full_path);

            res += `
    ## SearchReplaceNoExactMatch: This SEARCH block failed to exactly match lines in ${path}
    <<<<<<< SEARCH
    ${original}=======
    ${updated}>>>>>>> REPLACE
    
    `;
            let did_you_mean = find_similar_lines(original, content);
            if (did_you_mean) {
                res += `Did you mean to match some of these actual lines from ${path}?
    
    ${this.fence[0]}
    ${did_you_mean}
    ${this.fence[1]}
    
    `;
            }

            if (content.includes(updated)) {
                res += `Are you sure you need this SEARCH/REPLACE block?
    The REPLACE lines are already in ${path}!
    
    `;
            }
        }
        res += "The SEARCH section must exactly match an existing block of lines including all white" +
            " space, comments, indentation, docstrings, etc\n"
        if (passed.length) {
            let pblocks = passed.length === 1 ? "block" : "blocks";
            res += `
    # The other ${passed.length} SEARCH/REPLACE ${pblocks} were applied successfully.
    Don't re-send them.
    Just reply with fixed versions of the ${blocks} above that failed to match.
    `;
        }
        throw new Error(res);
    }

    //     apply_edits(edits) {
    //         let failed = []
    //         let passed = []
    //         edits.forEach(async edit => {
    //             let [path, original, updated] = edit;
    //             ///index.js
    //             // let full_path = this.abs_root_path(path);

    //             // let content = this.io.read_text(full_path);
    //             let {
    //                 content
    //             } = await codebolt.fs.readFile(path);

    //             let full_path;
    //             let new_content = codeEdit.do_replace(path, content, original, updated, this.fence);
    //             if (!new_content) {
    //                 // try patching any of the other files in the chat
    //                 for (full_path of this.abs_fnames) {
    //                     let {
    //                         content
    //                     } = await codebolt.fs.readFile(path)
    //                     new_content = codeEdit.do_replace(path, content, original, updated, this.fence);
    //                     if (new_content) {
    //                         break;
    //                     }
    //                 }
    //             }

    //             if (new_content) {
    //                 codebolt.fs.updateFile(full_path, new_content)
    //                 // this.io.write_text(full_path, new_content);
    //                 passed.push(edit);
    //             } else {
    //                 failed.push(edit);
    //             }
    //         });

    //         if (!failed.length) {
    //             return;
    //         }

    //         let blocks = failed.length === 1 ? "block" : "blocks";

    //         let res = `# ${failed.length} SEARCH/REPLACE ${blocks} failed to match!\n`;
    //         for (let edit of failed) {
    //             let [path, original, updated] = edit;

    //             let full_path = this.abs_root_path(path);
    //             let content = this.io.read_text(full_path);

    //             res += `
    // ## SearchReplaceNoExactMatch: This SEARCH block failed to exactly match lines in ${path}
    // <<<<<<< SEARCH
    // ${original}=======
    // ${updated}>>>>>>> REPLACE

    // `;
    //             let did_you_mean = find_similar_lines(original, content);
    //             if (did_you_mean) {
    //                 res += `Did you mean to match some of these actual lines from ${path}?

    // ${this.fence[0]}
    // ${did_you_mean}
    // ${this.fence[1]}

    // `;
    //             }

    //             if (content.includes(updated)) {
    //                 res += `Are you sure you need this SEARCH/REPLACE block?
    // The REPLACE lines are already in ${path}!

    // `;
    //             }
    //         }
    //         res += "The SEARCH section must exactly match an existing block of lines including all white" +
    //             " space, comments, indentation, docstrings, etc\n"
    //         if (passed.length) {
    //             let pblocks = passed.length === 1 ? "block" : "blocks";
    //             res += `
    // # The other ${passed.length} SEARCH/REPLACE ${pblocks} were applied successfully.
    // Don't re-send them.
    // Just reply with fixed versions of the ${blocks} above that failed to match.
    // `;
    //         }
    //         throw new Error(res);
    //     }
}

module.exports = EditBlockCoder