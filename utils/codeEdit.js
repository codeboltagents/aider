const stringSimilarity = require('string-similarity');

const fs = require('fs')

const path = require('path');
const DEFAULT_FENCE = ['```', '```'];
const HEAD = '<<<<<<< SEARCH';
const DIVIDER = '=======';
const UPDATED = '>>>>>>> REPLACE';


const missing_filename_err = (fence) => (
    `Bad/missing filename. The filename must be alone on the line before the opening fence ${fence[0]}`
);



// const missing_filename_err = "Bad/missing filename. The filename must be alone on the line before the opening fence {fence[0]}";

const separators = [HEAD, DIVIDER, UPDATED].join('|');
const split_re = new RegExp(`^((?:${separators})[ ]*\n)`, 'm');


class ValueError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValueError';
    }
}

class IndexError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IndexError';
    }
}

const codeEdit = {
   

     safe_abs_path(res) {
        // Gives an abs path, which safely returns a full (not 8.3) windows path
        res = path.resolve(res);
        return res;
    },
    // this is used to split the content to lines
    split_to_lines: function (content) {
        if (content && !content.endsWith("\n")) {
            content += "\n";
        }
        let lines = content.split(/\n/).map((line, index, array) => {
            return index < array.length - 1 ? line + "\n" : line;
        });
        if (lines[lines.length - 1] === "") {
            lines.pop();
        }
        return [content, lines];

        // let lines = content.split(/\r?\n/);
        // lines = lines.map((line, index) => index < lines.length - 1 ? line + "\n" : line);
        // return [content, lines];
    },
    strip_filename(filename, fence) {
        filename = filename.trim();

        if (filename === "...") {
            return;
        }

        if (filename.startsWith(fence[0])) {
            return;
        }

        filename = filename.replace(":", "").trim();
        filename = filename.replace("#", "").trim();
        filename = filename.replace("`", "").trim();
        filename = filename.replace("*", "").trim();
        filename = filename.replace("\\_", "_");

        return filename;
    },

    find_filename(lines, fence) {
        // Reverse the lines and take the first 3
        lines.reverse();
        lines = lines.slice(0, 3);

        for (let line of lines) {
            // If we find a filename, done
            let filename = codeEdit.strip_filename(line, fence);
            if (filename && filename !== '') {
                return filename;
            }

            // Only continue as long as we keep seeing fences
            if (!line.startsWith(fence[0]) && filename !== '') {
                return;
            }
        }
    },
    find_original_update_blocks: function (content, fence = DEFAULT_FENCE) {
        if (!content.endsWith('\n')) {
            content += '\n';
        }
        const pieces = content.split(split_re).reverse();
        let processed = [];

        let currentFilename = null;
        let results = [];
        try {
            while (pieces.length) {
                const cur = pieces.pop();

                if (cur === DIVIDER || cur === UPDATED) {
                    processed.push(cur);
                    throw new Error(`Unexpected ${cur}`);
                }

                if (cur.trim() !== HEAD) {
                    processed.push(cur);
                    continue;
                }

                processed.push(cur);
                let filename = codeEdit.find_filename(processed[processed.length - 2].split('\n'), fence);
                if (!filename) {
                    if (currentFilename) {
                        filename = currentFilename;
                    } else {
                        throw new ValueError(missing_filename_err(fence));
                    }
                }
                // let filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').pop(), fence);

                // try {
                //     if (!filename) {
                //         filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').slice(-2)[0], fence);
                //     }
                //     if (!filename) {
                //         if (currentFilename) {
                //             filename = currentFilename;
                //         } else {
                //             throw new ValueError(missing_filename_err(fence));
                //         }
                //     }
                // } catch (e) {

                //     if (currentFilename) {
                //         filename = currentFilename;
                //     } else {
                //         throw new ValueError(missing_filename_err(fence));
                //     }
                // }

                currentFilename = filename;

                const originalText = pieces.pop();
                processed.push(originalText);

                const dividerMarker = pieces.pop();
                processed.push(dividerMarker);
                if (dividerMarker.trim() !== DIVIDER) {
                    throw new ValueError(`Expected \`${DIVIDER}\` not ${dividerMarker.trim()}`);
                }

                const updatedText = pieces.pop();
                processed.push(updatedText);

                const updatedMarker = pieces.pop();
                processed.push(updatedMarker);
                if (updatedMarker.trim() !== UPDATED) {
                    throw new ValueError(`Expected \`${UPDATED}\` not \`${updatedMarker.trim()}\``);
                }

                results.push([
                    filename,
                    originalText,
                    updatedText
                ]);
            }
        } catch (e) {
            console.log(e.name);
            processed = processed.join('');
            if (e instanceof ValueError) {
                const err = e.message;
                throw new Error(`${processed}\n^^^ ${err}`);
            } else if (e instanceof IndexError) {
                throw new Error(`${processed}\n^^^ Incomplete SEARCH/REPLACE block.`);
            } else {
                throw new Error(`${processed}\n^^^ Incomplete Error parsing SEARCH/REPLACE block.`);
            }
        }

        return results;

    },
    replace_most_similar_chunk: function (whole, part, replace) {
        let wholePrep = codeEdit.split_to_lines(whole);
        let partPrep = codeEdit.split_to_lines(part);
        let replacePrep = codeEdit.split_to_lines(replace);

        let whole_lines = wholePrep[1];
        let part_lines = partPrep[1];
        let replace_lines = replacePrep[1];

        let res = codeEdit.perfect_or_whitespace(whole_lines, part_lines, replace_lines);
        if (res) {
            return res;
        }

        // drop leading empty line, GPT sometimes adds them spuriously (issue #25)
        if (part_lines.length > 2 && !part_lines[0].trim()) {
            let skip_blank_line_part_lines = part_lines.slice(1);
            res = codeEdit.perfect_or_whitespace(whole_lines, skip_blank_line_part_lines, replace_lines);
            if (res) {
                return res;
            }
        }

        // Try to handle when it elides code with ...
        try {
            res = codeEdit.try_dotdotdots(whole, part, replace);
            if (res) {
                return res;
            }
        } catch (error) {
            // handle error
        }

        // Try fuzzy matching
        res = codeEdit.replace_closest_edit_distance(whole_lines, part, part_lines, replace_lines);
        if (res) {
            return res;
        }
    },

    //This is the case where it takes care if there is three dots ... in the answer that the llm sends
    try_dotdotdots: function (whole, part, replace) {
        let dots_re = new RegExp("(^\\s*\\.\\.\\.\\n)", "gm");

        let part_pieces = part.split(dots_re);
        let replace_pieces = replace.split(dots_re);

        if (part_pieces.length !== replace_pieces.length) {
            throw new Error("Unpaired ... in SEARCH/REPLACE block");
        }

        if (part_pieces.length === 1) {
            // no dots in this edit block, just return None
            return;
        }

        // Compare odd strings in part_pieces and replace_pieces
        let all_dots_match = part_pieces.every((part_piece, i) => {
            return i % 2 !== 0 ? part_piece === replace_pieces[i] : true;
        });

        if (!all_dots_match) {
            throw new Error("Unmatched ... in SEARCH/REPLACE block");
        }

        part_pieces = part_pieces.filter((_, i) => i % 2 === 0);
        replace_pieces = replace_pieces.filter((_, i) => i % 2 === 0);

        let pairs = part_pieces.map((part_piece, i) => [part_piece, replace_pieces[i]]);
        for (let [part, replace] of pairs) {
            if (!part && !replace) {
                continue;
            }

            if (!part && replace) {
                if (!whole.endsWith("\n")) {
                    whole += "\n";
                }
                whole += replace;
                continue;
            }

            if (!whole.includes(part)) {
                throw new Error;
            }
            if ((whole.match(new RegExp(part, "g")) || []).length > 1) {
                throw new Error;
            }

            whole = whole.replace(part, replace);
        }

        return whole;
    },



    //replace the part_lines with replace_lines in case this is a Perfect Replace or has leading whitespace
    perfect_or_whitespace: function (whole_lines, part_lines, replace_lines) {
        // Try for a perfect match
        let res = codeEdit.perfect_replace(whole_lines, part_lines, replace_lines);
        if (res) {
            return res;
        }

        // Try being flexible about leading whitespace
        res = codeEdit.replace_part_with_missing_leading_whitespace(whole_lines, part_lines, replace_lines);
        if (res) {
            return res;
        }
    },

    //This replaces if the perfecet Matching of the part lines in the whole lines
    perfect_replace: function (whole_lines, part_lines, replace_lines) {
        let part_tup = part_lines;
        let part_len = part_lines.length;

        for (let i = 0; i < whole_lines.length - part_len + 1; i++) {
            let whole_tup = whole_lines.slice(i, i + part_len);
            if (JSON.stringify(part_tup) === JSON.stringify(whole_tup)) {
                let res = [...whole_lines.slice(0, i), ...replace_lines, ...whole_lines.slice(i + part_len)];
                return res.join("");
            }
        }
    },

    //This replaces if the part lines are present in the whole lines and the part lines are present in the whole lines with some leading whitespace
    replace_part_with_missing_leading_whitespace(whole_lines, part_lines, replace_lines) {
        // GPT often messes up leading whitespace.
        // It usually does it uniformly across the ORIG and UPD blocks.
        // Either omitting all leading whitespace, or including only some of it.

        // Outdent everything in part_lines and replace_lines by the max fixed amount possible
        let leading = part_lines.filter(p => p.trim()).map(p => p.length - p.trimStart().length)
            .concat(replace_lines.filter(p => p.trim()).map(p => p.length - p.trimStart().length));

        if (leading.length && Math.min(...leading)) {
            let num_leading = Math.min(...leading);
            part_lines = part_lines.map(p => p.trim() ? p.slice(num_leading) : p);
            replace_lines = replace_lines.map(p => p.trim() ? p.slice(num_leading) : p);
        }

        // can we find an exact match not including the leading whitespace
        let num_part_lines = part_lines.length;

        for (let i = 0; i <= whole_lines.length - num_part_lines; i++) {
            let add_leading = codeEdit.match_but_for_leading_whitespace(whole_lines.slice(i, i + num_part_lines), part_lines);

            if (add_leading === null || add_leading == undefined) {
                continue;
            }

            replace_lines = replace_lines.map(rline => rline.trim() ? add_leading + rline : rline);
            whole_lines = whole_lines.slice(0, i).concat(replace_lines, whole_lines.slice(i + num_part_lines));
            return whole_lines.join('');
        }

        return null;
    },


    // the function checks if whole_lines and part_lines match when leading whitespace is ignored 
    // and ensures that the leading whitespace is uniform across all lines. 
    // If both conditions are met, it returns the common leading whitespace.
    match_but_for_leading_whitespace(whole_lines, part_lines) {
        const num = whole_lines.length;

        // Does the non-whitespace all agree?
        for (let i = 0; i < num; i++) {
            if (whole_lines[i].trimStart() !== part_lines[i].trimStart()) {
                return;
            }
        }

        // Are they all offset the same?
        const add = new Set();

        for (let i = 0; i < num; i++) {
            if (whole_lines[i].trim()) {
                add.add(whole_lines[i].slice(0, whole_lines[i].length - part_lines[i].length));
            }
        }

        if (add.size !== 1) {
            return;
        }

        return add.values().next().value;
    },


    //Trying to Do fuzzy Mapping, by using the code matching to text based search instead of line by line 
    replace_closest_edit_distance: function (whole_lines, part, part_lines, replace_lines) {
        let similarity_thresh = 0.8;

        let max_similarity = 0;
        let most_similar_chunk_start = -1;
        let most_similar_chunk_end = -1;

        let scale = 0.1;
        let min_len = Math.floor(part_lines.length * (1 - scale));
        let max_len = Math.ceil(part_lines.length * (1 + scale));

        for (let length = min_len; length < max_len; length++) {
            for (let i = 0; i < whole_lines.length - length + 1; i++) {
                let chunk = whole_lines.slice(i, i + length).join("");

                let similarity = stringSimilarity.compareTwoStrings(chunk, part);
                if (similarity > max_similarity) {
                    max_similarity = similarity;
                    most_similar_chunk_start = i;
                    most_similar_chunk_end = i + length;
                }
            }
        }

        if (max_similarity < similarity_thresh) {
            return;
        }

        let modified_whole = [
            ...whole_lines.slice(0, most_similar_chunk_start),
            ...replace_lines,
            ...whole_lines.slice(most_similar_chunk_end)
        ];
        modified_whole = modified_whole.join("");

        return modified_whole;
    },
    do_replace: function (fname, content, before_text, after_text, fence = null) {
        before_text = codeEdit.strip_quoted_wrapping(before_text, fname, fence);
        after_text = codeEdit.strip_quoted_wrapping(after_text, fname, fence);
        fname = path.resolve(fname);

        // does it want to make a new file?
        if (!fs.existsSync(fname)) {
            fs.mkdirSync(path.dirname(fname), { recursive: true });
            fs.writeFileSync(fname, '');
            content = "";
        }

        if (content === null) {
            return;
        }

        if (!before_text.trim()) {
            // append to existing file, or start a new file
            new_content = content + after_text;
        } else {
            new_content = codeEdit.replace_most_similar_chunk(content, before_text, after_text);
        }

        return new_content;
    },
    strip_quoted_wrapping: function (res, fname = null, fence = DEFAULT_FENCE) {
        /**
         * Given an input string which may have extra "wrapping" around it, remove the wrapping.
         * For example:
         *
         * filename.ext
         * ```
         * We just want this content
         * Not the filename and triple quotes
         * ```
         */
        if (!res) {
            return res;
        }

        res = res.split('\n');

        if (fname && res[0].trim().endsWith(path.basename(fname))) {
            res = res.slice(1);
        }

        if (res[0].startsWith(fence[0]) && res[res.length - 1].startsWith(fence[1])) {
            res = res.slice(1, -1);
        }

        res = res.join('\n');
        if (res && res[res.length - 1] !== '\n') {
            res += '\n';
        }

        return res;
    }

}

module.exports = codeEdit