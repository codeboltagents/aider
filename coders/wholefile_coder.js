
const diffs = require('aider');
const Path = require('path');


const Coder = require('./base_coder');
const WholeFilePrompts = require('./wholefile_prompts');


class WholeFileCoder extends Coder {
    constructor(...args) {
        super(...args);
        this.edit_format = "whole";
        this.gpt_prompts = new WholeFilePrompts();
    }

    update_cur_messages(edited) {
        if (edited) {
            this.cur_messages.push({
                role: "assistant", 
                content: this.gpt_prompts.redacted_edit_message
            });
        } else {
            this.cur_messages.push({
                role: "assistant", 
                content: this.partial_response_content
            });
        }
    }

    render_incremental_response(final) {
        try {
            return this.get_edits("diff");
        } catch (error) {
            if (error instanceof ValueError) {
                return this.partial_response_content;
            }
            throw error;
        }
    }

    get_edits(mode = "update") {
        let content = this.partial_response_content;

        let chat_files = this.get_inchat_relative_files();

        let output = [];
        let lines = content.split(/\r?\n/);

        let edits = [];

        let saw_fname = null;
        let fname = null;
        let fname_source = null;
        let new_lines = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.startsWith(this.fence[0]) || line.startsWith(this.fence[1])) {
                if (fname !== null) {
                    // ending an existing block
                    saw_fname = null;

                    let full_path = this.abs_root_path(fname);

                    if (mode === "diff") {
                        output = output.concat(this.do_live_diff(full_path, new_lines, true));
                    } else {
                        edits.push([fname, fname_source, new_lines]);
                    }

                    fname = null;
                    fname_source = null;
                    new_lines = [];
                    continue;
                }

                // fname==None ... starting a new block
                if (i > 0) {
                    fname_source = "block";
                    fname = lines[i - 1].trim();
                    fname = fname.replace(/\*/g, '');  // handle **filename.py**
                    fname = fname.replace(/:$/, '');
                    fname = fname.replace(/`$/, '');

                    // Did gpt prepend a bogus dir? It especially likes to
                    // include the path/to prefix from the one-shot example in
                    // the prompt.
                    if (fname && !chat_files.includes(fname) && chat_files.includes(Path.basename(fname))) {
                        fname = Path.basename(fname);
                    }
                }
                if (!fname) {  // blank line? or ``` was on first line i==0
                    if (saw_fname) {
                        fname = saw_fname;
                        fname_source = "saw";
                    } else if (chat_files.length === 1) {
                        fname = chat_files[0];
                        fname_source = "chat";
                    } else {
                        // TODO: sense which file it is by diff size
                        throw new ValueError(
                            `No filename provided before ${this.fence[0]} in file listing`
                        );
                    }
                }
            } else if (fname !== null) {
                new_lines.push(line);
            } else {
                let words = line.trim().split(/\s+/);
                for (let word of words) {
                    word = word.replace(/[.,:;!]?$/, '');
                    for (let chat_file of chat_files) {
                        let quoted_chat_file = `\`${chat_file}\``;
                        if (word === quoted_chat_file) {
                            saw_fname = chat_file;
                        }
                    }
                }

                output.push(line);
            }
        }

        if (mode === "diff") {
            if (fname !== null) {
                // ending an existing block
                let full_path = Path.resolve(this.root, fname);
                output = output.concat(this.do_live_diff(full_path, new_lines, false));
            }
            return output.join("\n");
        }

        if (fname) {
            edits.push([fname, fname_source, new_lines]);
        }

        let seen = new Set();
        let refined_edits = [];
        // process from most reliable filename, to least reliable
        for (let source of ["block", "saw", "chat"]) {
            for (let [fname, fname_source, new_lines] of edits) {
                if (fname_source !== source) {
                    continue;
                }
                // if a higher priority source already edited the file, skip
                if (seen.has(fname)) {
                    continue;
                }

                seen.add(fname);
                refined_edits.push([fname, fname_source, new_lines]);
            }
        }

        return refined_edits;
    }

    apply_edits(edits) {
        for (let [path, fname_source, new_lines] of edits) {
            let full_path = this.abs_root_path(path);
            let new_lines_str = new_lines.join('');
            this.io.write_text(full_path, new_lines_str);
        }
    }

    do_live_diff(full_path, new_lines, final) {
        let output;
        if (Path.exists(full_path)) {
            let orig_lines = this.io.read_text(full_path).split(/\r?\n/);

            let show_diff = diffs.diff_partial_update(
                orig_lines,
                new_lines,
                final,
            ).split(/\r?\n/);
            output = show_diff;
        } else {
            output = ["```"].concat(new_lines, ["```"]);
        }

        return output;
    }
}

module.exports =WholeFileCoder;

