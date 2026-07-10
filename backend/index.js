const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const { extractConcepts, explainConcept, explainSelection } = require('./utils/openai');
const { searchYouTube } = require('./utils/youtube');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger text inputs

// Ensure temp directory exists for uploads
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name to prevent collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer Filter to only accept PDF files
const fileFilter = (req, file, cb) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (fileExtension === '.pdf' || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB PDF size limit
});

// API Routes

/**
 * 1. PDF Upload
 * POST /api/upload
 */
app.post('/api/upload', (req, res) => {
  upload.single('pdf')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer Upload Error:', err);
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      console.error('File Validation Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file selected.' });
    }

    console.log(`Successfully uploaded: ${req.file.originalname} -> ${req.file.filename}`);
    
    res.json({
      success: true,
      originalName: req.file.originalname,
      filePath: req.file.path
    });
  });
});

/**
 * 2. PDF Text Extraction
 * POST /api/extract
 */
app.post('/api/extract', async (req, res) => {
  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'filePath is required.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Uploaded file not found.' });
  }

  try {
    console.log(`Extracting text from: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const parsedData = await pdfParse(dataBuffer);

    // Clean up temporary file after extraction to keep backend clean
    try {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up temp file: ${filePath}`);
    } catch (unlinkError) {
      console.warn('Failed to delete temp file:', unlinkError.message);
    }

    if (!parsedData.text || parsedData.text.trim().length === 0) {
      return res.status(400).json({ error: 'The uploaded PDF appears to be empty or contains no extractable text.' });
    }

    console.log(`Extracted ${parsedData.text.length} characters of text.`);
    res.json({
      success: true,
      text: parsedData.text
    });
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    res.status(500).json({ error: `Text extraction failed: ${error.message}` });
  }
});

/**
 * 3. Concept Extraction
 * POST /api/concepts
 */
app.post('/api/concepts', async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text content is required for concept extraction.' });
  }

  try {
    console.log('Extracting concepts using AI...');
    const concepts = await extractConcepts(text);
    console.log(`Extracted concepts: ${JSON.stringify(concepts)}`);
    res.json({
      success: true,
      concepts
    });
  } catch (error) {
    console.error('Concept extraction endpoint failed:', error);
    res.status(500).json({ error: `AI Concept extraction failed: ${error.message}` });
  }
});

/**
 * 4. Concept Explanation
 * POST /api/explain
 */
app.post('/api/explain', async (req, res) => {
  const { concept, language } = req.body;

  if (!concept || concept.trim().length === 0) {
    return res.status(400).json({ error: 'Concept name is required.' });
  }

  const targetLang = language || 'Telugu';

  try {
    console.log(`Generating explanation for concept: "${concept}" in language: "${targetLang}"`);
    
    // Call explanation generator
    const explanationResult = await explainConcept(concept, targetLang);
    
    // Call YouTube search with localized language query
    const youtubeVideos = await searchYouTube(`${concept} explanation in ${targetLang}`);

    const responsePayload = {
      concept: explanationResult.concept || concept,
      nativeTranslation: explanationResult.nativeTranslation || explanationResult.teluguTranslation || '',
      simpleExplanation: explanationResult.simpleExplanation || '',
      nativeExplanation: explanationResult.nativeExplanation || explanationResult.teluguExplanation || '',
      realWorldExample: explanationResult.realWorldExample || '',
      keyTakeaways: explanationResult.keyTakeaways || [],
      youtubeVideos: youtubeVideos || []
    };

    console.log(`Successfully explained concept: "${concept}" in ${targetLang}`);
    res.json(responsePayload);
  } catch (error) {
    console.error(`Explanation failed for concept: "${concept}" in ${targetLang}`, error);
    res.status(500).json({ error: `Failed to explain concept: ${error.message}` });
  }
});

/**
 * 5. Explain Selection
 * POST /api/explain-selection
 */
app.post('/api/explain-selection', async (req, res) => {
  const { text, language } = req.body;

  if (!text || text.trim().length < 5) {
    return res.status(400).json({ error: 'Selected text is too short to explain.' });
  }

  const targetLang = language || 'Telugu';

  try {
    console.log(`Generating explanation for text selection in language: "${targetLang}"`);
    
    // Generate explanation first
    const explanationResult = await explainSelection(text, targetLang);
    
    // Search YouTube using the cleaned concept title in the target language
    const conceptLabel = explanationResult.concept || 'Concept';
    const youtubeVideos = await searchYouTube(`${conceptLabel} explanation in ${targetLang}`);

    const responsePayload = {
      concept: conceptLabel,
      nativeTranslation: explanationResult.nativeTranslation || explanationResult.teluguTranslation || '',
      simpleExplanation: explanationResult.simpleExplanation || '',
      nativeExplanation: explanationResult.nativeExplanation || explanationResult.teluguExplanation || '',
      realWorldExample: explanationResult.realWorldExample || explanationResult.analogy || '',
      keyTakeaways: explanationResult.keyTakeaways || [],
      youtubeVideos: youtubeVideos || []
    };

    console.log(`Successfully explained custom selection: "${responsePayload.concept}" in ${targetLang}`);
    res.json(responsePayload);
  } catch (error) {
    console.error(`Explanation failed for custom selection in ${targetLang}:`, error);
    res.status(500).json({ error: `Failed to explain text selection: ${error.message}` });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`ConceptBridge Backend running on http://localhost:${PORT}`);
});
