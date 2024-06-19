const {
    codeEdit
} = require('../utils/codeEdit');



// // const whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
// // const part = "This is a sample text\n";
// // const replace = "This is a replaced text.\n";
// // const expectedOutput = "This is a replaced text.\nAnother line of text.\nYet another line.\n";

// // const result = codeEdit.replace_most_similar_chunk(whole, part, replace);
// // console.log(result);
// //fail



// // const whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
// // const part = "This was a sample text.\nAnother line of txt\n";
// // const replace = "This is a replaced text.\nModified line of text.\n";
// // const expectedOutput = "This is a replaced text.\nModified line of text.\nYet another line.\n";

// // const result = codeEdit.replace_most_similar_chunk(whole, part, replace);
// // console.log(result);
// //fail


// // const inputText = "filename.ext\n```\nWe just want this content\nNot the filename and triple quotes\n```";
// //     const expectedOutput = "We just want this content\nNot the filename and triple quotes\n";
// //     const result = codeEdit.strip_quoted_wrapping(inputText, "filename.ext");
// //     console.log(result);
// //pass



// // const inputText = "```\nWe just want this content\nNot the triple quotes\n```";
// // const expectedOutput = "We just want this content\nNot the triple quotes\n";
// // const result = codeEdit.strip_quoted_wrapping(inputText);
// // console.log(result);
// //pass

// // const inputText = "We just want this content\nNot the triple quotes\n";
// // const expectedOutput = "We just want this content\nNot the triple quotes\n";
// // const result =  codeEdit.strip_quoted_wrapping(inputText);
// // console.log(result);
// //pass


// const edit = `
// Here's the change:

// \`\`\`text
// foo.txt
// <<<<<<< SEARCH
// Two
// =======
// Tooooo
// >>>>>>> REPLACE
// \`\`\`

// Hope you like it!
// `;

// const edits = Array.from(codeEdit.find_original_update_blocks(edit));
// console.log(edits)
// // pass


// const source = 'source';

// const edit = `
// Here's the change:

// <${source}>foo.txt
// <<<<<<< SEARCH
// One
// =======
// Two
// >>>>>>> REPLACE
// </${source}>

// Hope you like it!
// `;

// const fence = [`<${source}>`, `</${source}>`];

// let result =Array.from(codeEdit.find_original_update_blocks(edit, fence))
// // to.throw('missing filename');
// console.log(result);
// pass

// const edit = `
// Here's the change:

// foo.txt
// \`\`\`text
// <<<<<<< SEARCH
// Two
// =======
// Tooooo
// >>>>>>> REPLACE
// \`\`\`

// Hope you like it!
// `;

//     const edits = Array.from(codeEdit.find_original_update_blocks(edit));
//     console.log(edits);

// //fail

// const edit = `
// Here's the change:

// \`\`\`text
// foo.txt
// <<<<<<< SEARCH
// Two
// =======
// Tooooo


// oops!
// `;
// let result= Array.from(codeEdit.find_original_update_blocks(edit))
// console.log(result)
// // .to.throw('Incomplete');


// let whole = `
//     line1
//     line2
//         line3
//     line4
// `;

// let part = "line2\n    line3\n";
// let replace = "new_line2\n    new_line3\n";

// let expected_output = `
//     line1
//     new_line2
//         new_line3
//     line4
// `;
//     const result = codeEdit.replace_most_similar_chunk(whole, part, replace);
//     console.log(result)


// const whole = "    line1\n    line2\n    line3\n";
//     const part = "line1\nline2\n";
//     const replace = "new_line1\nnew_line2\n";
//     const expectedOutput = "    new_line1\n    new_line2\n    line3\n";

//     const result = codeEdit.replace_most_similar_chunk(whole, part, replace);
//     console.log(result);
// const whole = "This is a sample text.\nAnother line of text.\nYet another line.\n";
// const part = "This is a sample text\n";
// const replace = "This is a replaced text.\n";
// const expectedOutput = "This is a replaced text.\nAnother line of text.\nYet another line.\n";

// const result = codeEdit.replace_most_similar_chunk(whole, part, replace);
// console.log(result)
// expect(result).to.equal(expectedOutput);

let edit = `
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

    const edits = Array.from(codeEdit.find_original_update_blocks(edit));