const express = require('express');
const { generateExplanation } = require('../controllers/explanationController');

const router = express.Router();

router.post('/', generateExplanation);

module.exports = router;
