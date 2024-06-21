"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var codebolt = require('@codebolt/codeboltjs')["default"];

var _require = require("./coders/base_coder"),
    Coder = _require.Coder;

var _require2 = require("./coders/editblock_fenced_coder"),
    EditBlockFencedCoder = _require2.EditBlockFencedCoder; // const {UnifiedDiffCoder} = require("./coders/udiff_coder");
// const {WholeFileCoder} = require("./coders/wholefile_coder");


var _require3 = require("./coders/editblock_coder"),
    EditBlockCoder = _require3.EditBlockCoder;

function create() {
  var edit_format = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
  var io = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var from_coder = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  var kwargs = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

  // if (!main_model) {
  //     if (from_coder) {
  //         main_model = from_coder.main_model;
  //     } else {
  //         main_model = 'gpt-4'//new models.Model(models.DEFAULT_MODEL_NAME);
  //     }
  // }
  if (edit_format === null) {
    if (from_coder) {
      edit_format = from_coder.edit_format;
    } else {
      edit_format = main_model.edit_format;
    }
  }

  if (!io && from_coder) {
    io = from_coder.io;
  }

  if (from_coder) {
    var use_kwargs = _objectSpread({}, from_coder.original_kwargs); // copy orig kwargs


    var done_messages = from_coder.done_messages;

    if (edit_format !== from_coder.edit_format && done_messages) {
      done_messages = from_coder.summarizer.summarize_all(done_messages);
    } // Bring along context from the old Coder


    var update = {
      fnames: from_coder.get_inchat_relative_files(),
      done_messages: done_messages,
      cur_messages: from_coder.cur_messages
    };
    use_kwargs = _objectSpread({}, use_kwargs, {}, update, {}, kwargs); // override to complete the switch and passed kwargs

    kwargs = use_kwargs;
  }

  var res;

  switch (edit_format) {
    case "diff":
      res = new EditBlockCoder(kwargs);
      break;

    case "diff-fenced":
      res = new EditBlockFencedCoder(kwargs);
      break;
    // case "whole":
    //     res = new WholeFileCoder(main_model, io, kwargs);
    //     break;
    // case "udiff":
    //     res = new UnifiedDiffCoder(main_model, io, kwargs);
    //     break;

    default:
      throw new Error("Unknown edit format ".concat(edit_format));
  }

  res.original_kwargs = _objectSpread({}, kwargs);
  return res;
} // async function execute() {
//     await codebolt.waitForConnection();
//     const args = {
//         message: "can you add new module to my code"
//     };
//     // const userChangerequest = await codebolt.chat.waitforReply("Please let me know what changes do you want to be done in the application?");
//     const coder = create('diff');
//     let res = await coder.run(with_message = args.message);
//     console.log(res);
// }
// (async () => {
//     await execute();
// })();


codebolt.chat.onActionMessage().on("userMessage", function _callee(req, response) {
  var message, mentionedFiles, mentionedFolders, coder, res;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return regeneratorRuntime.awrap(codebolt.waitForConnection());

        case 2:
          // let req = {"message":{
          //     userMessage: 'add routes for user crud operation',
          //     currentFile: '',
          //     mentionedFiles: ['/Users/ravirawat/Desktop/codebolt/testing/test.js'],
          //     mentionedFolders: [],
          //     actions: []
          // }}
          message = req.message;
          mentionedFiles = req.message.mentionedFiles || [];
          console.log(mentionedFiles);
          mentionedFolders = req.message.mentionedFolders;
          console.log(message); // let {
          //     message
          // } = await codebolt.chat.waitforReply("i am agent name as codeblt i am software developer how may i help you?");

          coder = create('diff-fenced', null, null, mentionedFiles); // console.log(message);

          _context.next = 10;
          return regeneratorRuntime.awrap(coder.run(with_message = message.userMessage));

        case 10:
          res = _context.sent;
          coder.apply_updates();
          response();

        case 13:
        case "end":
          return _context.stop();
      }
    }
  });
});