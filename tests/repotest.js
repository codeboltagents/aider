const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const {RepoMap} = require("../utils/repomap");
// const { RepoMap, Model } = require('./your-modules'); // Replace with actual import paths


    function createTempDirWithFiles(files, callback) {
        tmp.dir({ unsafeCleanup: true }, (err, dirPath, cleanupCallback) => {
            if (err) throw err;
            try {
                files.forEach(file => {
                    fs.writeFileSync(path.join(dirPath, file), '');
                });
                callback(dirPath, cleanupCallback);
            } catch (err) {
                cleanupCallback();
                throw err;
            }
        });
    }

    // it('should get repo map with files', (done) => {
        const testFiles = [
            'test_file1.py',
            'test_file2.py',
            'test_file3.md',
            'test_file4.json'
        ];

        createTempDirWithFiles(testFiles, (tempDir, cleanupCallback) => {
            // const io = new InputOutput();
            const repoMap = new RepoMap();
            const otherFiles = testFiles.map(file => path.join(tempDir, file));
            repoMap.get_ranked_tags_map([], otherFiles).then(result => {
                expect(result).to.include.keys(...testFiles);
                // cleanupCallback();
                // done();
            })
            // .catch(done);
        });
    // });

    // it('should get repo map with identifiers', (done) => {
    //     const files = {
    //         'test_file_with_identifiers.py': `class MyClass {
    //             myMethod(arg1, arg2) {
    //                 return arg1 + arg2;
    //             }
    //         }
    //         function myFunction(arg1, arg2) {
    //             return arg1 * arg2;
    //         }`,
    //         'test_file_import.py': `from test_file_with_identifiers import MyClass

    //         const obj = new MyClass();
    //         console.log(obj.myMethod(1, 2));
    //         console.log(myFunction(3, 4));`,
    //         'test_file_pass.py': 'pass'
    //     };

    //     createTempDirWithFiles(Object.keys(files), (tempDir, cleanupCallback) => {
    //         for (const [file, content] of Object.entries(files)) {
    //             fs.writeFileSync(path.join(tempDir, file), content);
    //         }

    //         const io = new InputOutput();
    //         const repoMap = new RepoMap({ mainModel: GPT35, root: tempDir, io });
    //         const otherFiles = Object.keys(files).map(file => path.join(tempDir, file));
    //         repoMap.getRepoMap([], otherFiles).then(result => {
    //             expect(result).to.include.all.keys(...Object.keys(files));
    //             expect(result).to.include('MyClass');
    //             expect(result).to.include('myMethod');
    //             expect(result).to.include('myFunction');
    //             cleanupCallback();
    //             done();
    //         }).catch(done);
    //     });
    // });

    // it('should get repo map with all file types', (done) => {
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
    //     const tsFileContent = `interface IMyInterface {
    //         someMethod(): void;
    //     }

    //     type ExampleType = {
    //         key: string;
    //         value: number;
    //     };

    //     enum Status {
    //         New,
    //         InProgress,
    //         Completed,
    //     }

    //     export class MyClass {
    //         constructor(public value: number) {}

    //         add(input: number): number {
    //             return this.value + input;
    //         }
    //     }

    //     export function myFunction(input: number): number {
    //         return input * 2;
    //     }
    //     `;

    //     createTempDirWithFiles(['test_file.ts'], (tempDir, cleanupCallback) => {
    //         fs.writeFileSync(path.join(tempDir, 'test_file.ts'), tsFileContent);

    //         // const io = new InputOutput();
    //         const repoMap = new RepoMap({ mainModel: GPT35, root: tempDir, io });
    //         const otherFiles = [path.join(tempDir, 'test_file.ts')];
    //         repoMap.getRepoMap([], otherFiles).then(result => {
    //             // expect(result).to.include('test_file.ts');
    //             // expect(result).to.include('IMyInterface');
    //             // expect(result).to.include('ExampleType');
    //             // expect(result).to.include('Status');
    //             // expect(result).to.include('MyClass');
    //             // expect(result).to.include('add');
    //             // expect(result).to.include('myFunction');
    //             cleanupCallback();
    //             done();
    //         }).catch(done);
    //     });
    // });

