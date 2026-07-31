const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
const uploadRoute = require('./routes/uploadRoute');
const aiRoute = require('./routes/aiRoute');
const conceptRoute = require('./routes/conceptRoute');
const explanationRoute = require('./routes/explanationRoute');
const mediaRoute = require('./routes/mediaRoute');

// Basic health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'ConceptBridge API is running' });
});

app.use('/api/upload', uploadRoute);
app.use('/api/ai', aiRoute);
app.use('/api/concepts', conceptRoute);
app.use('/api/explanation', explanationRoute);
app.use('/api/media', mediaRoute);

// Error handling middleware
app.use((err, req, res, next) => {
    // Only log error in development, avoid leaking stack traces in production
    if (process.env.NODE_ENV !== 'production') {
        console.error('Unhandled Server Error:', err);
    }
    
    res.status(err.status || 500).json({
        success: false,
        error: 'An unexpected server error occurred.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`Server running safely on port ${PORT}`);
});
