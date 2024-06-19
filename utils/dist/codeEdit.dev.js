"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var stringSimilarity = require('string-similarity');

var DEFAULT_FENCE = ["`".repeat(3), "`".repeat(3)];

var path = require('path');

var DIVIDER = "=======";
var UPDATED = ">>>>>>> REPLACE";
var HEAD = "<<<<<<< SEARCH";
var missing_filename_err = "Bad/missing filename. The filename must be alone on the line before the opening fence {fence[0]}";
var separators = [HEAD, DIVIDER, UPDATED];
var split_re = new RegExp("^((?:".concat(separators.join("|"), ")[ ]*\n)"), 'gm');
var codeEdit = {
  // this is used to split the content to lines
  split_to_lines: function split_to_lines(content) {
    var lines = content.split(/\r?\n/);
    lines = lines.map(function (line, index) {
      return index < lines.length - 1 ? line + "\n" : line;
    });
    return [content, lines];
  },
  strip_filename: function strip_filename(filename, fence) {
    filename = filename.trim();

    if (filename === "...") {
      return;
    }

    var start_fence = fence[0];

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
  find_original_update_blocks: function find_original_update_blocks(content) {
    var fence = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_FENCE;

    if (!content.endsWith("\n")) {
      content = content + "\n";
    }

    var pieces = content.split(split_re);
    pieces = pieces.reverse();
    var processed = [];
    var current_filename = null;
    var results = [];

    try {
      while (pieces.length > 0) {
        var cur = pieces.pop();

        if ([DIVIDER, UPDATED].includes(cur)) {
          processed.push(cur);
          throw new Error("Unexpected ".concat(cur));
        }

        if (cur.trim() !== HEAD) {
          processed.push(cur);
          continue;
        }

        processed.push(cur);
        var filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').pop(), fence);

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
        var original_text = pieces.pop();
        processed.push(original_text);
        var divider_marker = pieces.pop();
        processed.push(divider_marker);

        if (divider_marker.trim() !== DIVIDER) {
          throw new Error("Expected `".concat(DIVIDER, "` not ").concat(divider_marker.trim()));
        }

        var updated_text = pieces.pop();
        processed.push(updated_text);
        var updated_marker = pieces.pop();
        processed.push(updated_marker);

        if (updated_marker.trim() !== UPDATED) {
          throw new Error("Expected `".concat(UPDATED, "` not `").concat(updated_marker.trim(), "`"));
        }

        results.push([filename, original_text, updated_text]);
      }
    } catch (e) {
      processed = processed.join('');
      throw new Error("".concat(processed, "\n^^^ ").concat(e.message));
    }

    return results;
  },
  replace_most_similar_chunk: function replace_most_similar_chunk(whole, part, replace) {
    var wholePrep = codeEdit.split_to_lines(whole);
    var partPrep = codeEdit.split_to_lines(part);
    var replacePrep = codeEdit.split_to_lines(replace);
    var whole_lines = wholePrep[1];
    var part_lines = partPrep[1];
    var replace_lines = replacePrep[1];
    var res = codeEdit.perfect_or_whitespace(whole_lines, part_lines, replace_lines);

    if (res) {
      return res;
    } // drop leading empty line, GPT sometimes adds them spuriously (issue #25)


    if (part_lines.length > 2 && !part_lines[0].trim()) {
      var skip_blank_line_part_lines = part_lines.slice(1);
      res = codeEdit.perfect_or_whitespace(whole_lines, skip_blank_line_part_lines, replace_lines);

      if (res) {
        return res;
      }
    } // Try to handle when it elides code with ...


    try {
      res = codeEdit.try_dotdotdots(whole, part, replace);

      if (res) {
        return res;
      }
    } catch (error) {} // handle error
    // Try fuzzy matching


    res = codeEdit.replace_closest_edit_distance(whole_lines, part, part_lines, replace_lines);

    if (res) {
      return res;
    }
  },
  //This is the case where it takes care if there is three dots ... in the answer that the llm sends
  try_dotdotdots: function try_dotdotdots(whole, part, replace) {
    /**
     * See if the edit block has ... lines.
     * If not, return null.
     * 
     * If yes, try and do a perfect edit with the ... chunks.
     * If there's a mismatch or otherwise imperfect edit, throw an Error.
     * 
     * If perfect edit succeeds, return the updated whole.
     */
    var dotsRe = /(^\s*\.\.\.\n)/gm;
    var partPieces = part.split(dotsRe);
    var replacePieces = replace.split(dotsRe);

    if (partPieces.length !== replacePieces.length) {
      throw new Error("Unpaired ... in SEARCH/REPLACE block");
    }

    if (partPieces.length === 1) {
      // no dots in this edit block, just return null
      return null;
    } // Compare odd strings in partPieces and replacePieces


    var allDotsMatch = partPieces.filter(function (_, i) {
      return i % 2 === 1;
    }).every(function (piece, i) {
      return piece === replacePieces[2 * i + 1];
    });

    if (!allDotsMatch) {
      throw new Error("Unmatched ... in SEARCH/REPLACE block");
    }

    var partPiecesFiltered = partPieces.filter(function (_, i) {
      return i % 2 === 0;
    });
    var replacePiecesFiltered = replacePieces.filter(function (_, i) {
      return i % 2 === 0;
    });
    var pairs = partPiecesFiltered.map(function (part, i) {
      return [part, replacePiecesFiltered[i]];
    });
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = pairs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var _step$value = _slicedToArray(_step.value, 2),
            _part = _step$value[0],
            _replace = _step$value[1];

        if (!_part && !_replace) {
          continue;
        }

        if (!_part && _replace) {
          if (!whole.endsWith("\n")) {
            whole += "\n";
          }

          whole += _replace;
          continue;
        }

        var partLines = _part.split('\n').filter(function (line) {
          return line.trim().length > 0;
        });

        var replaceLines = _replace.split('\n').filter(function (line) {
          return line.trim().length > 0;
        });

        var leadingWhitespace = partLines[0].match(/^\s*/)[0];
        var leadingReplaceWhitespace = replaceLines[0].match(/^\s*/)[0];
        partLines[0] = partLines[0].trimStart();
        replaceLines[0] = replaceLines[0].trimStart();
        var partWithLeading = partLines.join('\n' + leadingWhitespace);
        var replaceWithLeading = replaceLines.join('\n' + leadingReplaceWhitespace);

        if ((whole.match(new RegExp(partWithLeading, 'g')) || []).length === 0) {
          throw new Error();
        }

        if ((whole.match(new RegExp(partWithLeading, 'g')) || []).length > 1) {
          throw new Error();
        }

        whole = whole.replace(partWithLeading, replaceWithLeading);
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator["return"] != null) {
          _iterator["return"]();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return whole;
  },
  //replace the part_lines with replace_lines in case this is a Perfect Replace or has leading whitespace
  perfect_or_whitespace: function perfect_or_whitespace(whole_lines, part_lines, replace_lines) {
    // Try for a perfect match
    var res = codeEdit.perfect_replace(whole_lines, part_lines, replace_lines);

    if (res) {
      return res;
    } // Try being flexible about leading whitespace


    res = codeEdit.replace_part_with_missing_leading_whitespace(whole_lines, part_lines, replace_lines);

    if (res) {
      return res;
    }
  },
  //This replaces if the perfecet Matching of the part lines in the whole lines
  perfect_replace: function perfect_replace(whole_lines, part_lines, replace_lines) {
    var part_tup = part_lines;
    var part_len = part_lines.length;

    for (var i = 0; i < whole_lines.length - part_len + 1; i++) {
      var whole_tup = whole_lines.slice(i, i + part_len);

      if (JSON.stringify(part_tup) === JSON.stringify(whole_tup)) {
        var res = [].concat(_toConsumableArray(whole_lines.slice(0, i)), _toConsumableArray(replace_lines), _toConsumableArray(whole_lines.slice(i + part_len)));
        return res.join("");
      }
    }
  },
  //This replaces if the part lines are present in the whole lines and the part lines are present in the whole lines with some leading whitespace
  replace_part_with_missing_leading_whitespace: function replace_part_with_missing_leading_whitespace(whole_lines, part_lines, replace_lines) {
    // GPT often messes up leading whitespace.
    // It usually does it uniformly across the ORIG and UPD blocks.
    // Either omitting all leading whitespace, or including only some of it.
    // Outdent everything in part_lines and replace_lines by the max fixed amount possible
    var leading = part_lines.filter(function (p) {
      return p.trim();
    }).map(function (p) {
      return p.length - p.trimStart().length;
    }).concat(replace_lines.filter(function (p) {
      return p.trim();
    }).map(function (p) {
      return p.length - p.trimStart().length;
    }));

    if (leading.length && Math.min.apply(Math, _toConsumableArray(leading))) {
      var num_leading = Math.min.apply(Math, _toConsumableArray(leading));
      part_lines = part_lines.map(function (p) {
        return p.trim() ? p.slice(num_leading) : p;
      });
      replace_lines = replace_lines.map(function (p) {
        return p.trim() ? p.slice(num_leading) : p;
      });
    } // can we find an exact match not including the leading whitespace


    var num_part_lines = part_lines.length;

    var _loop = function _loop(i) {
      var add_leading = codeEdit.match_but_for_leading_whitespace(whole_lines.slice(i, i + num_part_lines), part_lines);

      if (add_leading === null) {
        return "continue";
      }

      replace_lines = replace_lines.map(function (rline) {
        return rline.trim() ? add_leading + rline : rline;
      });
      whole_lines = whole_lines.slice(0, i).concat(replace_lines, whole_lines.slice(i + num_part_lines));
      return {
        v: whole_lines.join('')
      };
    };

    for (var i = 0; i <= whole_lines.length - num_part_lines; i++) {
      var _ret = _loop(i);

      switch (_ret) {
        case "continue":
          continue;

        default:
          if (_typeof(_ret) === "object") return _ret.v;
      }
    }

    return null;
  },
  // the function checks if whole_lines and part_lines match when leading whitespace is ignored 
  // and ensures that the leading whitespace is uniform across all lines. 
  // If both conditions are met, it returns the common leading whitespace.
  match_but_for_leading_whitespace: function match_but_for_leading_whitespace(whole_lines, part_lines) {
    var num = whole_lines.length; // does the non-whitespace all agree?

    var strippedWholeLines = whole_lines.map(function (line) {
      return line.replace(/^\s*/, '');
    });
    var strippedPartLines = part_lines.map(function (line) {
      return line.replace(/^\s*/, '');
    });

    if (!strippedWholeLines.every(function (element, index) {
      return element === strippedPartLines[index];
    })) {
      return null;
    } // are they all offset the same?


    var offsets = whole_lines.reduce(function (acc, line, index) {
      if (line.trim()) {
        var offset = line.length - strippedWholeLines[index].length;
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
  replace_closest_edit_distance: function replace_closest_edit_distance(whole_lines, part, part_lines, replace_lines) {
    var similarity_thresh = 0.8;
    var max_similarity = 0;
    var most_similar_chunk_start = -1;
    var most_similar_chunk_end = -1;
    var scale = 0.1;
    var min_len = Math.floor(part_lines.length * (1 - scale));
    var max_len = Math.ceil(part_lines.length * (1 + scale));

    for (var length = min_len; length < max_len; length++) {
      for (var i = 0; i < whole_lines.length - length + 1; i++) {
        var chunk = whole_lines.slice(i, i + length).join("");
        var similarity = stringSimilarity.compareTwoStrings(chunk, part);

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

    var modified_whole = [].concat(_toConsumableArray(whole_lines.slice(0, most_similar_chunk_start)), _toConsumableArray(replace_lines), _toConsumableArray(whole_lines.slice(most_similar_chunk_end)));
    modified_whole = modified_whole.join("");
    return modified_whole;
  },
  do_replace: function do_replace(fname, content, before_text, after_text) {
    var fence = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
    before_text = codeEdit.strip_quoted_wrapping(before_text, fname, fence);
    after_text = codeEdit.strip_quoted_wrapping(after_text, fname, fence);
    fname = path.resolve(fname); // does it want to make a new file?

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
  strip_quoted_wrapping: function strip_quoted_wrapping(res) {
    var fname = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var fence = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : DEFAULT_FENCE;

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
};
module.exports = {
  codeEdit: codeEdit
};