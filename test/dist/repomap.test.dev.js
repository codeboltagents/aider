"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var _require = require('chai'),
    expect = _require.expect;

var fs = require('fs-extra');

var path = require('path');

var tmp = require('tmp');

var _require2 = require("../utils/repomap"),
    RepoMap = _require2.RepoMap; // const { RepoMap, Model } = require('./your-modules'); // Replace with actual import paths


function createTempDirWithFiles(files, callback) {
  tmp.dir({
    unsafeCleanup: true
  }, function (err, dirPath, cleanupCallback) {
    if (err) throw err;

    try {
      files.forEach(function (file) {
        fs.writeFileSync(path.join(dirPath, file), '');
      });
      callback(dirPath, cleanupCallback);
    } catch (err) {
      cleanupCallback();
      throw err;
    }
  });
} // it('should get repo map with files', (done) => {
//     const testFiles = [
//         'test_file1.py',
//         'test_file2.py',
//         'test_file3.md',
//         'test_file4.json'
//     ];
//     createTempDirWithFiles(testFiles, (tempDir, cleanupCallback) => {
//         // const io = new InputOutput();
//         const repoMap = new RepoMap();
//         const otherFiles = testFiles.map(file => path.join(tempDir, file));
//         repoMap.get_ranked_tags_map([], otherFiles).then(result => {
//             expect(result).to.include.keys(...testFiles);
//             // cleanupCallback();
//             // done();
//         })
//         // .catch(done);
//     });
// });


it('should get repo map with identifiers', function (done) {
  var files = {
    'test_file_with_identifiers.js': "class MyClass {\n              myMethod(arg1, arg2) {\n                  return arg1 + arg2;\n              }\n          }\n          \n          function myFunction(arg1, arg2) {\n              return arg1 * arg2;\n          }",
    'test_file_import.js': "// Import the required items from the file\n  const { MyClass, myFunction } = require('./test_file_with_identifiers');\n  \n  // Create an instance of MyClass\n  const obj = new MyClass();\n  \n  // Use the methods and functions\n  console.log(obj.myMethod(1, 2)); // Outputs: 3\n  console.log(myFunction(3, 4));    // Outputs: 12\n  ",
    'test_file_pass.js': 'pass'
  };
  createTempDirWithFiles(Object.keys(files), function (tempDir, cleanupCallback) {
    for (var _i = 0, _Object$entries = Object.entries(files); _i < _Object$entries.length; _i++) {
      var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
          file = _Object$entries$_i[0],
          content = _Object$entries$_i[1];

      fs.writeFileSync(path.join(tempDir, file), content);
    } // const io = new InputOutput();


    var repoMap = new RepoMap(1224, tempDir);
    var otherFiles = Object.keys(files).map(function (file) {
      return path.join(tempDir, file);
    });
    repoMap.get_ranked_tags_map([], otherFiles).then(function (result) {
      console.log(result); // expect(result).to.include.all.keys(...Object.keys(files));
      // expect(result).to.include('MyClass');
      // expect(result).to.include('myMethod');
      // expect(result).to.include('myFunction');

      cleanupCallback();
      done();
    })["catch"](done);
  });
}); // it('should get repo map with all file types', (done) => {
//     const testFiles = [
//         'test_file0.py',
//         'test_file1.txt',
//         'test_file2.md',
//         'test_file3.json',
//         'test_file4.html',
//         'test_file5.css',
//         'test_file6.js'
//     ];
//     createTempDirWithFiles(testFiles, (tempDir, cleanupCallback) => {
//         const io = new InputOutput();
//         const repoMap = new RepoMap({ mainModel: GPT35, root: tempDir, io });
//         const otherFiles = testFiles.map(file => path.join(tempDir, file));
//         repoMap.getRepoMap([], otherFiles).then(result => {
//             testFiles.forEach(file => {
//                 expect(result).to.include(file);
//             });
//             cleanupCallback();
//             done();
//         }).catch(done);
//     });
// });
// it('should get repo map excluding added files', (done) => {
//     const testFiles = [
//         'test_file1.py',
//         'test_file2.py',
//         'test_file3.md',
//         'test_file4.json'
//     ];
//     createTempDirWithFiles(testFiles, (tempDir, cleanupCallback) => {
//         testFiles.forEach(file => {
//             fs.writeFileSync(path.join(tempDir, file), 'def foo(): pass\n');
//         });
//         const io = new InputOutput();
//         const repoMap = new RepoMap({ mainModel: GPT35, root: tempDir, io });
//         const includedFiles = testFiles.slice(0, 2).map(file => path.join(tempDir, file));
//         const excludedFiles = testFiles.slice(2).map(file => path.join(tempDir, file));
//         repoMap.getRepoMap(includedFiles, excludedFiles).then(result => {
//             expect(result).to.not.include('test_file1.py');
//             expect(result).to.not.include('test_file2.py');
//             expect(result).to.include('test_file3.md');
//             expect(result).to.include('test_file4.json');
//             cleanupCallback();
//             done();
//         }).catch(done);
//     });
// });
// it('should get repo map with TypeScript identifiers', (done) => {
// const tsFileContent = `
// class MyClass {
//     constructor(value) {
//         this.value = value;
//     }
//     add(input) {
//         return this.value + input;
//     }
// }
// const Status = {
//     New: 0,
//     InProgress: 1,
//     Completed: 2,
// };
// function myFunction(input) {
//     return input * 2;
// }
// // Export statements for JavaScript (Node.js)
// module.exports = {
//     MyClass,
//     Status,
//     myFunction,
// };
// `;
// createTempDirWithFiles(['test_file.js'], (tempDir, cleanupCallback) => {
//     fs.writeFileSync(path.join(tempDir, 'test_file.js'), tsFileContent);
//     // const io = new InputOutput();
//     const repoMap = new RepoMap(1024,  tempDir );
//     const otherFiles = [path.join(tempDir, 'test_file.js')];
//     repoMap.get_ranked_tags_map([], otherFiles).then(result => {
//         // expect(result).to.include('test_file.ts');
//         // expect(result).to.include('IMyInterface');
//         // expect(result).to.include('ExampleType');
//         // expect(result).to.include('Status');
//         // expect(result).to.include('MyClass');
//         // expect(result).to.include('add');
//         // expect(result).to.include('myFunction');
//         cleanupCallback();
//         done();
//     })
//     // .catch(done);
// });
// });