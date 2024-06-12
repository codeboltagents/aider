import { Coder } from "./base_coder";
import { editBlockPrompts } from "./editblock_prompts";

class EditBlockCoder extends Coder {
    constructor() {
        super();
    }
    edit_format = "diff";
    gpt_prompts = editBlockPrompts;

    get_edits(){
        //TODO: 
    }

    apply_edits(edits){
        failed = []
        passed = []
        edits.forEach(edit => {
            let [path, original, updated] = edit;
            let full_path = this.abs_root_path(path);
            let content = this.io.read_text(full_path);
            let new_content = do_replace(full_path, content, original, updated, this.fence);
            if (!new_content) {
                // try patching any of the other files in the chat
                for (let full_path of this.abs_fnames) {
                    content = this.io.read_text(full_path);
                    new_content = do_replace(full_path, content, original, updated, this.fence);
                    if (new_content) {
                        break;
                    }
                }
            }

            if (new_content) {
                this.io.write_text(full_path, new_content);
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

            let full_path = this.abs_root_path(path);
            let content = this.io.read_text(full_path);

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
        res += (
            "The SEARCH section must exactly match an existing block of lines including all white"
            " space, comments, indentation, docstrings, etc\n"
        );
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
}