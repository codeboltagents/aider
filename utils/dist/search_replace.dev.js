#!/usr/bin/env node
"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _construct(Parent, args, Class) { if (isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var fs = require('fs');

var path = require('path');

var simpleGit = require('simple-git');

var _require = require('diff-match-patch'),
    diff_match_patch = _require.diff_match_patch;

var yargs = require('yargs');

var os = require('os');

var RelativeIndenter =
/*#__PURE__*/
function () {
  function RelativeIndenter(texts) {
    _classCallCheck(this, RelativeIndenter);

    var chars = new Set();
    texts.forEach(function (text) {
      _toConsumableArray(text).forEach(function (_char) {
        return chars.add(_char);
      });
    });
    var ARROW = '←';
    this.marker = chars.has(ARROW) ? this.select_unique_marker(chars) : ARROW;
  }

  _createClass(RelativeIndenter, [{
    key: "select_unique_marker",
    value: function select_unique_marker(chars) {
      for (var codepoint = 0x10FFFF; codepoint >= 0x10000; codepoint--) {
        var marker = String.fromCodePoint(codepoint);

        if (!chars.has(marker)) {
          return marker;
        }
      }

      throw new Error("Could not find a unique marker");
    }
  }, {
    key: "make_relative",
    value: function make_relative(text) {
      var _this = this;

      if (text.includes(this.marker)) {
        throw new Error("Text already contains the outdent marker: ".concat(this.marker));
      }

      var lines = text.split(/\r?\n/);
      var output = [];
      var prev_indent = "";
      lines.forEach(function (line) {
        var line_without_end = line.trimEnd();
        var len_indent = line_without_end.length - line_without_end.trimStart().length;
        var indent = line.slice(0, len_indent);
        var change = len_indent - prev_indent.length;
        var cur_indent;

        if (change > 0) {
          cur_indent = indent.slice(-change);
        } else if (change < 0) {
          cur_indent = _this.marker.repeat(-change);
        } else {
          cur_indent = "";
        }

        output.push(cur_indent + "\n" + line.slice(len_indent));
        prev_indent = indent;
      });
      return output.join('');
    }
  }, {
    key: "make_absolute",
    value: function make_absolute(text) {
      var lines = text.split(/\r?\n/);
      var output = [];
      var prev_indent = "";

      for (var i = 0; i < lines.length; i += 2) {
        var dent = lines[i].trimEnd();
        var non_indent = lines[i + 1];
        var cur_indent = void 0;

        if (dent.startsWith(this.marker)) {
          var len_outdent = dent.length;
          cur_indent = prev_indent.slice(0, -len_outdent);
        } else {
          cur_indent = prev_indent + dent;
        }

        if (!non_indent.trim()) {
          output.push(non_indent); // don't indent a blank line
        } else {
          output.push(cur_indent + non_indent);
        }

        prev_indent = cur_indent;
      }

      var res = output.join('');

      if (res.includes(this.marker)) {
        throw new Error("Error transforming text back to absolute indents");
      }

      return res;
    }
  }]);

  return RelativeIndenter;
}();

function map_patches(texts, patches, debug) {
  var _texts = _slicedToArray(texts, 3),
      search_text = _texts[0],
      replace_text = _texts[1],
      original_text = _texts[2];

  var dmp = new diff_match_patch();
  dmp.Diff_Timeout = 5;
  var diff_so = dmp.diff_main(search_text, original_text);

  if (debug) {
    var html = dmp.diff_prettyHtml(diff_so);
    fs.writeFileSync("tmp.html", html);
    console.log(search_text.length);
    console.log(original_text.length);
  }

  patches.forEach(function (patch) {
    var start1 = patch.start1;
    var start2 = patch.start2;
    patch.start1 = dmp.diff_xIndex(diff_so, start1);
    patch.start2 = dmp.diff_xIndex(diff_so, start2);

    if (debug) {
      console.log();
      console.log(start1, JSON.stringify(search_text.slice(start1, start1 + 50)));
      console.log(patch.start1, JSON.stringify(original_text.slice(patch.start1, patch.start1 + 50)));
      console.log(patch.diffs);
      console.log();
    }
  });
  return patches;
}

function relative_indent(texts) {
  var ri = new RelativeIndenter(texts);
  texts = texts.map(function (text) {
    return ri.make_relative(text);
  });
  return [ri, texts];
}

var line_padding = 100;

function line_pad(text) {
  var padding = "\n".repeat(line_padding);
  return padding + text + padding;
}

function line_unpad(text) {
  if (new Set(text.slice(0, line_padding) + text.slice(-line_padding)).size !== 1) {
    return;
  }

  return text.slice(line_padding, -line_padding);
}

function dmp_apply(texts) {
  var remap = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var debug = false;

  var _texts2 = _slicedToArray(texts, 3),
      search_text = _texts2[0],
      replace_text = _texts2[1],
      original_text = _texts2[2];

  var dmp = new diff_match_patch();
  dmp.Diff_Timeout = 5;

  if (remap) {
    dmp.Match_Threshold = 0.95;
    dmp.Match_Distance = 500;
    dmp.Match_MaxBits = 128;
    dmp.Patch_Margin = 32;
  } else {
    dmp.Match_Threshold = 0.5;
    dmp.Match_Distance = 100000;
    dmp.Match_MaxBits = 32;
    dmp.Patch_Margin = 8;
  }

  var diff = dmp.diff_main(search_text, replace_text, null);
  dmp.diff_cleanupSemantic(diff);
  dmp.diff_cleanupEfficiency(diff);
  var patches = dmp.patch_make(search_text, diff);

  if (debug) {
    var html = dmp.diff_prettyHtml(diff);
    fs.writeFileSync("tmp.search_replace_diff.html", html);
    diff.forEach(function (d) {
      return console.log(d[0], JSON.stringify(d[1]));
    });
    patches.forEach(function (patch) {
      var start1 = patch.start1;
      console.log();
      console.log(start1, JSON.stringify(search_text.slice(start1, start1 + 10)));
      console.log(start1, JSON.stringify(replace_text.slice(start1, start1 + 10)));
      console.log(patch.diffs);
    });
    console.log(original_text);
    console.log(search_text);
  }

  if (remap) {
    patches = map_patches(texts, patches, debug);
  }

  var patches_text = dmp.patch_toText(patches);

  var _dmp$patch_apply = dmp.patch_apply(patches, original_text),
      _dmp$patch_apply2 = _slicedToArray(_dmp$patch_apply, 2),
      new_text = _dmp$patch_apply2[0],
      success = _dmp$patch_apply2[1];

  var all_success = success.every(function (s) {
    return s;
  });

  if (debug) {
    console.log(new_text);
    console.log(success);
    console.log(all_success);
  }

  if (!all_success) {
    return;
  }

  return new_text;
}

function lines_to_chars(lines, mapping) {
  return lines.map(function (_char2) {
    return mapping[_char2.charCodeAt(0)];
  }).join('');
}

function dmp_lines_apply(texts) {
  var remap = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var debug = false;
  texts.forEach(function (t) {
    if (!t.endsWith("\n")) {
      throw new Error(t);
    }
  });

  var _texts3 = _slicedToArray(texts, 3),
      search_text = _texts3[0],
      replace_text = _texts3[1],
      original_text = _texts3[2];

  var dmp = new diff_match_patch();
  dmp.Diff_Timeout = 5;
  dmp.Match_Threshold = 0.1;
  dmp.Match_Distance = 100000;
  dmp.Match_MaxBits = 32;
  dmp.Patch_Margin = 1;
  var all_text = search_text + replace_text + original_text;

  var _dmp$diff_linesToChar = dmp.diff_linesToChars(all_text, ""),
      _dmp$diff_linesToChar2 = _slicedToArray(_dmp$diff_linesToChar, 3),
      all_lines = _dmp$diff_linesToChar2[0],
      _ = _dmp$diff_linesToChar2[1],
      mapping = _dmp$diff_linesToChar2[2];

  if (all_lines.length !== all_text.split(/\r?\n/).length) {
    throw new Error("Mismatch in lines length");
  }

  var search_num = search_text.split(/\r?\n/).length;
  var replace_num = replace_text.split(/\r?\n/).length;
  var original_num = original_text.split(/\r?\n/).length;
  var search_lines = all_lines.slice(0, search_num);
  var replace_lines = all_lines.slice(search_num, search_num + replace_num);
  var original_lines = all_lines.slice(search_num + replace_num);

  if (search_lines.length !== search_num || replace_lines.length !== replace_num || original_lines.length !== original_num) {
    throw new Error("Mismatch in lines length");
  }

  var diff_lines = dmp.diff_main(search_lines, replace_lines, null);
  dmp.diff_cleanupSemantic(diff_lines);
  dmp.diff_cleanupEfficiency(diff_lines);
  var patches = dmp.patch_make(search_lines, diff_lines);

  if (debug) {
    var diff = Array.from(diff_lines);
    dmp.diff_charsToLines(diff, mapping);
    var html = dmp.diff_prettyHtml(diff);
    fs.writeFileSync("tmp.search_replace_diff.html", html);
    diff.forEach(function (d) {
      return console.log(d[0], JSON.stringify(d[1]));
    });
  }

  var _dmp$patch_apply3 = dmp.patch_apply(patches, original_lines),
      _dmp$patch_apply4 = _slicedToArray(_dmp$patch_apply3, 2),
      new_lines = _dmp$patch_apply4[0],
      success = _dmp$patch_apply4[1];

  var new_text = lines_to_chars(new_lines, mapping);
  var all_success = success.every(function (s) {
    return s;
  });

  if (debug) {
    console.log(new_text);
    console.log(success);
    console.log(all_success);
  }

  if (!all_success) {
    return;
  }

  return new_text;
}

function diff_lines(search_text, replace_text) {
  var dmp = new diff_match_patch();
  dmp.Diff_Timeout = 5;

  var _dmp$diff_linesToChar3 = dmp.diff_linesToChars(search_text, replace_text),
      _dmp$diff_linesToChar4 = _slicedToArray(_dmp$diff_linesToChar3, 2),
      search_lines = _dmp$diff_linesToChar4[0],
      replace_lines = _dmp$diff_linesToChar4[1];

  var diff_lines = dmp.diff_main(search_lines, replace_lines, null);
  dmp.diff_cleanupSemantic(diff_lines);
  dmp.diff_cleanupEfficiency(diff_lines);
  return dmp.diff_charsToLines(diff_lines, search_text.split(/\r?\n/));
}

function main() {
  var argv, repository, filename, branch, git, tmp, repoGit, originalPath, originalText, search_text, replace_text, _relative_indent, _relative_indent2, new_text, final_text;

  return regeneratorRuntime.async(function main$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          argv = yargs(process.argv.slice(2)).option('repository', {
            alias: 'r',
            describe: 'Path to the repository',
            type: 'string',
            demandOption: true
          }).option('filename', {
            alias: 'f',
            describe: 'Path to the file',
            type: 'string',
            demandOption: true
          }).option('branch', {
            alias: 'b',
            describe: 'Branch to operate on',
            type: 'string',
            demandOption: true
          }).argv;
          repository = path.resolve(argv.repository);
          filename = argv.filename;
          branch = argv.branch;
          git = simpleGit();
          tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'repo-'));
          _context.next = 8;
          return regeneratorRuntime.awrap(git.clone(repository, tmp));

        case 8:
          repoGit = simpleGit(tmp);
          _context.next = 11;
          return regeneratorRuntime.awrap(repoGit.checkout(branch));

        case 11:
          originalPath = path.join(tmp, filename);
          originalText = fs.readFileSync(originalPath, 'utf8');
          search_text = ""; // Implement the logic to get search_text

          replace_text = ""; // Implement the logic to get replace_text

          _relative_indent = relative_indent([search_text, replace_text, originalText]);
          _relative_indent2 = _slicedToArray(_relative_indent, 3);
          search_text = _relative_indent2[0];
          replace_text = _relative_indent2[1];
          original_text = _relative_indent2[2];
          new_text = dmp_lines_apply([search_text, replace_text, originalText], true);
          final_text = line_unpad(new_text);

          if (!final_text) {
            _context.next = 32;
            break;
          }

          fs.writeFileSync(originalPath, final_text);
          _context.next = 26;
          return regeneratorRuntime.awrap(repoGit.add(filename));

        case 26:
          _context.next = 28;
          return regeneratorRuntime.awrap(repoGit.commit('Apply patch'));

        case 28:
          _context.next = 30;
          return regeneratorRuntime.awrap(repoGit.push('origin', branch));

        case 30:
          _context.next = 33;
          break;

        case 32:
          console.log("Failed to apply patch");

        case 33:
        case "end":
          return _context.stop();
      }
    }
  });
}

function search_and_replace(texts) {
  var _texts4 = _slicedToArray(texts, 3),
      search_text = _texts4[0],
      replace_text = _texts4[1],
      original_text = _texts4[2];

  var num = (original_text.match(new RegExp(search_text, 'g')) || []).length;

  if (num === 0) {
    return;
  }

  var new_text = original_text.replace(new RegExp(search_text, 'g'), replace_text);
  return new_text;
}

function git_cherry_pick_osr_onto_o(texts) {
  var _texts5, search_text, replace_text, original_text, dname, repo, fname, original_hash, replace_hash, new_text;

  return regeneratorRuntime.async(function git_cherry_pick_osr_onto_o$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _texts5 = _slicedToArray(texts, 3), search_text = _texts5[0], replace_text = _texts5[1], original_text = _texts5[2];
          dname = fs.mkdtempSync(path.join(os.tmpdir(), 'git-'));
          repo = simpleGit(dname);
          fname = path.join(dname, 'file.txt');
          fs.writeFileSync(fname, original_text);
          _context2.next = 7;
          return regeneratorRuntime.awrap(repo.init());

        case 7:
          _context2.next = 9;
          return regeneratorRuntime.awrap(repo.add(fname));

        case 9:
          _context2.next = 11;
          return regeneratorRuntime.awrap(repo.commit('original'));

        case 11:
          _context2.next = 13;
          return regeneratorRuntime.awrap(repo.log());

        case 13:
          original_hash = _context2.sent.latest.hash;
          fs.writeFileSync(fname, search_text);
          _context2.next = 17;
          return regeneratorRuntime.awrap(repo.add(fname));

        case 17:
          _context2.next = 19;
          return regeneratorRuntime.awrap(repo.commit('search'));

        case 19:
          fs.writeFileSync(fname, replace_text);
          _context2.next = 22;
          return regeneratorRuntime.awrap(repo.add(fname));

        case 22:
          _context2.next = 24;
          return regeneratorRuntime.awrap(repo.commit('replace'));

        case 24:
          _context2.next = 26;
          return regeneratorRuntime.awrap(repo.log());

        case 26:
          replace_hash = _context2.sent.latest.hash;
          _context2.next = 29;
          return regeneratorRuntime.awrap(repo.checkout(original_hash));

        case 29:
          _context2.prev = 29;
          _context2.next = 32;
          return regeneratorRuntime.awrap(repo.raw(['cherry-pick', replace_hash, '--minimal']));

        case 32:
          _context2.next = 37;
          break;

        case 34:
          _context2.prev = 34;
          _context2.t0 = _context2["catch"](29);
          return _context2.abrupt("return");

        case 37:
          new_text = fs.readFileSync(fname, 'utf8');
          return _context2.abrupt("return", new_text);

        case 39:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[29, 34]]);
}

function git_cherry_pick_sr_onto_so(texts) {
  var _texts6, search_text, replace_text, original_text, dname, repo, fname, search_hash, replace_hash, new_text;

  return regeneratorRuntime.async(function git_cherry_pick_sr_onto_so$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _texts6 = _slicedToArray(texts, 3), search_text = _texts6[0], replace_text = _texts6[1], original_text = _texts6[2];
          dname = fs.mkdtempSync(path.join(os.tmpdir(), 'git-'));
          repo = simpleGit(dname);
          fname = path.join(dname, 'file.txt');
          fs.writeFileSync(fname, search_text);
          _context3.next = 7;
          return regeneratorRuntime.awrap(repo.init());

        case 7:
          _context3.next = 9;
          return regeneratorRuntime.awrap(repo.add(fname));

        case 9:
          _context3.next = 11;
          return regeneratorRuntime.awrap(repo.commit('search'));

        case 11:
          _context3.next = 13;
          return regeneratorRuntime.awrap(repo.log());

        case 13:
          search_hash = _context3.sent.latest.hash;
          fs.writeFileSync(fname, replace_text);
          _context3.next = 17;
          return regeneratorRuntime.awrap(repo.add(fname));

        case 17:
          _context3.next = 19;
          return regeneratorRuntime.awrap(repo.commit('replace'));

        case 19:
          _context3.next = 21;
          return regeneratorRuntime.awrap(repo.log());

        case 21:
          replace_hash = _context3.sent.latest.hash;
          _context3.next = 24;
          return regeneratorRuntime.awrap(repo.checkout(search_hash));

        case 24:
          fs.writeFileSync(fname, original_text);
          _context3.next = 27;
          return regeneratorRuntime.awrap(repo.add(fname));

        case 27:
          _context3.next = 29;
          return regeneratorRuntime.awrap(repo.commit('original'));

        case 29:
          _context3.prev = 29;
          _context3.next = 32;
          return regeneratorRuntime.awrap(repo.raw(['cherry-pick', replace_hash, '--minimal']));

        case 32:
          _context3.next = 37;
          break;

        case 34:
          _context3.prev = 34;
          _context3.t0 = _context3["catch"](29);
          return _context3.abrupt("return");

        case 37:
          new_text = fs.readFileSync(fname, 'utf8');
          return _context3.abrupt("return", new_text);

        case 39:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[29, 34]]);
}

var SearchTextNotUnique =
/*#__PURE__*/
function (_Error) {
  _inherits(SearchTextNotUnique, _Error);

  function SearchTextNotUnique() {
    _classCallCheck(this, SearchTextNotUnique);

    return _possibleConstructorReturn(this, _getPrototypeOf(SearchTextNotUnique).call(this, "Search text is not unique"));
  }

  return SearchTextNotUnique;
}(_wrapNativeSuper(Error));

var all_preprocs = [[false, false, false], [true, false, false], [false, true, false], [true, true, false]];
var always_relative_indent = [[false, true, false], [true, true, false]];
var editblock_strategies = [[search_and_replace, all_preprocs], [git_cherry_pick_osr_onto_o, all_preprocs], [dmp_lines_apply, all_preprocs]];
var never_relative = [[false, false], [true, false]];
var udiff_strategies = [[search_and_replace, all_preprocs], [git_cherry_pick_osr_onto_o, all_preprocs], [dmp_lines_apply, all_preprocs]];

function flexible_search_and_replace(texts, strategies) {
  var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _step$value, strategy, preprocs, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, preproc, res;

  return regeneratorRuntime.async(function flexible_search_and_replace$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context4.prev = 3;
          _iterator = strategies[Symbol.iterator]();

        case 5:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context4.next = 39;
            break;
          }

          _step$value = _slicedToArray(_step.value, 2), strategy = _step$value[0], preprocs = _step$value[1];
          _iteratorNormalCompletion2 = true;
          _didIteratorError2 = false;
          _iteratorError2 = undefined;
          _context4.prev = 10;
          _iterator2 = preprocs[Symbol.iterator]();

        case 12:
          if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
            _context4.next = 22;
            break;
          }

          preproc = _step2.value;
          _context4.next = 16;
          return regeneratorRuntime.awrap(try_strategy(texts, strategy, preproc));

        case 16:
          res = _context4.sent;

          if (!res) {
            _context4.next = 19;
            break;
          }

          return _context4.abrupt("return", res);

        case 19:
          _iteratorNormalCompletion2 = true;
          _context4.next = 12;
          break;

        case 22:
          _context4.next = 28;
          break;

        case 24:
          _context4.prev = 24;
          _context4.t0 = _context4["catch"](10);
          _didIteratorError2 = true;
          _iteratorError2 = _context4.t0;

        case 28:
          _context4.prev = 28;
          _context4.prev = 29;

          if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
            _iterator2["return"]();
          }

        case 31:
          _context4.prev = 31;

          if (!_didIteratorError2) {
            _context4.next = 34;
            break;
          }

          throw _iteratorError2;

        case 34:
          return _context4.finish(31);

        case 35:
          return _context4.finish(28);

        case 36:
          _iteratorNormalCompletion = true;
          _context4.next = 5;
          break;

        case 39:
          _context4.next = 45;
          break;

        case 41:
          _context4.prev = 41;
          _context4.t1 = _context4["catch"](3);
          _didIteratorError = true;
          _iteratorError = _context4.t1;

        case 45:
          _context4.prev = 45;
          _context4.prev = 46;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 48:
          _context4.prev = 48;

          if (!_didIteratorError) {
            _context4.next = 51;
            break;
          }

          throw _iteratorError;

        case 51:
          return _context4.finish(48);

        case 52:
          return _context4.finish(45);

        case 53:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[3, 41, 45, 53], [10, 24, 28, 36], [29,, 31, 35], [46,, 48, 52]]);
}

function reverse_lines(text) {
  return text.split('\n').reverse().join('\n');
}

function try_strategy(texts, strategy, preproc) {
  var _preproc, preproc_strip_blank_lines, preproc_relative_indent, preproc_reverse, res;

  return regeneratorRuntime.async(function try_strategy$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _preproc = _slicedToArray(preproc, 3), preproc_strip_blank_lines = _preproc[0], preproc_relative_indent = _preproc[1], preproc_reverse = _preproc[2];

          if (preproc_strip_blank_lines) {
            texts = strip_blank_lines(texts);
          }

          if (preproc_relative_indent) {
            texts = relative_indent(texts);
          }

          if (preproc_reverse) {
            texts = texts.map(reverse_lines);
          }

          _context5.next = 6;
          return regeneratorRuntime.awrap(strategy(texts));

        case 6:
          res = _context5.sent;

          if (res && preproc_reverse) {
            res = reverse_lines(res);
          }

          if (!(res && preproc_relative_indent)) {
            _context5.next = 16;
            break;
          }

          _context5.prev = 9;
          res = make_absolute(res);
          _context5.next = 16;
          break;

        case 13:
          _context5.prev = 13;
          _context5.t0 = _context5["catch"](9);
          return _context5.abrupt("return");

        case 16:
          return _context5.abrupt("return", res);

        case 17:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[9, 13]]);
}

function strip_blank_lines(texts) {
  return texts.map(function (text) {
    return text.trim() + '\n';
  });
}

function read_text(fname) {
  return fs.readFileSync(fname, 'utf8');
}

function proc(dname) {
  var search_text, replace_text, original_text, texts, strategies, short_names, patched, _i2, _strategies, _strategies$_i, strategy, preprocs, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, preproc, method, _preproc2, strip_blank, rel_indent, rev_lines, res, results, _i3, _Object$entries, _Object$entries$_i, _method, _res, out_fname, correct;

  return regeneratorRuntime.async(function proc$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          dname = path.resolve(dname);
          _context6.prev = 1;
          search_text = read_text(path.join(dname, 'search'));
          replace_text = read_text(path.join(dname, 'replace'));
          original_text = read_text(path.join(dname, 'original'));
          _context6.next = 10;
          break;

        case 7:
          _context6.prev = 7;
          _context6.t0 = _context6["catch"](1);
          return _context6.abrupt("return");

        case 10:
          texts = [search_text, replace_text, original_text];
          strategies = [[dmp_lines_apply, all_preprocs]];
          short_names = {
            search_and_replace: 'sr',
            git_cherry_pick_osr_onto_o: 'cp_o',
            git_cherry_pick_sr_onto_so: 'cp_so',
            dmp_apply: 'dmp',
            dmp_lines_apply: 'dmpl'
          };
          patched = {};
          _i2 = 0, _strategies = strategies;

        case 15:
          if (!(_i2 < _strategies.length)) {
            _context6.next = 54;
            break;
          }

          _strategies$_i = _slicedToArray(_strategies[_i2], 2), strategy = _strategies$_i[0], preprocs = _strategies$_i[1];
          _iteratorNormalCompletion3 = true;
          _didIteratorError3 = false;
          _iteratorError3 = undefined;
          _context6.prev = 20;
          _iterator3 = preprocs[Symbol.iterator]();

        case 22:
          if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
            _context6.next = 37;
            break;
          }

          preproc = _step3.value;
          method = short_names[strategy.name];
          _preproc2 = _slicedToArray(preproc, 3), strip_blank = _preproc2[0], rel_indent = _preproc2[1], rev_lines = _preproc2[2];
          if (strip_blank || rel_indent) method += '_';
          if (strip_blank) method += 's';
          if (rel_indent) method += 'i';
          if (rev_lines) method += 'r';
          _context6.next = 32;
          return regeneratorRuntime.awrap(try_strategy(texts, strategy, preproc));

        case 32:
          res = _context6.sent;
          patched[method] = res;

        case 34:
          _iteratorNormalCompletion3 = true;
          _context6.next = 22;
          break;

        case 37:
          _context6.next = 43;
          break;

        case 39:
          _context6.prev = 39;
          _context6.t1 = _context6["catch"](20);
          _didIteratorError3 = true;
          _iteratorError3 = _context6.t1;

        case 43:
          _context6.prev = 43;
          _context6.prev = 44;

          if (!_iteratorNormalCompletion3 && _iterator3["return"] != null) {
            _iterator3["return"]();
          }

        case 46:
          _context6.prev = 46;

          if (!_didIteratorError3) {
            _context6.next = 49;
            break;
          }

          throw _iteratorError3;

        case 49:
          return _context6.finish(46);

        case 50:
          return _context6.finish(43);

        case 51:
          _i2++;
          _context6.next = 15;
          break;

        case 54:
          results = [];

          for (_i3 = 0, _Object$entries = Object.entries(patched); _i3 < _Object$entries.length; _i3++) {
            _Object$entries$_i = _slicedToArray(_Object$entries[_i3], 2), _method = _Object$entries$_i[0], _res = _Object$entries$_i[1];
            out_fname = path.join(dname, "original.".concat(_method));

            if (fs.existsSync(out_fname)) {
              fs.unlinkSync(out_fname);
            }

            if (_res) {
              fs.writeFileSync(out_fname, _res);
              correct = fs.readFileSync(path.join(dname, 'correct'), 'utf8');

              if (_res === correct) {
                _res = 'pass';
              } else {
                _res = 'WRONG';
              }
            } else {
              _res = 'fail';
            }

            results.push([_method, _res]);
          }

          return _context6.abrupt("return", results);

        case 57:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[1, 7], [20, 39, 43, 51], [44,, 46, 50]]);
}

function colorize_result(result) {
  var colors = {
    pass: '\x1b[42;30mpass\x1b[0m',
    WRONG: '\x1b[41;30mWRONG\x1b[0m',
    fail: '\x1b[43;30mfail\x1b[0m'
  };
  return colors[result] || result;
}

module.exports = {
  SearchTextNotUnique: SearchTextNotUnique
};

if (require.main === module) {
  main();
}