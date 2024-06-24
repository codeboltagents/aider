"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _construct(Parent, args, Class) { if (isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var stringSimilarity = require('string-similarity');

var fs = require('fs');

var path = require('path');

var DEFAULT_FENCE = ['```', '```'];
var HEAD = '<<<<<<< SEARCH';
var DIVIDER = '=======';
var UPDATED = '>>>>>>> REPLACE';

var missing_filename_err = function missing_filename_err(fence) {
  return "Bad/missing filename. The filename must be alone on the line before the opening fence ".concat(fence[0]);
}; // const missing_filename_err = "Bad/missing filename. The filename must be alone on the line before the opening fence {fence[0]}";


var separators = [HEAD, DIVIDER, UPDATED].join('|');
var split_re = new RegExp("^((?:".concat(separators, ")[ ]*\n)"), 'm');

var ValueError =
/*#__PURE__*/
function (_Error) {
  _inherits(ValueError, _Error);

  function ValueError(message) {
    var _this;

    _classCallCheck(this, ValueError);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(ValueError).call(this, message));
    _this.name = 'ValueError';
    return _this;
  }

  return ValueError;
}(_wrapNativeSuper(Error));

var IndexError =
/*#__PURE__*/
function (_Error2) {
  _inherits(IndexError, _Error2);

  function IndexError(message) {
    var _this2;

    _classCallCheck(this, IndexError);

    _this2 = _possibleConstructorReturn(this, _getPrototypeOf(IndexError).call(this, message));
    _this2.name = 'IndexError';
    return _this2;
  }

  return IndexError;
}(_wrapNativeSuper(Error));

var codeEdit = {
  safe_abs_path: function safe_abs_path(res) {
    // Gives an abs path, which safely returns a full (not 8.3) windows path
    res = path.resolve(res);
    return res;
  },
  // this is used to split the content to lines
  split_to_lines: function split_to_lines(content) {
    if (content && !content.endsWith("\n")) {
      content += "\n";
    }

    var lines = content.split(/\n/).map(function (line, index, array) {
      return index < array.length - 1 ? line + "\n" : line;
    });

    if (lines[lines.length - 1] === "") {
      lines.pop();
    }

    return [content, lines]; // let lines = content.split(/\r?\n/);
    // lines = lines.map((line, index) => index < lines.length - 1 ? line + "\n" : line);
    // return [content, lines];
  },
  strip_filename: function strip_filename(filename, fence) {
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
  find_filename: function find_filename(lines, fence) {
    // Reverse the lines and take the first 3
    lines.reverse();
    lines = lines.slice(0, 3);
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = lines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var line = _step.value;
        // If we find a filename, done
        var filename = codeEdit.strip_filename(line, fence);

        if (filename && filename !== '') {
          return filename;
        } // Only continue as long as we keep seeing fences


        if (!line.startsWith(fence[0]) && filename !== '') {
          return;
        }
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
  },
  find_original_update_blocks: function find_original_update_blocks(content) {
    var fence = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_FENCE;

    if (!content.endsWith('\n')) {
      content += '\n';
    }

    var pieces = content.split(split_re).reverse();
    var processed = [];
    var currentFilename = null;
    var results = [];

    try {
      while (pieces.length) {
        var cur = pieces.pop();

        if (cur === DIVIDER || cur === UPDATED) {
          processed.push(cur);
          throw new Error("Unexpected ".concat(cur));
        }

        if (cur.trim() !== HEAD) {
          processed.push(cur);
          continue;
        }

        processed.push(cur);
        var filename = codeEdit.find_filename(processed[processed.length - 2].split('\n'), fence);

        if (!filename) {
          if (currentFilename) {
            filename = currentFilename;
          } else {
            throw new ValueError(missing_filename_err(fence));
          }
        } // let filename = codeEdit.strip_filename(processed[processed.length - 2].split('\n').pop(), fence);
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
        var originalText = pieces.pop();
        processed.push(originalText);
        var dividerMarker = pieces.pop();
        processed.push(dividerMarker);

        if (dividerMarker.trim() !== DIVIDER) {
          throw new ValueError("Expected `".concat(DIVIDER, "` not ").concat(dividerMarker.trim()));
        }

        var updatedText = pieces.pop();
        processed.push(updatedText);
        var updatedMarker = pieces.pop();
        processed.push(updatedMarker);

        if (updatedMarker.trim() !== UPDATED) {
          throw new ValueError("Expected `".concat(UPDATED, "` not `").concat(updatedMarker.trim(), "`"));
        }

        results.push([filename, originalText, updatedText]);
      }
    } catch (e) {
      console.log(e.name);
      processed = processed.join('');

      if (e instanceof ValueError) {
        var err = e.message;
        throw new Error("".concat(processed, "\n^^^ ").concat(err));
      } else if (e instanceof IndexError) {
        throw new Error("".concat(processed, "\n^^^ Incomplete SEARCH/REPLACE block."));
      } else {
        throw new Error("".concat(processed, "\n^^^ Incomplete Error parsing SEARCH/REPLACE block."));
      }
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
    var dots_re = new RegExp("(^\\s*\\.\\.\\.\\n)", "gm");
    var part_pieces = part.split(dots_re);
    var replace_pieces = replace.split(dots_re);

    if (part_pieces.length !== replace_pieces.length) {
      throw new Error("Unpaired ... in SEARCH/REPLACE block");
    }

    if (part_pieces.length === 1) {
      // no dots in this edit block, just return None
      return;
    } // Compare odd strings in part_pieces and replace_pieces


    var all_dots_match = part_pieces.every(function (part_piece, i) {
      return i % 2 !== 0 ? part_piece === replace_pieces[i] : true;
    });

    if (!all_dots_match) {
      throw new Error("Unmatched ... in SEARCH/REPLACE block");
    }

    part_pieces = part_pieces.filter(function (_, i) {
      return i % 2 === 0;
    });
    replace_pieces = replace_pieces.filter(function (_, i) {
      return i % 2 === 0;
    });
    var pairs = part_pieces.map(function (part_piece, i) {
      return [part_piece, replace_pieces[i]];
    });
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = pairs[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var _step2$value = _slicedToArray(_step2.value, 2),
            _part = _step2$value[0],
            _replace = _step2$value[1];

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

        if (!whole.includes(_part)) {
          throw new Error();
        }

        if ((whole.match(new RegExp(_part, "g")) || []).length > 1) {
          throw new Error();
        }

        whole = whole.replace(_part, _replace);
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
          _iterator2["return"]();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
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

      if (add_leading === null || add_leading == undefined) {
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
    var num = whole_lines.length; // Does the non-whitespace all agree?

    for (var i = 0; i < num; i++) {
      if (whole_lines[i].trimStart() !== part_lines[i].trimStart()) {
        return;
      }
    } // Are they all offset the same?


    var add = new Set();

    for (var _i2 = 0; _i2 < num; _i2++) {
      if (whole_lines[_i2].trim()) {
        add.add(whole_lines[_i2].slice(0, whole_lines[_i2].length - part_lines[_i2].length));
      }
    }

    if (add.size !== 1) {
      return;
    }

    return add.values().next().value;
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
module.exports = codeEdit;