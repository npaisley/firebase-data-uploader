# Firebase Quiz App Uploader

A tool to upload quiz data to Firebase Firestore.

## Setup for Safe Git Usage

This project has been configured to safely store Firebase credentials outside of version control to prevent accidental exposure of sensitive information.

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a data directory for your JSON files:
   ```
   mkdir -p data
   ```

### Firebase Credentials Setup

You have three options for providing Firebase credentials:

#### Option 1: Create a .env file (Recommended)

1. Copy the `.env.example` file to a new file named `.env`:
   ```
   cp .env.example .env
   ```

2. Edit the `.env` file with your actual Firebase credentials. Choose one of the methods:
   - Method 1: Paste your entire service account JSON as a single line
   - Method 2: Provide the path to your service account JSON file (can be absolute or relative)
     - Examples:
       - Absolute: `/home/user/keys/serviceAccountKey.json`
       - Relative: `./config/serviceAccountKey.json` or `../secure/serviceAccountKey.json`
   - Method 3: Enter individual credential components (project ID, private key, client email)

#### Option 2: Environment Variables

Set the environment variables directly when running the script:
```
FIREBASE_SERVICE_ACCOUNT_PATH=./config/serviceAccountKey.json node upload.js data/*.json
```

### Usage

This tool supports multiple ways to upload data:

#### 1. Process all JSON files in the data directory (default)

If no specific files are provided, the script will look for all JSON files in the `./data` directory:

```
node upload.js
```

Or use the npm script:
```
npm run upload
```

#### 2. Specify one or more JSON files

You can specify one or more JSON files to process:

```
node upload.js data/quiz1.json data/quiz2.json
```

Or using wildcard patterns:
```
node upload.js data/*.json
```

Or use the npm script:
```
npm run upload:data
```

#### 3. Data File Structure

Each JSON file should contain `topics` and/or `quizzes` arrays. The script will merge data from all files before uploading.

### Git Safety

The following files are included in `.gitignore` to ensure credentials aren't accidentally committed:
- `.env` file containing environment variables
- Any `.json` files (except package.json and package-lock.json)
- Specifically any Firebase service account JSON files

### Safety Tips

1. **Never commit your Firebase credentials** to Git.
2. Double-check that your `.env` file and service account JSON files are listed in `.gitignore`.
3. Run `git status` before committing to ensure no sensitive files are staged.
4. Consider using a tool like [git-secrets](https://github.com/awslabs/git-secrets) to prevent accidental commits of sensitive information.