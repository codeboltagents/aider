"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var difflib = require('difflib');

var fs = require("fs"); // const groupby = require('itertools').groupby;


var path = require('path');

var codebolt = require('@codebolt/codeboltjs')["default"];

var Coder = require('./base_coder');

var SearchReplace = require('./../utils/search_replace');

var UnifiedDiffPrompts = require('./udiff_prompts');

var no_match_error = "UnifiedDiffNoMatch: hunk failed to apply!\n\n{path} does not contain lines that match the diff you provided!\nTry again.\nDO NOT skip blank lines, comments, docstrings, etc!\nThe diff needs to apply cleanly to the lines in {path}!\n\n{path} does not contain these {num_lines} exact lines in a row:\n```\n{original}```\n";
var not_unique_error = "UnifiedDiffNotUnique: hunk failed to apply!\n\n{path} contains multiple sets of lines that match the diff you provided!\nTry again.\nUse additional ` ` lines to provide context that uniquely indicates which code needs to be changed.\nThe diff needs to apply to a unique set of lines in {path}!\n\n{path} contains multiple copies of these {num_lines} lines:\n```\n{original}```\n";
var other_hunks_applied = "Note: some hunks did apply successfully. See the updated source code shown above.\n\n";

var UnifiedDiffCoder =
/*#__PURE__*/
function (_Coder) {
  _inherits(UnifiedDiffCoder, _Coder);

  function UnifiedDiffCoder() {
    var _getPrototypeOf2;

    var _this;

    _classCallCheck(this, UnifiedDiffCoder);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _possibleConstructorReturn(this, (_getPrototypeOf2 = _getPrototypeOf(UnifiedDiffCoder)).call.apply(_getPrototypeOf2, [this].concat(args)));
    _this.edit_format = "udiff";
    _this.gpt_prompts = new UnifiedDiffPrompts();
    return _this;
  }

  _createClass(UnifiedDiffCoder, [{
    key: "get_edits",
    value: function get_edits() {
      var content = this.partial_response_content; // might raise ValueError for malformed ORIG/UPD blocks

      var raw_edits = Array.from(find_diffs(content));
      var last_path = null;
      var edits = [];

      for (var _i = 0, _raw_edits = raw_edits; _i < _raw_edits.length; _i++) {
        var _raw_edits$_i = _slicedToArray(_raw_edits[_i], 2),
            _path = _raw_edits$_i[0],
            hunk = _raw_edits$_i[1];

        if (_path) {
          last_path = _path;
        } else {
          _path = last_path;
        }

        edits.push([_path, hunk]);
      }

      return edits;
    }
  }, {
    key: "apply_edits",
    value: function apply_edits(edits) {
      var seen, uniq, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _step$value, _path2, hunk, this_, errors, _i2, _uniq, _uniq$_i, _path3, _hunk, full_path, _ref, content, _hunk_to_before_after, _hunk_to_before_after2, original, _, errors_str;

      return regeneratorRuntime.async(function apply_edits$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              seen = new Set();
              uniq = [];
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context.prev = 5;
              _iterator = edits[Symbol.iterator]();

            case 7:
              if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                _context.next = 21;
                break;
              }

              _step$value = _slicedToArray(_step.value, 2), _path2 = _step$value[0], hunk = _step$value[1];
              hunk = normalize_hunk(hunk);

              if (hunk) {
                _context.next = 12;
                break;
              }

              return _context.abrupt("continue", 18);

            case 12:
              this_ = [_path2 + "\n"].concat(hunk);
              this_ = this_.join("");

              if (!seen.has(this_)) {
                _context.next = 16;
                break;
              }

              return _context.abrupt("continue", 18);

            case 16:
              seen.add(this_);
              uniq.push([_path2, hunk]);

            case 18:
              _iteratorNormalCompletion = true;
              _context.next = 7;
              break;

            case 21:
              _context.next = 27;
              break;

            case 23:
              _context.prev = 23;
              _context.t0 = _context["catch"](5);
              _didIteratorError = true;
              _iteratorError = _context.t0;

            case 27:
              _context.prev = 27;
              _context.prev = 28;

              if (!_iteratorNormalCompletion && _iterator["return"] != null) {
                _iterator["return"]();
              }

            case 30:
              _context.prev = 30;

              if (!_didIteratorError) {
                _context.next = 33;
                break;
              }

              throw _iteratorError;

            case 33:
              return _context.finish(30);

            case 34:
              return _context.finish(27);

            case 35:
              errors = [];
              _i2 = 0, _uniq = uniq;

            case 37:
              if (!(_i2 < _uniq.length)) {
                _context.next = 62;
                break;
              }

              _uniq$_i = _slicedToArray(_uniq[_i2], 2), _path3 = _uniq$_i[0], _hunk = _uniq$_i[1];
              full_path = this.abs_root_path(_path3);
              _context.next = 42;
              return regeneratorRuntime.awrap(codebolt.fs.readFile(full_path));

            case 42:
              _ref = _context.sent;
              content = _ref.content;
              // this.io.read_text(full_path);
              _hunk_to_before_after = hunk_to_before_after(_hunk), _hunk_to_before_after2 = _slicedToArray(_hunk_to_before_after, 2), original = _hunk_to_before_after2[0], _ = _hunk_to_before_after2[1];
              _context.prev = 45;
              content = do_replace(full_path, content, _hunk);
              _context.next = 55;
              break;

            case 49:
              _context.prev = 49;
              _context.t1 = _context["catch"](45);

              if (!(_context.t1 instanceof SearchReplace.SearchTextNotUnique)) {
                _context.next = 54;
                break;
              }

              errors.push(not_unique_error.format({
                path: _path3,
                original: original,
                num_lines: original.split('\n').length
              }));
              return _context.abrupt("continue", 59);

            case 54:
              throw _context.t1;

            case 55:
              if (content) {
                _context.next = 58;
                break;
              }

              errors.push(no_match_error.format({
                path: _path3,
                original: original,
                num_lines: original.split('\n').length
              }));
              return _context.abrupt("continue", 59);

            case 58:
              // SUCCESS!
              codebolt.fs.createFile(full_path, content); // this.io.write_text(full_path, content);

            case 59:
              _i2++;
              _context.next = 37;
              break;

            case 62:
              if (!(errors.length > 0)) {
                _context.next = 66;
                break;
              }

              errors_str = errors.join("\n\n");

              if (errors.length < uniq.length) {
                errors_str += other_hunks_applied;
              }

              throw new Error(errors_str);

            case 66:
            case "end":
              return _context.stop();
          }
        }
      }, null, this, [[5, 23, 27, 35], [28,, 30, 34], [45, 49]]);
    }
  }]);

  return UnifiedDiffCoder;
}(Coder);

function do_replace(fname, content, hunk) {
  fname = path.resolve(fname);

  var _hunk_to_before_after3 = hunk_to_before_after(hunk),
      _hunk_to_before_after4 = _slicedToArray(_hunk_to_before_after3, 2),
      before_text = _hunk_to_before_after4[0],
      after_text = _hunk_to_before_after4[1]; // does it want to make a new file?


  if (!fs.existsSync(fname) && !before_text.trim()) {
    fs.writeFileSync(fname, '');
    content = "";
  }

  if (content === null) {
    return;
  } // TODO: handle inserting into new file


  if (!before_text.trim()) {
    // append to existing file, or start a new file
    var _new_content = content + after_text;

    return _new_content;
  }

  var new_content = null;
  new_content = apply_hunk(content, hunk);

  if (new_content) {
    return new_content;
  }
}

function collapse_repeats(s) {
  return Array.from(new Set(s.split(''))).join('');
}

function apply_hunk(content, hunk) {
  var _hunk_to_before_after5 = hunk_to_before_after(hunk),
      _hunk_to_before_after6 = _slicedToArray(_hunk_to_before_after5, 2),
      before_text = _hunk_to_before_after6[0],
      after_text = _hunk_to_before_after6[1];

  var res = directly_apply_hunk(content, hunk);

  if (res) {
    return res;
  }

  hunk = make_new_lines_explicit(content, hunk); // just consider space vs not-space

  var ops = hunk.map(function (line) {
    return line[0];
  }).join('');
  ops = ops.replace("-", "x");
  ops = ops.replace("+", "x");
  ops = ops.replace("\n", " ");
  var cur_op = " ";
  var section = [];
  var sections = [];

  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];

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

  var all_done = true;

  for (var _i3 = 2; _i3 < sections.length; _i3 += 2) {
    var preceding_context = sections[_i3 - 2];
    var changes = sections[_i3 - 1];
    var following_context = sections[_i3];

    var _res = apply_partial_hunk(content, preceding_context, changes, following_context);

    if (_res) {
      content = _res;
    } else {
      all_done = false; // FAILED!
      // this_hunk = preceding_context + changes + following_context

      break;
    }
  }

  if (all_done) {
    return content;
  }
}

function flexi_just_search_and_replace(texts) {
  var strategies = [[search_and_replace, all_preprocs]];
  return flexible_search_and_replace(texts, strategies);
}

function make_new_lines_explicit(content, hunk) {
  var _hunk_to_before_after7 = hunk_to_before_after(hunk),
      _hunk_to_before_after8 = _slicedToArray(_hunk_to_before_after7, 2),
      before = _hunk_to_before_after8[0],
      after = _hunk_to_before_after8[1];

  var diff = diff_lines(before, content);
  var back_diff = [];
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = diff[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var line = _step2.value;

      if (line[0] === "+") {
        continue;
      }

      back_diff.push(line);
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

  var new_before = directly_apply_hunk(before, back_diff);

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

  var new_hunk = difflib.unifiedDiff(new_before, after, {
    n: Math.max(new_before.length, after.length)
  });
  new_hunk = new_hunk.slice(3);
  return new_hunk;
}

function cleanup_pure_whitespace_lines(lines) {
  return lines.map(function (line) {
    return line.trim() ? line : line.slice(-(line.length - line.trimRight().length));
  });
}

function normalize_hunk(hunk) {
  var _hunk_to_before_after9 = hunk_to_before_after(hunk, true),
      _hunk_to_before_after10 = _slicedToArray(_hunk_to_before_after9, 2),
      before = _hunk_to_before_after10[0],
      after = _hunk_to_before_after10[1];

  before = cleanup_pure_whitespace_lines(before);
  after = cleanup_pure_whitespace_lines(after);
  var diff = difflib.unifiedDiff(before, after, {
    n: Math.max(before.length, after.length)
  });
  diff = diff.slice(3);
  return diff;
}

function directly_apply_hunk(content, hunk) {
  var _hunk_to_before_after11 = hunk_to_before_after(hunk),
      _hunk_to_before_after12 = _slicedToArray(_hunk_to_before_after11, 2),
      before = _hunk_to_before_after12[0],
      after = _hunk_to_before_after12[1];

  if (!before) {
    return;
  }

  var _hunk_to_before_after13 = hunk_to_before_after(hunk, true),
      _hunk_to_before_after14 = _slicedToArray(_hunk_to_before_after13, 2),
      before_lines = _hunk_to_before_after14[0],
      _ = _hunk_to_before_after14[1];

  before_lines = before_lines.map(function (line) {
    return line.trim();
  }).join(''); // Refuse to do a repeated search and replace on a tiny bit of non-whitespace context

  if (before_lines.length < 10 && content.split(before).length > 1) {
    return;
  }

  try {
    var _new_content2 = flexi_just_search_and_replace([before, after, content]);
  } catch (err) {
    if (err instanceof SearchTextNotUnique) {
      var _new_content3 = null;
    }
  }

  return new_content;
}

function apply_partial_hunk(content, preceding_context, changes, following_context) {
  var len_prec = preceding_context.length;
  var len_foll = following_context.length;
  var use_all = len_prec + len_foll; // if there is a - in the hunk, we can go all the way to `use=0`

  for (var drop = 0; drop <= use_all; drop++) {
    var use = use_all - drop;

    for (var use_prec = len_prec; use_prec >= 0; use_prec--) {
      if (use_prec > use) {
        continue;
      }

      var use_foll = use - use_prec;

      if (use_foll > len_foll) {
        continue;
      }

      var this_prec = use_prec ? preceding_context.slice(-use_prec) : [];
      var this_foll = following_context.slice(0, use_foll);
      var res = directly_apply_hunk(content, this_prec.concat(changes, this_foll));

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

  var lines = content.split(/\r?\n/).map(function (line, index, array) {
    return index < array.length - 1 ? line.trim() + '\n' : line;
  });
  var line_num = 0;
  var edits = [];

  while (line_num < lines.length) {
    while (line_num < lines.length) {
      var line = lines[line_num];

      if (line.startsWith("```diff")) {
        var _process_fenced_block = process_fenced_block(lines, line_num + 1),
            _process_fenced_block2 = _slicedToArray(_process_fenced_block, 2),
            new_line_num = _process_fenced_block2[0],
            these_edits = _process_fenced_block2[1];

        line_num = new_line_num;
        edits = edits.concat(these_edits);
        break;
      }

      line_num++;
    }
  } // For now, just take 1!
  // edits = edits.slice(0, 1);


  return edits;
}

function process_fenced_block(lines, start_line_num) {
  var line_num;

  for (line_num = start_line_num; line_num < lines.length; line_num++) {
    var line = lines[line_num];

    if (line.startsWith("```")) {
      break;
    }
  }

  var block = lines.slice(start_line_num, line_num);
  block.push("@@ @@");
  var fname;

  if (block[0].startsWith("--- ") && block[1].startsWith("+++ ")) {
    // Extract the file path, considering that it might contain spaces
    fname = block[1].slice(4).trim();
    block = block.slice(2);
  } else {
    fname = null;
  }

  var edits = [];
  var keeper = false;
  var hunk = [];
  var op = " ";
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = block[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var _line = _step3.value;
      hunk.push(_line);

      if (_line.length < 2) {
        continue;
      }

      if (_line.startsWith("+++ ") && hunk[hunk.length - 2].startsWith("--- ")) {
        if (hunk[hunk.length - 3] === "\n") {
          hunk = hunk.slice(0, -3);
        } else {
          hunk = hunk.slice(0, -2);
        }

        edits.push([fname, hunk]);
        hunk = [];
        keeper = false;
        fname = _line.slice(4).trim();
        continue;
      }

      op = _line[0];

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
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3["return"] != null) {
        _iterator3["return"]();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  return [line_num + 1, edits];
}

function hunk_to_before_after(hunk) {
  var lines = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var before = [];
  var after = [];
  var op = " ";
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = hunk[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var line = _step4.value;

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
  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4["return"] != null) {
        _iterator4["return"]();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }

  if (lines) {
    return [before, after];
  }

  before = before.join('');
  after = after.join('');
  return [before, after];
}

module.exports = UnifiedDiffCoder;