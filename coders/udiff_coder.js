const difflib = require('difflib');
const fs = require("fs")
// const groupby = require('itertools').groupby;
const path = require('path');
const codebolt = require('@codebolt/codeboltjs').default;

const Coder = require('./base_coder');
const SearchReplace = require('./../utils/search_replace');
const UnifiedDiffPrompts = require('./udiff_prompts');

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

    async apply_edits(edits) {
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
            let {content} = await codebolt.fs.readFile(full_path)// this.io.read_text(full_path);

            let [original, _] = hunk_to_before_after(hunk);

            try {
                content = do_replace(full_path, content, hunk);
            } catch (err) {
                if (err instanceof SearchReplace.SearchTextNotUnique) {
                    errors.push(
                        not_unique_error.format(
                            {path: path, original: original, num_lines: original.split('\n').length}
                        )
                    );
                    continue;
                }
                throw err;
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
            codebolt.fs.createFile(full_path,content)
            // this.io.write_text(full_path, content);
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
function do_replace(fname, content, hunk) {
    fname = path.resolve(fname);

    let [before_text, after_text] = hunk_to_before_after(hunk);

    // does it want to make a new file?
    if (!fs.existsSync(fname) && !before_text.trim()) {
        fs.writeFileSync(fname, '');
        content = "";
    }

    if (content === null) {
        return;
    }

    // TODO: handle inserting into new file
    if (!before_text.trim()) {
        // append to existing file, or start a new file
        let new_content = content + after_text;
        return new_content;
    }

    let new_content = null;

    new_content = apply_hunk(content, hunk);
    if (new_content) {
        return new_content;
    }
}

function collapse_repeats(s) {
    return Array.from(new Set(s.split(''))).join('');
}

function apply_hunk(content, hunk) {
    let [before_text, after_text] = hunk_to_before_after(hunk);

    let res = directly_apply_hunk(content, hunk);
    if (res) {
        return res;
    }

    hunk = make_new_lines_explicit(content, hunk);

    // just consider space vs not-space
    let ops = hunk.map(line => line[0]).join('');
    ops = ops.replace("-", "x");
    ops = ops.replace("+", "x");
    ops = ops.replace("\n", " ");

    let cur_op = " ";
    let section = [];
    let sections = [];

    for (let i = 0; i < ops.length; i++) {
        let op = ops[i];
        if (op !== cur_op) {
            sections.push(section);
            section = [];
            cur_op = op;
        }
        section.push(hunk[i]);
    }

    sections.push(section);
    if (cur_op !== " ") {
        sections.push([]);
    }

    let all_done = true;
    for (let i = 2; i < sections.length; i += 2) {
        let preceding_context = sections[i - 2];
        let changes = sections[i - 1];
        let following_context = sections[i];

        let res = apply_partial_hunk(content, preceding_context, changes, following_context);
        if (res) {
            content = res;
        } else {
            all_done = false;
            // FAILED!
            // this_hunk = preceding_context + changes + following_context
            break;
        }
    }

    if (all_done) {
        return content;
    }
}

function flexi_just_search_and_replace(texts) {
    let strategies = [
        [search_and_replace, all_preprocs],
    ];

    return flexible_search_and_replace(texts, strategies);
}

function make_new_lines_explicit(content, hunk) {
    let [before, after] = hunk_to_before_after(hunk);

    let diff = diff_lines(before, content);

    let back_diff = [];
    for (let line of diff) {
        if (line[0] === "+") {
            continue;
        }
        back_diff.push(line);
    }

    let new_before = directly_apply_hunk(before, back_diff);
    if (!new_before) {
        return hunk;
    }

    if (new_before.trim().length < 10) {
        return hunk;
    }

    before = before.split('\n', true);
    new_before = new_before.split('\n', true);
    after = after.split('\n', true);

    if (new_before.length < before.length * 0.66) {
        return hunk;
    }

    let new_hunk = difflib.unifiedDiff(new_before, after, {n: Math.max(new_before.length, after.length)});
    new_hunk = new_hunk.slice(3);

    return new_hunk;
}

function cleanup_pure_whitespace_lines(lines) {
    return lines.map(line => line.trim() ? line : line.slice(-(line.length - line.trimRight().length)));
}

function normalize_hunk(hunk) {
    let [before, after] = hunk_to_before_after(hunk, true);

    before = cleanup_pure_whitespace_lines(before);
    after = cleanup_pure_whitespace_lines(after);

    let diff = difflib.unifiedDiff(before, after, {n: Math.max(before.length, after.length)});
    diff = diff.slice(3);
    return diff;
}

function directly_apply_hunk(content, hunk) {
    let [before, after] = hunk_to_before_after(hunk);

    if (!before) {
        return;
    }

    let [before_lines, _] = hunk_to_before_after(hunk, true);
    before_lines = before_lines.map(line => line.trim()).join('');

    // Refuse to do a repeated search and replace on a tiny bit of non-whitespace context
    if (before_lines.length < 10 && content.split(before).length > 1) {
        return;
    }

    try {
        let new_content = flexi_just_search_and_replace([before, after, content]);
    } catch (err) {
        if (err instanceof SearchTextNotUnique) {
            let new_content = null;
        }
    }

    return new_content;
}

function apply_partial_hunk(content, preceding_context, changes, following_context) {
    let len_prec = preceding_context.length;
    let len_foll = following_context.length;

    let use_all = len_prec + len_foll;

    // if there is a - in the hunk, we can go all the way to `use=0`
    for (let drop = 0; drop <= use_all; drop++) {
        let use = use_all - drop;

        for (let use_prec = len_prec; use_prec >= 0; use_prec--) {
            if (use_prec > use) {
                continue;
            }

            let use_foll = use - use_prec;
            if (use_foll > len_foll) {
                continue;
            }

            let this_prec = use_prec ? preceding_context.slice(-use_prec) : [];

            let this_foll = following_context.slice(0, use_foll);

            let res = directly_apply_hunk(content, this_prec.concat(changes, this_foll));
            if (res) {
                return res;
            }
        }
    }
}

function find_diffs(content) {
    // We can always fence with triple-quotes, because all the udiff content
    // is prefixed with +/-/space.

    if (!content.endsWith("\n")) {
        content = content + "\n";
    }

    let lines = content.split(/\r?\n/).map((line, index, array) => 
        index < array.length - 1 ? line.trim() + '\n' : line
    );
    let line_num = 0;
    let edits = [];
    while (line_num < lines.length) {
        while (line_num < lines.length) {
            let line = lines[line_num];
            if (line.startsWith("```diff")) {
                let [new_line_num, these_edits] = process_fenced_block(lines, line_num + 1);
                line_num = new_line_num;
                edits = edits.concat(these_edits);
                break;
            }
            line_num++;
        }
    }

    // For now, just take 1!
    // edits = edits.slice(0, 1);

    return edits;
}

function process_fenced_block(lines, start_line_num) {
    let line_num;
    for (line_num = start_line_num; line_num < lines.length; line_num++) {
        let line = lines[line_num];
        if (line.startsWith("```")) {
            break;
        }
    }

    let block = lines.slice(start_line_num, line_num);
    block.push("@@ @@");

    let fname;
    if (block[0].startsWith("--- ") && block[1].startsWith("+++ ")) {
        // Extract the file path, considering that it might contain spaces
        fname = block[1].slice(4).trim();
        block = block.slice(2);
    } else {
        fname = null;
    }

    let edits = [];

    let keeper = false;
    let hunk = [];
    let op = " ";
    for (let line of block) {
        hunk.push(line);
        if (line.length < 2) {
            continue;
        }

        if (line.startsWith("+++ ") && hunk[hunk.length - 2].startsWith("--- ")) {
            if (hunk[hunk.length - 3] === "\n") {
                hunk = hunk.slice(0, -3);
            } else {
                hunk = hunk.slice(0, -2);
            }

            edits.push([fname, hunk]);
            hunk = [];
            keeper = false;

            fname = line.slice(4).trim();
            continue;
        }

        op = line[0];
        if (op === "-" || op === "+") {
            keeper = true;
            continue;
        }
        if (op !== "@") {
            continue;
        }
        if (!keeper) {
            hunk = [];
            continue;
        }

        hunk = hunk.slice(0, -1);
        edits.push([fname, hunk]);
        hunk = [];
        keeper = false;
    }

    return [line_num + 1, edits];
}

function hunk_to_before_after(hunk, lines=false) {
    let before = [];
    let after = [];
    let op = " ";
    for (let line of hunk) {
        if (line.length < 2) {
            op = " ";
            line = line;
        } else {
            op = line[0];
            line = line.slice(1);
        }

        if (op === " ") {
            before.push(line);
            after.push(line);
        } else if (op === "-") {
            before.push(line);
        } else if (op === "+") {
            after.push(line);
        }
    }

    if (lines) {
        return [before, after];
    }

    before = before.join('');
    after = after.join('');

    return [before, after];
}



module.exports= UnifiedDiffCoder


