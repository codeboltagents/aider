const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const pathspec = require('pathspec');
const codebolt = require('@codebolt/codeboltjs').default;
const {commit_system} = require('./prompts');
const utils  = require('./codeEdit');

// const { simple_send_with_retries } = require('./sendchat');

class GitRepo {
    static repo = null;
    static aider_ignore_file = null;
    static aider_ignore_spec = null;
    static aider_ignore_ts = 0;

    constructor( fnames , attribute_author = true, attribute_committer = true) {
        // this.io = io;
        // this.models = models;

        this.attribute_author = attribute_author;
        this.attribute_committer = attribute_committer;
        let git_dname='/Users/ravirawat/Desktop/codebolt/testing'
        let check_fnames = [];
        if (git_dname) {
            check_fnames = [git_dname];
        } else if (fnames) {
            check_fnames = fnames;
        } else {
            check_fnames = ['.'];
        }

        const repo_paths = [];
        check_fnames.forEach(fname => {
            fname = path.resolve(fname);

            if (!fs.existsSync(fname) && fs.existsSync(path.dirname(fname))) {
                fname = path.dirname(fname);
            }

            try {
                const repo_path = simpleGit(fname).revparse(['--show-toplevel']);
                repo_paths.push(repo_path);
            } catch (error) {
                if (error.message.includes('not a git repository')) {
                    // Handle the error
                }
            }
        });

        const num_repos = new Set(repo_paths).size;

        if (num_repos === 0) {
            throw new Error('FileNotFoundError');
        }
        if (num_repos > 1) {
            this.io.tool_error('Files are in different git repos.');
            throw new Error('FileNotFoundError');
        }

        this.repo = simpleGit(repo_paths.pop());
        this.root = utils.safe_abs_path(this.repo._baseDir||git_dname);

        // if (aider_ignore_file) {
        //     this.aider_ignore_file = aider_ignore_file;
        // }
    }

    async commit(fnames = null, context = null, message = null, aider_edits = false) {
        if (!fnames && !(await this.repo.status()).isClean()) {
            return;
        }

        const diffs = await this.get_diffs(fnames);
        if (!diffs) {
            return;
        }

        let commit_message = message ? message : await this.get_commit_message(diffs, context);
        if (!commit_message) {
            commit_message = '(no commit message provided)';
        }

        let full_commit_message = commit_message;
        if (context) {
            full_commit_message += `\n\n# Aider chat conversation:\n\n${context}`;
        }

        const cmd = ['-m', full_commit_message, '--no-verify'];
        if (fnames) {
            fnames = Array.from(fnames).map(fn => this.abs_root_path(fn));
            await this.repo.add('.');
            //  await this.repo.ad
            // await codebolt.git.add();

            cmd.push('--', ...fnames);
        } else {
            cmd.push('-a');
        }

        // const original_user_name = (await this.repo.raw(['config', 'user.name'])).trim();
        // const original_committer_name_env = process.env.GIT_COMMITTER_NAME;
        // const committer_name = `${original_user_name} (aider)`;

        // if (this.attribute_committer) {
        //     process.env.GIT_COMMITTER_NAME = committer_name;
        // }

        // if (aider_edits && this.attribute_author) {
        //     process.env.GIT_AUTHOR_NAME = committer_name;
        // }

        await this.repo.commit(full_commit_message);

        const commit_hash = (await this.repo.revparse(['HEAD'])).slice(0, 7);
    await codebolt.chat.sendMessage(`Commit ${commit_hash} ${commit_message}`)
        // this.io.tool_output(`Commit ${commit_hash} ${commit_message}`);

        // Restore the env
        // if (this.attribute_committer) {
        //     if (original_committer_name_env) {
        //         process.env.GIT_COMMITTER_NAME = original_committer_name_env;
        //     } else {
        //         delete process.env.GIT_COMMITTER_NAME;
        //     }
        // }

        // if (aider_edits && this.attribute_author) {
        //     const original_auther_name_env = process.env.GIT_AUTHOR_NAME;
        //     if (original_auther_name_env) {
        //         process.env.GIT_AUTHOR_NAME = original_auther_name_env;
        //     } else {
        //         delete process.env.GIT_AUTHOR_NAME;
        //     }
        // }

        return [commit_hash, commit_message];
    }

    get_rel_repo_dir() {
        try {
            return path.relative(process.cwd(), this.repo._baseDir);
        } catch (error) {
            return this.repo._baseDir;
        }
    }

    async get_commit_message(diffs, context) {
        if (diffs.length >= 4 * 1024 * 4) {
            this.io.tool_error('Diff is too large to generate a commit message.');
            return;
        }

        diffs = `# Diffs:\n${diffs}`;

        let content = '';
        if (context) {
            content += `${context}\n`;
        }
        content += diffs;

        const messages = [
            { role: 'system', content: commit_system },
            { role: 'user', content }
        ];

        let commit_message = '';
        // for (const model of this.models) {
            let {message} = await codebolt.llm.inference(messages);
            commit_message=message
            // if (commit_message) {
            //     break;
            // }
        // }

        if (!commit_message) {
            this.io.tool_error('Failed to generate commit message!');
            return;
        }

        commit_message = commit_message.trim();
        if (commit_message.startsWith('"') && commit_message.endsWith('"')) {
            commit_message = commit_message.slice(1, -1).trim();
        }

        return commit_message;
    }

    async get_diffs(fnames = null) {
        let current_branch_has_commits = false;
        try {
            const active_branch = await this.repo.revparse(['--abbrev-ref', 'HEAD']);
            try {
                const commits = await this.repo.log([active_branch.trim()]);
                current_branch_has_commits = commits.total > 0;
            } catch (error) {
                // handle error
            }
        } catch (error) {
            // handle error
        }

        if (!fnames) {
            fnames = [];
        }

        let diffs = '';
        for (const fname of fnames) {
            if (!(await this.path_in_repo(fname))) {
                diffs += `Added ${fname}\n`;
            }
        }

        if (current_branch_has_commits) {
            diffs += await this.repo.diff(['HEAD', '--', ...fnames]);
            return diffs;
        }

        diffs += await this.repo.diff(['--cached', '--', ...fnames]);
        diffs += await this.repo.diff(['--', ...fnames]);

        return diffs;
    }

    async diff_commits(pretty, from_commit, to_commit) {
        const args = [];
        if (pretty) {
            args.push('--color');
        }

        args.push(from_commit, to_commit);
        return await this.repo.diff(args);
    }

    async get_tracked_files() {
        if (!this.repo) {
            return [];
        }

        let commit;
        try {
            commit = await this.repo.raw(['rev-parse', 'HEAD']);
        } catch (error) {
            commit = null;
        }

        const files = [];
        if (commit) {
            const tree = await this.repo.raw(['ls-tree', '-r', 'HEAD', '--name-only']);
            files.push(...tree.split('\n').filter(Boolean));
        }

        const staged_files = (await this.repo.raw(['diff', '--cached', '--name-only'])).split('\n').filter(Boolean);
        files.push(...staged_files);

        const res = new Set(files.map(f => this.normalize_path(f)));
        return [...res].filter(fname => !this.ignored_file(fname));
    }

    normalize_path(p) {
        return path.relative(this.root, path.resolve(this.root, p)).replace(/\\/g, '/');
    }

    ignored_file(fname) {
        if (!this.aider_ignore_file || !fs.existsSync(this.aider_ignore_file)) {
            return false;
        }

        try {
            fname = this.normalize_path(fname);
        } catch (error) {
            return false;
        }

        const mtime = fs.statSync(this.aider_ignore_file).mtimeMs;
        if (mtime !== this.aider_ignore_ts) {
            this.aider_ignore_ts = mtime;
            const lines = fs.readFileSync(this.aider_ignore_file, 'utf-8').split('\n').filter(Boolean);
            this.aider_ignore_spec = pathspec.fromSpec({ patterns: lines });
        }

        return this.aider_ignore_spec.match(fname);
    }

    async path_in_repo(p) {
        if (!this.repo) {
            return false;
        }

        const tracked_files = new Set(await this.get_tracked_files());
        return tracked_files.has(this.normalize_path(p));
    }

    abs_root_path(p) {
        return utils.safe_abs_path(path.resolve(this.root, p));
    }

    async get_dirty_files() {
        const dirty_files = new Set();

        const staged_files = (await this.repo.diff(['--name-only', '--cached'])).split('\n').filter(Boolean);
        dirty_files.add(...staged_files);

        const unstaged_files = (await this.repo.diff(['--name-only'])).split('\n').filter(Boolean);
        dirty_files.add(...unstaged_files);

        return [...dirty_files];
    }

    async is_dirty(p = null) {
        if (p && !(await this.path_in_repo(p))) {
            return true;
        }

        return (await this.repo.status()).isClean() === false;
    }
}

module.exports = GitRepo;
