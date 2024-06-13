
const codebolt = require('@codebolt/codeboltjs').default;
const gitUtils = {
    addToGitIgnore: async function (filenames) {
        try {
            const gitIgnoreFile = await codebolt.fs.readFile('.gitignore');
            const gitIgnorePatterns = gitIgnoreFile.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
            for (const file of filenames) {
                if (!gitIgnorePatterns.includes(file)) {
                    gitIgnorePatterns.push(file);
                    await codebolt.fs.updateFile('.gitignore', gitIgnorePatterns.join('\n'));
                }
            }
        } catch (error) {
            console.error('Error reading .gitignore file:', error);
        }
    },
    removeFromGitIgnore: async function (filenames) {
        try {
            const gitIgnoreFile = await codebolt.fs.readFile('.gitignore');
            let gitIgnorePatterns = gitIgnoreFile.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
            for (const file of filenames) {
                if (gitIgnorePatterns.includes(file)) {
                    gitIgnorePatterns = gitIgnorePatterns.filter(pattern => pattern !== file);
                    await codebolt.fs.updateFile('.gitignore', gitIgnorePatterns.join('\n'));
                }
            }
        } catch (error) {
            console.error('Error reading .gitignore file:', error);
        }
    },
}