const { fencesUtil, fencedata } = require("./fences");

const codesplits = {
    HEAD: "<<<<<<< SEARCH",
    DIVIDER: "=======",
    UPDATED: ">>>>>>> REPLACE",
}
const parseLLMResp = {    
    split_re: function (){
        separators= [codesplits.HEAD, codesplits.DIVIDER, codesplits.UPDATED].join("|");
        return new RegExp("^((?:" + separators + ")[ ]*\n)", "gm");
    },

    //this takes the output from the AI and finds the Edits (pathname, original, updated)
    find_original_update_blocks: function(content, fence = fencedata.getDefaultFence()) {
        // make sure we end with a newline, otherwise the regex will miss <<UPD on the last line
        if (!content.endsWith("\n")) {
            content = content + "\n";
        }

        console.log(this.split_re())
        let pieces = content.split(this.split_re());

        pieces.reverse();
        let processed = [];
        let edits = [];

        // Keep using the same filename in cases where GPT produces an edit block
        // without a filename.
        let current_filename = null;
        try {
            while (pieces.length>0) {
                let cur = pieces.pop();

                if ([this.DIVIDER, this.UPDATED].includes(cur)) {
                    processed.push(cur);
                    throw new Error(`Unexpected ${cur}`);
                }

                if (cur.trim() !== this.HEAD) {
                    processed.push(cur);
                    continue;
                }

                processed.push(cur);  // original_marker

                let filename = this.strip_filename(processed[processed.length - 2].split("\n").slice(-1)[0], fence);
                try {
                    if (!filename) {
                        filename = this.strip_filename(processed[processed.length - 2].split("\n").slice(-2)[0], fence);
                    }
                    if (!filename) {
                        if (current_filename) {
                            filename = current_filename;
                        } else {
                            throw new Error(`Missing filename error: ${fence}`);
                        }
                    }
                } catch (error) {
                    if (current_filename) {
                        filename = current_filename;
                    } else {
                        throw new Error(`Missing filename error: ${fence}`);
                    }
                }

                current_filename = filename;

                let original_text = pieces.pop();
                processed.push(original_text);

                let divider_marker = pieces.pop();
                processed.push(divider_marker);
                if (divider_marker.trim() !== this.DIVIDER) {
                    throw new Error(`Expected ${this.DIVIDER} not ${divider_marker.trim()}`);
                }

                let updated_text = pieces.pop();
                processed.push(updated_text);

                let updated_marker = pieces.pop();
                processed.push(updated_marker);
                if (updated_marker.trim() !== this.UPDATED) {
                    throw new Error(`Expected ${this.UPDATED} not ${updated_marker.trim()}`);
                }

                edits.push({ filename, original_text, updated_text });
            }
        } catch (error) {
            processed = processed.join("");
            let err = error.message;
            throw new Error(`${processed}\n^^^ ${err}`);
        }
        return edits;
    },

     strip_filename: function (filename, fence) {
        filename = filename.trim();

        if (filename === "...") {
            return;
        }

        const start_fence = fence[0];
        if (filename.startsWith(start_fence)) {
            return;
        }

        filename = filename.replace(/:$/, "");
        filename = filename.replace(/^#/, "");
        filename = filename.trim();
        filename = filename.replace(/^`|`$/g, "");
        filename = filename.replace(/^\*|\*$/g, "");
        filename = filename.replace(/\\_/g, "_");

        return filename;
    }
}


module.exports = parseLLMResp;