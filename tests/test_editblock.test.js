const fs = require('fs-extra');
const path = require('path');
const { expect } = require('chai');
const sinon = require('sinon');
const { replaceMostSimilarChunk, stripQuotedWrapping, findOriginalUpdateBlocks } = require('./editblock_coder'); // Assuming you have these functions implemented in editblock_coder.js
const { Model } = require('./models'); // Assuming you have Model class implemented in models.js
const { Coder } = require('./coders'); // Assuming you have Coder class implemented in coders.js
const { InputOutput } = require('./io'); // Assuming you have InputOutput class implemented in io.js

describe('TestUtils', function() {
  beforeEach(function() {
    this.GPT35 = new Model('gpt-3.5-turbo');
  });

  it('should replace most similar chunk', function() {
    const whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
    const part = "This is a sample text\n";
    const replace = "This is a replaced text.\n";
    const expectedOutput = "This is a replaced text.\nAnother line of text.\nYet another line.\n";

    const result = replaceMostSimilarChunk(whole, part, replace);
    expect(result).to.equal(expectedOutput);
  });

  it('should replace most similar chunk not perfect match', function() {
    const whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
    const part = "This was a sample text.\nAnother line of txt\n";
    const replace = "This is a replaced text.\nModified line of text.\n";
    const expectedOutput = "This is a replaced text.\nModified line of text.\nYet another line.\n";

    const result = replaceMostSimilarChunk(whole, part, replace);
    expect(result).to.equal(expectedOutput);
  });

  it('should strip quoted wrapping', function() {
    const inputText = "filename.ext\n```\nWe just want this content\nNot the filename and triple quotes\n```";
    const expectedOutput = "We just want this content\nNot the filename and triple quotes\n";
    const result = stripQuotedWrapping(inputText, "filename.ext");
    expect(result).to.equal(expectedOutput);
  });

  it('should strip quoted wrapping no filename', function() {
    const inputText = "```\nWe just want this content\nNot the triple quotes\n```";
    const expectedOutput = "We just want this content\nNot the triple quotes\n";
    const result = stripQuotedWrapping(inputText);
    expect(result).to.equal(expectedOutput);
  });

  it('should strip quoted wrapping no wrapping', function() {
    const inputText = "We just want this content\nNot the triple quotes\n";
    const expectedOutput = "We just want this content\nNot the triple quotes\n";
    const result = stripQuotedWrapping(inputText);
    expect(result).to.equal(expectedOutput);
  });

  it('should find original update blocks', function() {
    const edit = `
Here's the change:

\`\`\`text
foo.txt
<<<<<<< SEARCH
Two
=======
Tooooo
>>>>>>> REPLACE
\`\`\`

Hope you like it!
`;

    const edits = Array.from(findOriginalUpdateBlocks(edit));
    expect(edits).to.deep.equal([['foo.txt', 'Two\n', 'Tooooo\n']]);
  });

  it('should find original update blocks mangled filename with source tag', function() {
    const source = 'source';

    const edit = `
Here's the change:

<${source}>foo.txt
<<<<<<< SEARCH
One
=======
Two
>>>>>>> REPLACE
</${source}>

Hope you like it!
`;

    const fence = [`<${source}>`, `</${source}>`];

    expect(() => Array.from(findOriginalUpdateBlocks(edit, fence))).to.throw('missing filename');
  });

  it('should find original update blocks quote below filename', function() {
    const edit = `
Here's the change:

foo.txt
\`\`\`text
<<<<<<< SEARCH
Two
=======
Tooooo
>>>>>>> REPLACE
\`\`\`

Hope you like it!
`;

    const edits = Array.from(findOriginalUpdateBlocks(edit));
    expect(edits).to.deep.equal([['foo.txt', 'Two\n', 'Tooooo\n']]);
  });

  it('should find original update blocks unclosed', function() {
    const edit = `
Here's the change:

\`\`\`text
foo.txt
<<<<<<< SEARCH
Two
=======
Tooooo


oops!
`;

    expect(() => Array.from(findOriginalUpdateBlocks(edit))).to.throw('Incomplete');
  });

  it('should find original update blocks missing filename', function() {
    const edit = `
Here's the change:

\`\`\`text
<<<<<<< SEARCH
Two
=======
Tooooo


oops!
`;

    expect(() => Array.from(findOriginalUpdateBlocks(edit))).to.throw('filename');
  });

  it('should find original update blocks no final newline', function() {
    const edit = `
aider/coder.py
<<<<<<< SEARCH
            self.console.print("[red]^C again to quit")
=======
            self.io.tool_error("^C again to quit")
>>>>>>> REPLACE

aider/coder.py
<<<<<<< SEARCH
            self.io.tool_error("Malformed ORIGINAL/UPDATE blocks, retrying...")
            self.io.tool_error(err)
=======
            self.io.tool_error("Malformed ORIGINAL/UPDATE blocks, retrying...")
            self.io.tool_error(str(err))
>>>>>>> REPLACE

aider/coder.py
<<<<<<< SEARCH
            self.console.print("[red]Unable to get commit message from gpt-3.5-turbo. Use /commit to try again.\n")
=======
            self.io.tool_error("Unable to get commit message from gpt-3.5-turbo. Use /commit to try again.")
>>>>>>> REPLACE

aider/coder.py
<<<<<<< SEARCH
            self.console.print("[red]Skipped commmit.")
=======
            self.io.tool_error("Skipped commmit.")
>>>>>>> REPLACE`;

    expect(() => Array.from(findOriginalUpdateBlocks(edit))).to.not.throw();
  });

  it('should test full edit', async function() {
    const file1 = path.join(__dirname, 'tempfile1.txt');
    await fs.writeFile(file1, "one\ntwo\nthree\n");

    const files = [file1];

    const coder = Coder.create(this.GPT35, "diff", { io: new InputOutput(), fnames: files });

    const mockSend = sinon.stub(coder, 'send').callsFake(async () => {
      coder.partialResponseContent = `
Do this:

${path.basename(file1)}
<<<<<<< SEARCH
two
=======
new
>>>>>>> REPLACE

`;
      coder.partialResponseFunctionCall = {};
      return [];
    });

    await coder.run({ with_message: 'hi' });

    const content = await fs.readFile(file1, 'utf8');
    expect(content).to.equal("one\nnew\nthree\n");

    mockSend.restore();
  });

  it('should test full edit dry run', async function() {
    const file1 = path.join(__dirname, 'tempfile1.txt');
    const origContent = "one\ntwo\nthree\n";

    await fs.writeFile(file1, origContent);

    const files = [file1];

    const coder = Coder.create(this.GPT35, "diff", { io: new InputOutput({ dry_run: true }), fnames: files, dry_run: true });

    const mockSend = sinon.stub(coder, 'send').callsFake(async () => {
      coder.partialResponseContent = `
Do this:

${path.basename(file1)}
<<<<<<< SEARCH
two
=======
new
>>>>>>> REPLACE

`;
      coder.partialResponseFunctionCall = {};
      return [];
    });

    await coder.run({ with_message: 'hi' });

    const content = await fs.readFile(file1, 'utf8');
    expect(content).to.equal(origContent);

    mockSend.restore();
  });

  it('should find original update blocks multiple same file', function() {
    const edit = `
Here's the change:

\`\`\`text
foo.txt
<<<<<<< SEARCH
one
=======
two
>>>>>>> REPLACE

...

<<<<<<< SEARCH
three
=======
four
>>>>>>> REPLACE
\`\`\`

Hope you like it!
`;

    const edits = Array.from(findOriginalUpdateBlocks(edit));
    expect(edits).to.deep.equal([
      ['foo.txt', 'one\n', 'two\n'],
      ['foo.txt', 'three\n', 'four\n']
    ]);
  });
});
