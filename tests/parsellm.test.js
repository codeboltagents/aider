const parseLLMResp = require('../utils/parseLLMResp');

// describe('parseLLMResp', () => {
//     it('should correctly parse response with valid content', () => {
//         const content = "<<UPD\nfilename\noriginal_text\n----\nupdated_text\n>>UPD\n";
//         const result = parseLLMResp.find_original_update_blocks(content);
//         const expected = { filename: 'filename', original_text: 'original_text', updated_text: 'updated_text' };

//         expect(result.next().value).toEqual(expected);
//     });

//     // it('should throw error when content is missing filename', () => {
//     //     const content = "<<UPD\n\noriginal_text\n----\nupdated_text\n>>UPD\n";
//     //     const result = parseLLMResp.find_original_update_blocks(content);

//     //     expect(() => result.next()).toThrowError('Missing filename error: <<UPD');
//     // });

//     // it('should throw error when content is missing divider', () => {
//     //     const content = "<<UPD\nfilename\noriginal_text\nupdated_text\n>>UPD\n";
//     //     const result = parseLLMResp.find_original_update_blocks(content);

//     //     expect(() => result.next()).toThrowError('Expected ---- not updated_text');
//     // });

//     // it('should throw error when content is missing updated marker', () => {
//     //     const content = "<<UPD\nfilename\noriginal_text\n----\nupdated_text\n";
//     //     const result = parseLLMResp.find_original_update_blocks(content);

//     //     expect(() => result.next()).toThrowError('Expected >>UPD not undefined');
//     // });
// });
const edit = `
Here's the change:

~~~
foo.txt
<<<<<<< HEAD
Two
=======
Tooooo
>>>>>>> updated
~~~

Hope you like it!
`;
console.log(parseLLMResp.find_original_update_blocks(edit));
