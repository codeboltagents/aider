const difflib = require('difflib');
const groupby = require('itertools').groupby;
const Path = require('path');

const dump = require('../dump');  // noqa: F401
const Coder = require('./base_coder');
const SearchTextNotUnique = require('./search_replace').SearchTextNotUnique;
const all_preprocs = require('./search_replace').all_preprocs;
const diff_lines = require('./search_replace').diff_lines;
const flexible_search_and_replace = require('./search_replace').flexible_search_and_replace;
const search_and_replace = require('./search_replace').search_and_replace;
const UnifiedDiffPrompts = require('./udiff_prompts').UnifiedDiffPrompts;

const no_match_error = `UnifiedDiffNoMatch: hunk failed to apply!

{path} does not contain lines that match the diff you provided!
Try again.
DO NOT skip blank lines, comments, docstrings, etc!
The diff needs to apply cleanly to the lines in {path}!

{path} does not contain these {num_lines} exact lines in a row:
\`\`\`
{original}\`\`\`
`;

const not_unique_error = `UnifiedDiffNotUnique: hunk failed to apply!

{path} contains multiple sets of lines that match the diff you provided!
Try again.
Use additional \` \` lines to provide context that uniquely indicates which code needs to be changed.
The diff needs to apply to a unique set of lines in {path}!

{path} contains multiple copies of these {num_lines} lines:
\`\`\`
{original}\`\`\`
`;

const other_hunks_applied = "Note: some hunks did apply successfully. See the updated source code shown above.\n\n";

class UnifiedDiffCoder extends Coder {
    constructor(...args) {
        super(...args);
        this.edit_format = "udiff";
        this.gpt_prompts = new UnifiedDiffPrompts();
    }

    get_edits() {
        let content = this.partial_response_content;

        // might raise ValueError for malformed ORIG/UPD blocks
        let raw_edits = Array.from(find_diffs(content));

        let last_path = null;
        let edits = [];
        for (let [path, hunk] of raw_edits) {
            if (path) {
                last_path = path;
            } else {
                path = last_path;
            }
            edits.push([path, hunk]);
        }

        return edits;
    }

    apply_edits(edits) {
        let seen = new Set();
        let uniq = [];
        for (let [path, hunk] of edits) {
            hunk = normalize_hunk(hunk);
            if (!hunk) {
                continue;
            }

            let this_ = [path + "\n"].concat(hunk);
            this_ = this_.join("");

            if (seen.has(this_)) {
                continue;
            }
            seen.add(this_);

            uniq.push([path, hunk]);
        }

        let errors = [];
        for (let [path, hunk] of uniq) {
            let full_path = this.abs_root_path(path);
            let content = this.io.read_text(full_path);

            let [original, _] = hunk_to_before_after(hunk);

            try {
                content = do_replace(full_path, content, hunk);
            } catch (e) {
                if (e instanceof SearchTextNotUnique) {
                    errors.push(
                        not_unique_error.format(
                            {path: path, original: original, num_lines: original.split('\n').length}
                        )
                    );
                    continue;
                }
                throw e;
            }

            if (!content) {
                errors.push(
                    no_match_error.format(
                        {path: path, original: original, num_lines: original.split('\n').length}
                    )
                );
                continue;
            }

            // SUCCESS!
            this.io.write_text(full_path, content);
        }

        if (errors.length > 0) {
            let errors_str = errors.join("\n\n");
            if (errors.length < uniq.length) {
                errors_str += other_hunks_applied;
            }
            throw new Error(errors_str);
        }
    }
}


module.exports=UnifiedDiffCoder

// ... rest of the code ...

