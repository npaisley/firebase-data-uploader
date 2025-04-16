const admin = require('firebase-admin');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');
const glob = require('glob');

// Load environment variables from .env file
dotenv.config();

// Default data directory if no specific files are provided
const DEFAULT_DATA_DIR = './data';

// Get data files to process
let jsonFilePaths = [];
if (process.argv.length < 3) {
  console.log('No specific files provided, looking for JSON files in data directory...');
  try {
    jsonFilePaths = glob.sync(`${DEFAULT_DATA_DIR}/**/*.json`);
    if (jsonFilePaths.length === 0) {
      console.error(`No JSON files found in ${DEFAULT_DATA_DIR}`);
      console.error('Usage: node upload.js [optional: path-to-json-file(s)]');
      process.exit(1);
    }
    console.log(`Found ${jsonFilePaths.length} JSON files in data directory.`);
  } catch (error) {
    console.error('Error scanning data directory:', error);
    process.exit(1);
  }
} else {
  // Files specified as arguments
  jsonFilePaths = process.argv.slice(2);
  
  // Check if any specified files don't exist
  const missingFiles = jsonFilePaths.filter(file => !fs.existsSync(file));
  if (missingFiles.length > 0) {
    console.error('Error: The following files were not found:');
    missingFiles.forEach(file => console.error(`  - ${file}`));
    process.exit(1);
  }
}

// Read and parse all JSON files
const allData = {
  topics: [],
  quizzes: []
};

for (const jsonFilePath of jsonFilePaths) {
  try {
    const rawData = fs.readFileSync(jsonFilePath);
    const data = JSON.parse(rawData);
    console.log(`JSON file loaded successfully: ${jsonFilePath}`);
    
    // Validate data structure
    if (!data.topics && !data.quizzes) {
      console.warn(`Warning: File ${jsonFilePath} does not contain "topics" or "quizzes" arrays. Skipping.`);
      continue;
    }
    
    // Merge data
    if (data.topics) allData.topics = [...allData.topics, ...data.topics];
    if (data.quizzes) allData.quizzes = [...allData.quizzes, ...data.quizzes];
    
  } catch (error) {
    console.error(`Error parsing JSON file ${jsonFilePath}:`, error);
    process.exit(1);
  }
}

// Check if any data was found
if (allData.topics.length === 0 && allData.quizzes.length === 0) {
  console.error('Error: No valid quiz data found in the provided files.');
  process.exit(1);
}

console.log(`Total data loaded: ${allData.topics.length} topics and ${allData.quizzes.length} quizzes.`);

// Initialize Firebase
try {
  // Method 1: Using environment variables for service account details
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // If the full service account JSON is provided as an environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Initialized Firebase using environment variable');
  } 
  // Method 2: Using a service account file from a path specified in .env
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    let serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    // Handle relative paths
    if (!path.isAbsolute(serviceAccountPath)) {
      serviceAccountPath = path.resolve(process.cwd(), serviceAccountPath);
      console.log(`Converted relative path to absolute: ${serviceAccountPath}`);
    }
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found at ${serviceAccountPath}`);
    }
    
    // Read the file directly instead of using require to avoid caching issues
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log(`Initialized Firebase using service account from ${serviceAccountPath}`);
  } 
  // Method 3: Using individual credential parts from environment variables
  else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    };
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Initialized Firebase using individual credential environment variables');
  } else {
    throw new Error('No Firebase credentials provided. Set either FIREBASE_SERVICE_ACCOUNT, FIREBASE_SERVICE_ACCOUNT_PATH, or individual credential environment variables.');
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  process.exit(1);
}

const db = admin.firestore();

async function uploadData() {
  console.log('Starting upload...');
  
  // Use batched writes for better performance
  // Firestore has a limit of 500 operations per batch
  const batchSize = 450; // Leaving some margin for safety
  
  // Upload topics
  if (allData.topics.length > 0) {
    console.log(`Uploading ${allData.topics.length} topics...`);
    
    // Split topics into batches if needed
    for (let i = 0; i < allData.topics.length; i += batchSize) {
      const topicsBatch = db.batch();
      const chunk = allData.topics.slice(i, i + batchSize);
      
      chunk.forEach(topic => {
        const docRef = db.collection('topics').doc(topic.id);
        topicsBatch.set(docRef, {
          title: topic.title,
          description: topic.description,
          img: topic.img,
          quizzes: topic.quizzes
        });
        console.log(`Prepared topic: ${topic.title}`);
      });
      
      console.log(`Committing topics batch ${Math.floor(i/batchSize) + 1}...`);
      await topicsBatch.commit();
      console.log(`Batch ${Math.floor(i/batchSize) + 1} uploaded successfully!`);
    }
  } else {
    console.log('No topics to upload.');
  }
  
  // Upload quizzes
  if (allData.quizzes.length > 0) {
    console.log(`Uploading ${allData.quizzes.length} quizzes...`);
    
    // Split quizzes into batches if needed
    for (let i = 0; i < allData.quizzes.length; i += batchSize) {
      const quizzesBatch = db.batch();
      const chunk = allData.quizzes.slice(i, i + batchSize);
      
      chunk.forEach(quiz => {
        const docRef = db.collection('quizzes').doc(quiz.id);
        quizzesBatch.set(docRef, quiz);
        console.log(`Prepared quiz: ${quiz.id}`);
      });
      
      console.log(`Committing quizzes batch ${Math.floor(i/batchSize) + 1}...`);
      await quizzesBatch.commit();
      console.log(`Batch ${Math.floor(i/batchSize) + 1} uploaded successfully!`);
    }
  } else {
    console.log('No quizzes to upload.');
  }
  
  console.log('All data uploaded successfully!');
  process.exit(0);
}

uploadData().catch(error => {
  console.error('Error uploading data:', error);
  process.exit(1);
});