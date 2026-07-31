const express = require('express');
const { detectConcepts } = require('../controllers/conceptController');

const router = express.Router();

router.post('/detect', detectConcepts);

module.exports = router;
