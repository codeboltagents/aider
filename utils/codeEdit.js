const stringSimilarity = require('string-similarity');

export const codeEdit = {
    replace_most_similar_chunk: function (whole, part, replace) {
        let [whole, whole_lines] = this.split_to_lines(whole);
        let [part, part_lines] = this.split_to_lines(part);
        let [replace, replace_lines] = this.split_to_lines(replace);
        let res;

        res = this.perfect_or_whitespace(whole_lines, part_lines, replace_lines);
        if (res) {
            return res;
        }

        // drop leading empty line, GPT sometimes adds them spuriously
        if (part_lines.length > 2 && !part_lines[0].trim()) {
            let skip_blank_line_part_lines = part_lines.slice(1);
            res = this.perfect_or_whitespace(whole_lines, skip_blank_line_part_lines, replace_lines);
            if (res) {
                return res;
            }
        }

        // Try to handle when it elides code with ...
        try {
            res = this.try_dotdotdots(whole, part, replace);
            if (res) {
                return res;
            }
        } catch (error) {
            if (!(error instanceof ValueError)) {
                throw error;
            }
        }

        // Try fuzzy matching
        res = this.replace_closest_edit_distance(whole_lines, part, part_lines, replace_lines);
        if (res) {
            return res;
        }
    },

    //This is the case where it takes care if there is three dots ... in the answer that the llm sends
    try_dotdotdots: function (whole, part, replace){
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

    // this is used to split the content to lines
    split_to_lines: function (content){
        if (content && !content.endsWith("\n")) {
            content += "\n";
        }
        let lines = content.split("\n");
        return [content, lines];
    },
     
    //replace the part_lines with replace_lines in case this is a Perfect Replace or has leading whitespace
    perfect_or_whitespace: function (whole_lines, part_lines, replace_lines) {
        // Try for a perfect match
        let res = this.perfect_replace(whole_lines, part_lines, replace_lines);
        if (res) {
            return res;
        }

        // Try being flexible about leading whitespace
        res = this.replace_part_with_missing_leading_whitespace(whole_lines, part_lines, replace_lines);
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

        for (let i = 0; i < whole_lines.length - num_part_lines + 1; i++) {
            let add_leading = this.match_but_for_leading_whitespace(
                whole_lines.slice(i, i + num_part_lines), part_lines
            );

            if (add_leading === null) {
                continue;
            }

            replace_lines = replace_lines.map(rline => rline.trim() ? add_leading + rline : rline);
            whole_lines = [...whole_lines.slice(0, i), ...replace_lines, ...whole_lines.slice(i + num_part_lines)];
            return whole_lines.join("");
        }

        return null;
    },

    // the function checks if whole_lines and part_lines match when leading whitespace is ignored 
    // and ensures that the leading whitespace is uniform across all lines. 
    // If both conditions are met, it returns the common leading whitespace.
    match_but_for_leading_whitespace: function (whole_lines, part_lines) {
        let num = whole_lines.length;

        // Check if the content without the whitespace is same
        if (!whole_lines.every((line, i) => line.trimStart() === part_lines[i].trimStart())) {
            return;
        }

        // are they all offset the same?
        let add = new Set(
            whole_lines.map((line, i) => line.slice(0, line.length - part_lines[i].length))
            .filter(line => line.trim())
        );

        if (add.size !== 1) {
            return;
        }

        return [...add][0];
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
    }
    
}