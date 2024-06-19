const stringSimilarity = require('string-similarity');
const DEFAULT_FENCE = ["`".repeat(3), "`".repeat(3)];
const path = require('path');



const missing_filename_err = "Bad/missing filename. The filename must be alone on the line before the opening fence {fence[0]}";
const HEAD = "<<<<<<< SEARCH";
const DIVIDER = "=======";
const UPDATED = ">>>>>>> REPLACE";

const separators = [HEAD, DIVIDER, UPDATED].join("|");

const split_re = new RegExp(`^(?:${separators})[ ]*\n`, "gm");


const codeEdit = {
    // this is used to split the content to lines
    split_to_lines: function (content) {
        if (content && !content.endsWith("\n")) {
            content += "\n";
          }
          let lines = content.split(/(?<=\n)/);
 // Handle both LF (\n) and CRLF (\r\n) line endings and add '\n' after every line
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
     find_original_update_blocks(content, fence=DEFAULT_FENCE) {
        // make sure we end with a newline, otherwise the regex will miss <<UPD on the last line
        if (!content.endsWith("\n")) {
            content = content + "\n";
        }
    
        let pieces = content.split(split_re);
    
        pieces.reverse();
        let processed = [];
    
        // Keep using the same filename in cases where GPT produces an edit block
        // without a filename.
        let current_filename = null;
        let results = [];
        try {
            while (pieces.length > 0) {
                let cur = pieces.pop();
    
                if (cur === DIVIDER || cur === UPDATED) {
                    processed.push(cur);
                    throw new Error(`Unexpected ${cur}`);
                }
    
                if (cur.trim() !== HEAD) {
                    processed.push(cur);
                    continue;
                }
    
                processed.push(cur);  // original_marker
    
                let filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').slice(-1)[0], fence);
                try {
                    if (!filename) {
                        filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').slice(-2)[0], fence);
                    }
                    if (!filename) {
                        if (current_filename) {
                            filename = current_filename;
                        } else {
                            throw new Error(missing_filename_err.replace('{fence}', fence));
                        }
                    }
                } catch (e) {
                    if (current_filename) {
                        filename = current_filename;
                    } else {
                        throw new Error(missing_filename_err.replace('{fence}', fence));
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
    
                results.push([filename, original_text, updated_text]);
            }
        } catch (e) {
            processed = processed.join('');
            let err = e.message;
            throw new Error(`${processed}\n^^^ ${err}`);
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
        console.log(res);
        if (res) {
            return res;
        }
    },

    //This is the case where it takes care if there is three dots ... in the answer that the llm sends
    try_dotdotdots: function (whole, part, replace) {
            /**
             * See if the edit block has ... lines.
             * If not, return null.
             * 
             * If yes, try and do a perfect edit with the ... chunks.
             * If there's a mismatch or otherwise imperfect edit, throw an Error.
             * 
             * If perfect edit succeeds, return the updated whole.
             */

            const dotsRe = /(^\s*\.\.\.\n)/gm;

            const partPieces = part.split(dotsRe);
            const replacePieces = replace.split(dotsRe);

            if (partPieces.length !== replacePieces.length) {
                throw new Error("Unpaired ... in SEARCH/REPLACE block");
            }

            if (partPieces.length === 1) {
                // no dots in this edit block, just return null
                return null;
            }

            // Compare odd strings in partPieces and replacePieces
            const allDotsMatch = partPieces.filter((_, i) => i % 2 === 1)
                .every((piece, i) => piece === replacePieces[2 * i + 1]);

            if (!allDotsMatch) {
                throw new Error("Unmatched ... in SEARCH/REPLACE block");
            }

            const partPiecesFiltered = partPieces.filter((_, i) => i % 2 === 0);
            const replacePiecesFiltered = replacePieces.filter((_, i) => i % 2 === 0);

            const pairs = partPiecesFiltered.map((part, i) => [part, replacePiecesFiltered[i]]);
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

                const partLines = part.split('\n').filter(line => line.trim().length > 0);
                const replaceLines = replace.split('\n').filter(line => line.trim().length > 0);

                const leadingWhitespace = partLines[0].match(/^\s*/)[0];
                const leadingReplaceWhitespace = replaceLines[0].match(/^\s*/)[0];

                partLines[0] = partLines[0].trimStart();
                replaceLines[0] = replaceLines[0].trimStart();

                const partWithLeading = partLines.join('\n' + leadingWhitespace);
                const replaceWithLeading = replaceLines.join('\n' + leadingReplaceWhitespace);

                if ((whole.match(new RegExp(partWithLeading, 'g')) || []).length === 0) {
                    throw new Error();
                }
                if ((whole.match(new RegExp(partWithLeading, 'g')) || []).length > 1) {
                    throw new Error();
                }

                whole = whole.replace(partWithLeading, replaceWithLeading);
            }

            return whole;
        }

        ,




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
        console.log(modified_whole);
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