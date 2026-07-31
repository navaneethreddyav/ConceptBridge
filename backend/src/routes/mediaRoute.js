const express = require('express');
const { getMedia } = require('../controllers/mediaController');

const router = express.Router();

router.post('/', getMedia);

module.exports = router;
