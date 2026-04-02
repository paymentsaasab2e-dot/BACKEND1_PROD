const { Router } = require('express');
const { getCareerPath, startMission, addRoadmapItem, updateRoadmapItem, removeRoadmapItem, getPlannedItem, getNextAction, updateCareerPath } = require('../controllers/careerpath.controller');
const { validateAddRoadmap, validateUpdateRoadmap } = require('../validators/careerpath.validator');

const router = Router();

router.get('/', getCareerPath);
router.post('/', updateCareerPath);
router.post('/start', startMission);
router.post('/roadmap/add', validateAddRoadmap, addRoadmapItem);
router.put('/roadmap/:itemId', validateUpdateRoadmap, updateRoadmapItem);
router.delete('/roadmap/:itemId', removeRoadmapItem);
router.get('/planned/:itemId', getPlannedItem);
router.get('/next-action', getNextAction);

module.exports = router;
