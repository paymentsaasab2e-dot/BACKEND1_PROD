const { Router } = require('express');
const {
  askProfileQuestions,
  suggestJobTitles,
  extractProfileData,
} = require('../controllers/ai.controller');

const router = Router();

router.post('/profile-questions', askProfileQuestions);
router.post('/job-title-suggestions', suggestJobTitles);
router.post('/extract-profile-data', extractProfileData);

module.exports = router;
