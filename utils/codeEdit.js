const stringSimilarity = require('string-similarity');
const DEFAULT_FENCE = ["`".repeat(3), "`".repeat(3)];
const path = require('path');

const DIVIDER = "=======";
const UPDATED = ">>>>>>> REPLACE";
const HEAD = "<<<<<<< SEARCH";

const missing_filename_err = "Bad/missing filename. The filename must be alone on the line before the opening fence {fence[0]}";
const separators = [HEAD, DIVIDER, UPDATED];
const split_re = new RegExp(`^((?:${separators.join("|")})[ ]*\n)`, 'gm');


const codeEdit = {
    // this is used to split the content to lines
    split_to_lines: function (content) {
        let lines = content.split(/\r?\n/);
        lines = lines.map((line, index) => index < lines.length - 1 ? line + "\n" : line);
        return [content, lines];
    },
    strip_filename(filename, fence) {
        filename = filename.trim();

        if (filename === "...") {
            return;
        }

        const start_fence = fence[0];
        if (filename.startsWith(start_fence)) {
            return;
        }

        filename = filename.replace(/:$/, '');
        filename = filename.replace(/^#/, '');
        filename = filename.trim();
        filename = filename.replace(/`/g, '');
        filename = filename.replace(/\*/g, '');
        filename = filename.replace(/\\_/g, '_');

        return filename;
    },
    find_original_update_blocks(content, fence = DEFAULT_FENCE) {
        if (!content.endsWith("\n")) {
            content = content + "\n";
        }

        let pieces = content.split(split_re);

        pieces = pieces.reverse();
        let processed = [];

        let current_filename = null;
        let results = [];
        try {
            while (pieces.length > 0) {
                let cur = pieces.pop();

                if ([DIVIDER, UPDATED].includes(cur)) {
                    processed.push(cur);
                    throw new Error(`Unexpected ${cur}`);
                }

                if (cur.trim() !== HEAD) {
                    processed.push(cur);
                    continue;
                }

                processed.push(cur);

                let filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').pop(), fence);
                try {
                    if (!filename) {
                        filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').slice(-2, -1)[0], fence);
                    }
                    if (!filename) {
                        if (current_filename) {
                            filename = current_filename;
                        } else {
                            throw new Error(missing_filename_err.replace('{fence[0]}', fence[0]));
                        }
                    }
                } catch (e) {
                    if (current_filename) {
                        filename = current_filename;
                    } else {
                        throw new Error(missing_filename_err.replace('{fence[0]}', fence[0]));
                    }
                }

                current_filename = filename;

                let original_text = pieces.pop();
                processed.push(original_text);

                let divider_marker = pieces.pop();
                processed.push(divider_marker);
                if (divider_marker.trim() !== DIVIDER) {
                    throw new Error(`Expected \`${DIVIDER}\` not ${divider_marker.trim()}`);
                }

                let updated_text = pieces.pop();
                processed.push(updated_text);

                let updated_marker = pieces.pop();
                processed.push(updated_marker);
                if (updated_marker.trim() !== UPDATED) {
                    throw new Error(`Expected \`${UPDATED}\` not \`${updated_marker.trim()}\``);
                }

                results.push([
                    filename,
                    original_text,
                    updated_text
                ]);
            }
        } catch (e) {
            processed = processed.join('');
            throw new Error(`${processed}\n^^^ ${e.message}`);
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
    replace_part_with_missing_leading_whitespace: function (whole_lines, part_lines, replace_lines) {
        // // GPT often messes up leading whitespace.
        // // It usually does it uniformly across the ORIG and UPD blocks.
        // // Either omitting all leading whitespace, or including only some of it.

        // // Outdent everything in part_lines and replace_lines by the max fixed amount possible
        // let leading = part_lines.filter(p => p.trim()).map(p => p.length - p.trimLeft().length)
        //     .concat(replace_lines.filter(p => p.trim()).map(p => p.length - p.trimLeft().length));

        // if (leading.length && Math.min(...leading)) {
        //     let numLeading = Math.min(...leading);
        //     part_lines = part_lines.map(p => p.trim() ? p.slice(numLeading) : p);
        //     replace_lines = replace_lines.map(p => p.trim() ? p.slice(numLeading) : p);
        // }

        // // can we find an exact match not including the leading whitespace
        // let numpart_lines = part_lines.length;

        // for (let i = 0; i < whole_lines.length - numpart_lines + 1; i++) {
        //     let addLeading = codeEdit.match_but_for_leading_whitespace(
        //         whole_lines.slice(i, i + numpart_lines), part_lines
        //     );

        //     if (addLeading === null) {
        //         continue;
        //     }

        //     replace_lines = replace_lines.map(rline => rline.trim() ? addLeading + rline : rline);
        //     whole_lines = whole_lines.slice(0, i).concat(replace_lines).concat(whole_lines.slice(i + numpart_lines));
        //     return whole_lines.join("");
        // }

        // return null
        // GPT often messes up leading whitespace.
        // It usually does it uniformly across the ORIG and UPD blocks.
        // Either omitting all leading whitespace, or including only some of it.

        // Outdent everything in part_lines and replace_lines by the max fixed amount possible
        const leading = part_lines.filter(line => line.trim()).map(line => line.length - line.trimLeft().length);
        const additionalLeading = replace_lines.filter(line => line.trim()).map(line => line.length - line.trimLeft().length);

        const combinedLeading = [...leading, ...additionalLeading];
        const maxLeading = Math.max(...combinedLeading);

        if (maxLeading) {
            // Adjust part_lines and replace_lines by removing the maximum leading whitespace found
            part_lines = part_lines.map(line => line.startsWith(' ') ? line.slice(maxLeading) : line);
            replace_lines = replace_lines.map(line => line.startsWith(' ') ? line.slice(maxLeading) : line);
        }

        // Attempt to find an exact match not including the leading whitespace
        const numpart_lines = part_lines.length;

        for (let i = 0; i <= whole_lines.length - numpart_lines; i++) {
            let addLeading = this.match_but_for_leading_whitespace(whole_lines.slice(i, i + numpart_lines), part_lines);

            if (!addLeading) {
                continue;
            }

            // Correctly handle the addition of leading whitespace without adding extra newlines
            replace_lines = replaceLines.map(line => line.trim() ? addLeading + line : line);
            whole_lines = whole_lines.slice(0, i).concat(replace_lines, wholeLines.slice(i + numpart_lines));
            return whole_lines.join('\n').trim();
        }

        return null;
    },

    // the function checks if whole_lines and part_lines match when leading whitespace is ignored 
    // and ensures that the leading whitespace is uniform across all lines. 
    // If both conditions are met, it returns the common leading whitespace.
    match_but_for_leading_whitespace(whole_lines, part_lines) {
        const num = whole_lines.length;

        // does the non-whitespace all agree?
        const strippedWholeLines = whole_lines.map(line => line.replace(/^\s*/, ''));
        const strippedPartLines = part_lines.map(line => line.replace(/^\s*/, ''));

        if (!strippedWholeLines.every((element, index) => element === strippedPartLines[index])) {
            return null;
        }

        // are they all offset the same?
        const offsets = whole_lines.reduce((acc, line, index) => {
            if (line.trim()) {
                const offset = line.length - strippedWholeLines[index].length;
                acc.push(offset);
            }
            return acc;
        }, []);

        if (new Set(offsets).size !== 1) {
            return null;
        }

        return offsets[0];

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
        if (!fs.existsSync(fname) && !before_text.trim()) {
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

module.exports = {
    codeEdit
}