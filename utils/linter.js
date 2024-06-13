const linter = {
    languages: {
        python: "pylint",
    },
    all_lint_cmd: null,
    constructor(encoding = "utf-8", root = null) {
        this.encoding = encoding;
        this.root = root;
        this.languages = {
            python: this.py_lint,
        };
    },

    set_linter(lang, cmd) {
        if (lang) {
            this.languages[lang] = cmd;
            return;
        }
        this.all_lint_cmd = cmd;
    },
    
}