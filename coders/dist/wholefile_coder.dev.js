"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

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

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var diffs = require('./../utils/diffs');

var fs = require('fs');

var codebolt = require('@codebolt/codeboltjs')["default"];

var Coder = require('./base_coder');

var WholeFilePrompts = require('./wholefile_prompts');

var WholeFileCoder =
/*#__PURE__*/
function (_Coder) {
  _inherits(WholeFileCoder, _Coder);

  function WholeFileCoder() {
    var _getPrototypeOf2;

    var _this;

    _classCallCheck(this, WholeFileCoder);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _possibleConstructorReturn(this, (_getPrototypeOf2 = _getPrototypeOf(WholeFileCoder)).call.apply(_getPrototypeOf2, [this].concat(args)));
    _this.edit_format = "whole";
    _this.gpt_prompts = new WholeFilePrompts();
    return _this;
  }

  _createClass(WholeFileCoder, [{
    key: "update_cur_messages",
    value: function update_cur_messages(edited) {
      if (edited) {
        this.cur_messages.push({
          role: "assistant",
          content: this.gpt_prompts.redacted_edit_message
        });
      } else {
        this.cur_messages.push({
          role: "assistant",
          content: this.partial_response_content
        });
      }
    }
  }, {
    key: "render_incremental_response",
    value: function render_incremental_response(_final) {
      var edits;
      return regeneratorRuntime.async(function render_incremental_response$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              _context.next = 3;
              return regeneratorRuntime.awrap(this.get_edits("diff"));

            case 3:
              edits = _context.sent;
              return _context.abrupt("return", edits);

            case 7:
              _context.prev = 7;
              _context.t0 = _context["catch"](0);

              if (!(_context.t0 instanceof ValueError)) {
                _context.next = 11;
                break;
              }

              return _context.abrupt("return", this.partial_response_content);

            case 11:
              throw _context.t0;

            case 12:
            case "end":
              return _context.stop();
          }
        }
      }, null, this, [[0, 7]]);
    }
  }, {
    key: "get_edits",
    value: function get_edits() {
      var mode,
          content,
          chat_files,
          output,
          lines,
          edits,
          saw_fname,
          fname,
          fname_source,
          new_lines,
          i,
          line,
          full_path,
          live_diff_result,
          words,
          _iteratorNormalCompletion,
          _didIteratorError,
          _iteratorError,
          _iterator,
          _step,
          word,
          _iteratorNormalCompletion2,
          _didIteratorError2,
          _iteratorError2,
          _iterator2,
          _step2,
          chat_file,
          quoted_chat_file,
          _full_path,
          _live_diff_result,
          seen,
          refined_edits,
          _i,
          _arr,
          source,
          _iteratorNormalCompletion3,
          _didIteratorError3,
          _iteratorError3,
          _iterator3,
          _step3,
          edit,
          _edit,
          _fname,
          _fname_source,
          _new_lines,
          _args2 = arguments;

      return regeneratorRuntime.async(function get_edits$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              mode = _args2.length > 0 && _args2[0] !== undefined ? _args2[0] : "update";
              content = this.partial_response_content;
              chat_files = this.get_inchat_relative_files();
              output = [];
              lines = content.split(/\r?\n/);
              edits = [];
              saw_fname = null;
              fname = null;
              fname_source = null;
              new_lines = [];
              i = 0;

            case 11:
              if (!(i < lines.length)) {
                _context2.next = 97;
                break;
              }

              line = lines[i];

              if (!(line.startsWith(this.fence[0]) || line.startsWith(this.fence[1]))) {
                _context2.next = 44;
                break;
              }

              if (!(fname !== null)) {
                _context2.next = 29;
                break;
              }

              // ending an existing block
              saw_fname = null;
              full_path = this.abs_root_path(fname);

              if (!(mode === "diff")) {
                _context2.next = 24;
                break;
              }

              _context2.next = 20;
              return regeneratorRuntime.awrap(this.do_live_diff(full_path, new_lines, true));

            case 20:
              live_diff_result = _context2.sent;
              output.push.apply(output, _toConsumableArray(live_diff_result));
              _context2.next = 25;
              break;

            case 24:
              edits.push([fname, fname_source, new_lines]);

            case 25:
              fname = null;
              fname_source = null;
              new_lines = [];
              return _context2.abrupt("continue", 94);

            case 29:
              // fname == null ... starting a new block
              if (i > 0) {
                fname_source = "block";
                fname = lines[i - 1].trim();
                fname = fname.replace(/^\*+/, ''); // handle **filename.py**

                fname = fname.replace(/:$/, '');
                fname = fname.replace(/`/g, ''); // Did gpt prepend a bogus dir? It especially likes to
                // include the path/to prefix from the one-shot example in
                // the prompt.

                if (fname && !chat_files.includes(fname) && chat_files.map(function (file) {
                  return new Path(file).name;
                }).includes(fname)) {
                  fname = new Path(fname).name;
                }
              }

              if (fname) {
                _context2.next = 42;
                break;
              }

              if (!saw_fname) {
                _context2.next = 36;
                break;
              }

              fname = saw_fname;
              fname_source = "saw";
              _context2.next = 42;
              break;

            case 36:
              if (!(chat_files.length === 1)) {
                _context2.next = 41;
                break;
              }

              fname = chat_files[0];
              fname_source = "chat";
              _context2.next = 42;
              break;

            case 41:
              throw new Error("No filename provided before ".concat(this.fence[0], " in file listing"));

            case 42:
              _context2.next = 94;
              break;

            case 44:
              if (!(fname !== null)) {
                _context2.next = 48;
                break;
              }

              new_lines.push(line);
              _context2.next = 94;
              break;

            case 48:
              words = line.trim().split(/\s+/);
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context2.prev = 52;
              _iterator = words[Symbol.iterator]();

            case 54:
              if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                _context2.next = 79;
                break;
              }

              word = _step.value;
              word = word.replace(/[.,:;!]/g, '');
              _iteratorNormalCompletion2 = true;
              _didIteratorError2 = false;
              _iteratorError2 = undefined;
              _context2.prev = 60;

              for (_iterator2 = chat_files[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                chat_file = _step2.value;
                quoted_chat_file = "`".concat(chat_file, "`");

                if (word === quoted_chat_file) {
                  saw_fname = chat_file;
                }
              }

              _context2.next = 68;
              break;

            case 64:
              _context2.prev = 64;
              _context2.t0 = _context2["catch"](60);
              _didIteratorError2 = true;
              _iteratorError2 = _context2.t0;

            case 68:
              _context2.prev = 68;
              _context2.prev = 69;

              if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
                _iterator2["return"]();
              }

            case 71:
              _context2.prev = 71;

              if (!_didIteratorError2) {
                _context2.next = 74;
                break;
              }

              throw _iteratorError2;

            case 74:
              return _context2.finish(71);

            case 75:
              return _context2.finish(68);

            case 76:
              _iteratorNormalCompletion = true;
              _context2.next = 54;
              break;

            case 79:
              _context2.next = 85;
              break;

            case 81:
              _context2.prev = 81;
              _context2.t1 = _context2["catch"](52);
              _didIteratorError = true;
              _iteratorError = _context2.t1;

            case 85:
              _context2.prev = 85;
              _context2.prev = 86;

              if (!_iteratorNormalCompletion && _iterator["return"] != null) {
                _iterator["return"]();
              }

            case 88:
              _context2.prev = 88;

              if (!_didIteratorError) {
                _context2.next = 91;
                break;
              }

              throw _iteratorError;

            case 91:
              return _context2.finish(88);

            case 92:
              return _context2.finish(85);

            case 93:
              output.push(line);

            case 94:
              i++;
              _context2.next = 11;
              break;

            case 97:
              if (!(mode === "diff")) {
                _context2.next = 105;
                break;
              }

              if (!(fname !== null)) {
                _context2.next = 104;
                break;
              }

              // ending an existing block
              _full_path = new Path(this.root).join(fname).absolute();
              _context2.next = 102;
              return regeneratorRuntime.awrap(this.do_live_diff(_full_path, new_lines, false));

            case 102:
              _live_diff_result = _context2.sent;
              output.push.apply(output, _toConsumableArray(_live_diff_result)); // output.push(...this.do_live_diff(full_path, new_lines, false));

            case 104:
              return _context2.abrupt("return", output.join("\n"));

            case 105:
              if (fname !== null) {
                edits.push([fname, fname_source, new_lines]);
              }

              seen = new Set();
              refined_edits = []; // process from most reliable filename, to least reliable

              _i = 0, _arr = ["block", "saw", "chat"];

            case 109:
              if (!(_i < _arr.length)) {
                _context2.next = 145;
                break;
              }

              source = _arr[_i];
              _iteratorNormalCompletion3 = true;
              _didIteratorError3 = false;
              _iteratorError3 = undefined;
              _context2.prev = 114;
              _iterator3 = edits[Symbol.iterator]();

            case 116:
              if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
                _context2.next = 128;
                break;
              }

              edit = _step3.value;
              _edit = _slicedToArray(edit, 3), _fname = _edit[0], _fname_source = _edit[1], _new_lines = _edit[2];

              if (!(_fname_source !== source)) {
                _context2.next = 121;
                break;
              }

              return _context2.abrupt("continue", 125);

            case 121:
              if (!seen.has(_fname)) {
                _context2.next = 123;
                break;
              }

              return _context2.abrupt("continue", 125);

            case 123:
              seen.add(_fname);
              refined_edits.push([_fname, _fname_source, _new_lines]);

            case 125:
              _iteratorNormalCompletion3 = true;
              _context2.next = 116;
              break;

            case 128:
              _context2.next = 134;
              break;

            case 130:
              _context2.prev = 130;
              _context2.t2 = _context2["catch"](114);
              _didIteratorError3 = true;
              _iteratorError3 = _context2.t2;

            case 134:
              _context2.prev = 134;
              _context2.prev = 135;

              if (!_iteratorNormalCompletion3 && _iterator3["return"] != null) {
                _iterator3["return"]();
              }

            case 137:
              _context2.prev = 137;

              if (!_didIteratorError3) {
                _context2.next = 140;
                break;
              }

              throw _iteratorError3;

            case 140:
              return _context2.finish(137);

            case 141:
              return _context2.finish(134);

            case 142:
              _i++;
              _context2.next = 109;
              break;

            case 145:
              return _context2.abrupt("return", refined_edits);

            case 146:
            case "end":
              return _context2.stop();
          }
        }
      }, null, this, [[52, 81, 85, 93], [60, 64, 68, 76], [69,, 71, 75], [86,, 88, 92], [114, 130, 134, 142], [135,, 137, 141]]);
    }
  }, {
    key: "apply_edits",
    value: function apply_edits(edits) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = edits[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var _step4$value = _slicedToArray(_step4.value, 3),
              path = _step4$value[0],
              fname_source = _step4$value[1],
              new_lines = _step4$value[2];

          var full_path = this.abs_root_path(path);
          var new_lines_str = new_lines.map(function (line) {
            return line + '\n';
          });
          new_lines_str = new_lines_str.join('');
          console.log(new_lines_str);
          codebolt.fs.createFile(full_path, new_lines_str); // this.io.write_text(full_path, new_lines_str);
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
    }
  }, {
    key: "do_live_diff",
    value: function do_live_diff(full_path, new_lines, _final2) {
      var output, _ref, content, orig_lines, show_diff;

      return regeneratorRuntime.async(function do_live_diff$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              if (!fs.existsSync(full_path)) {
                _context3.next = 12;
                break;
              }

              _context3.next = 3;
              return regeneratorRuntime.awrap(codebolt.fs.readFile(full_path));

            case 3:
              _ref = _context3.sent;
              content = _ref.content;
              orig_lines = content;
              orig_lines = orig_lines.split('\n').map(function (line) {
                return line + '\n';
              });
              show_diff = diffs.diff_partial_update(orig_lines, new_lines, _final2);
              show_diff = show_diff.split('/n').map(function (line) {
                return line + '\n';
              });
              output = show_diff;
              _context3.next = 13;
              break;

            case 12:
              output = ["```"].concat(new_lines, ["```"]);

            case 13:
              return _context3.abrupt("return", output);

            case 14:
            case "end":
              return _context3.stop();
          }
        }
      });
    }
  }]);

  return WholeFileCoder;
}(Coder);

module.exports = WholeFileCoder;