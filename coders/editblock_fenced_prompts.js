const EditBlockPrompts = require('./editblock_prompts');

// Import the necessary modules, if any

class EditBlockFencedPrompts extends EditBlockPrompts {
    constructor() {
        super();
        this.exampleMessages = [
            {
                role: "user",
                content: "Change get_factorial() to use math.factorial",
            },
            {
                role: "assistant",
                content: `To make this change we need to modify \`mathweb/flask/app.py\` to:

1. Import the math package.
2. Remove the existing factorial() function.
3. Update get_factorial() to call math.factorial instead.

Here are the *SEARCH/REPLACE* blocks:

\`\`\`
mathweb/flask/app.py
<<<<<<< SEARCH
from flask import Flask
=======
import math
from flask import Flask
>>>>>>> REPLACE
\`\`\`

\`\`\`
mathweb/flask/app.py
<<<<<<< SEARCH
def factorial(n):
    "compute factorial"

    if n == 0:
        return 1
    else:
        return n * factorial(n-1)

=======
>>>>>>> REPLACE
\`\`\`

\`\`\`
mathweb/flask/app.py
<<<<<<< SEARCH
    return str(factorial(n))
=======
    return str(math.factorial(n))
>>>>>>> REPLACE
\`\`\`
`,
            },
            {
                role: "user",
                content: "Refactor hello() into its own file.",
            },
            {
                role: "assistant",
                content: `To make this change we need to modify \`main.py\` and make a new file \`hello.py\`:

1. Make a new hello.py file with hello() in it.
2. Remove hello() from main.py and replace it with an import.

Here are the *SEARCH/REPLACE* blocks:

\`\`\`
hello.py
<<<<<<< SEARCH
=======
def hello():
    "print a greeting"

    print("hello")
>>>>>>> REPLACE
\`\`\`

\`\`\`
main.py
<<<<<<< SEARCH
def hello():
    "print a greeting"

    print("hello")
=======
from hello import hello
>>>>>>> REPLACE
\`\`\`
`,
            },
        ];
    }
}


// Export the class if it needs to be used in other files
module.exports = EditBlockFencedPrompts;
