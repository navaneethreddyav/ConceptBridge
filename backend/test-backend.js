const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001';
const SAMPLE_PDF_PATH = path.join(__dirname, '../sample.pdf');

async function runTest() {
  console.log('--- STARTING BACKEND INTEGRATION TEST ---');
  
  if (!fs.existsSync(SAMPLE_PDF_PATH)) {
    console.error('Error: sample.pdf does not exist in root directory.');
    process.exit(1);
  }

  // We need the backend server running to run this test via HTTP.
  // Instead of HTTP, we can directly import the backend modules to test without launching the server!
  // This is much simpler and faster.
  
  try {
    // 1. Test PDF extraction
    console.log('\n1. Testing PDF text extraction...');
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(SAMPLE_PDF_PATH);
    const parsedData = await pdfParse(dataBuffer);
    console.log('PDF text extracted successfully.');
    console.log(`Text preview: "${parsedData.text.trim()}"`);

    // 2. Test OpenAI Concept Extraction
    console.log('\n2. Testing OpenAI concept extraction...');
    const { extractConcepts, explainConcept, explainSelection } = require('./utils/openai');
    // Ensure dotenv is loaded
    require('dotenv').config();
    
    const concepts = await extractConcepts(parsedData.text);
    console.log('Concepts extracted:', concepts);

    if (concepts.length === 0) {
      throw new Error('No concepts were extracted.');
    }

    // 3. Test Concept Explanation
    const testConcept = concepts[0];
    console.log(`\n3. Testing explanations for concept: "${testConcept}" in Hindi...`);
    const explanation = await explainConcept(testConcept, 'Hindi');
    console.log('Explanation result (Hindi):', JSON.stringify(explanation, null, 2));

    // 4. Test YouTube Search
    console.log(`\n4. Testing YouTube search for: "${testConcept} explanation in Hindi"...`);
    const { searchYouTube } = require('./utils/youtube');
    const videos = await searchYouTube(`${testConcept} explanation in Hindi`);
    console.log('YouTube Videos found:', JSON.stringify(videos, null, 2));

    // 5. Test Custom Selection Explanation
    const testSelection = "Deep Learning uses multi-layered networks to learn representations.";
    console.log(`\n5. Testing explanations for custom selection in Hindi: "${testSelection}"...`);
    const selectionExplanation = await explainSelection(testSelection, 'Hindi');
    console.log('Selection Explanation result (Hindi):', JSON.stringify(selectionExplanation, null, 2));

    console.log('\n--- ALL TEST PASSED SUCCESSFULLY ---');
  } catch (error) {
    console.error('\n--- TEST FAILED ---');
    console.error(error);
  }
}

runTest();
