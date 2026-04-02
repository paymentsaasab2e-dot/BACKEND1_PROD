const { prisma } = require('../../lib/prisma');

function resolveTitle(modelData, targetType) {
  if (!modelData) return 'Unknown Target';
  if (targetType === 'resume') return 'Resume Builder';
  return modelData.title || targetType;
}

function resolveRoute(targetType, targetId) {
  switch (targetType) {
    case 'course': return `/lms/courses/${targetId}`;
    case 'quiz': return `/lms/quizzes/${targetId}`;
    case 'event': return `/lms/events/${targetId}`;
    case 'resume': return '/lms/resume-builder';
    case 'interview': return `/lms/interview-prep/mock/${targetId}`; // Assuming valid session or category
    default: return '/lms/career-path';
  }
}

async function fetchCareerPath(userId) {
  let cp = await prisma.lmsCareerPath.findUnique({
    where: { userId }
  });

  if (!cp) {
    cp = await prisma.lmsCareerPath.create({
      data: {
        userId,
        missionStarted: false,
        currentPhase: 'foundation',
        roadmapItems: []
      }
    });
  }

  // Enrich with resolved values conceptually (frontend will fetch actual target if needed or use static title)
  const enriched = (cp.roadmapItems || []).map(item => ({
    ...item,
    resolvedTargetRoute: item.targetRoute || resolveRoute(item.targetType, item.targetId),
    resolvedTargetTitle: item.title // Rely on title from creation
  }));

  return { ...cp, roadmapItems: enriched };
}

async function startMission(userId) {
  let cp = await prisma.lmsCareerPath.findUnique({
    where: { userId }
  });

  if (!cp) {
    cp = await prisma.lmsCareerPath.create({
      data: { userId, roadmapItems: [] }
    });
  }

  return prisma.lmsCareerPath.update({
    where: { userId },
    data: {
      missionStarted: true,
      currentPhase: 'foundation'
    }
  });
}

async function addRoadmapItem(userId, payload) {
  let cp = await fetchCareerPath(userId);

  const newItem = {
    id: `rt_${Date.now()}`,
    title: payload.title,
    phase: payload.phase,
    targetType: payload.targetType,
    targetId: payload.targetId || null,
    targetRoute: payload.targetRoute || null,
    reason: payload.reason,
    status: 'planned',
    skills: Array.isArray(payload.skills) ? payload.skills : []
  };

  const currentItems = cp.roadmapItems || [];
  return prisma.lmsCareerPath.update({
    where: { userId },
    data: { roadmapItems: [...currentItems, newItem] }
  });
}

function calculateCurrentPhase(items) {
  // Simple heuristic based on distribution:
  // foundation, core, mastery, job-ready
  const phases = ['foundation', 'core', 'mastery', 'job-ready'];
  let highestPhase = 'foundation';

  for (const phase of phases) {
    const phaseItems = items.filter(i => i.phase === phase);
    // If >50% of this phase is completed or in-progress, we are at this phase conceptually
    const completedCount = phaseItems.filter(i => i.status === 'completed' || i.status === 'in-progress').length;
    if (phaseItems.length > 0 && (completedCount / phaseItems.length) >= 0.5) {
      highestPhase = phase;
    }
  }

  return highestPhase;
}

async function updateRoadmapItem(userId, itemId, payload) {
  const { status, completedAt } = payload;
  const cp = await fetchCareerPath(userId);

  const items = cp.roadmapItems || [];
  const updatedItems = items.map(item => {
    if (item.id === itemId || item.id === itemId) { // check string eq
      return {
        ...item,
        status,
        ...(status === 'completed' && { completedAt: completedAt || new Date().toISOString() })
      };
    }
    return item;
  });

  const nextPhase = calculateCurrentPhase(updatedItems);

  return prisma.lmsCareerPath.update({
    where: { userId },
    data: { 
      roadmapItems: updatedItems,
      currentPhase: nextPhase
    }
  });
}

async function removeRoadmapItem(userId, itemId) {
  const cp = await fetchCareerPath(userId);
  const items = (cp.roadmapItems || []).filter(item => item.id !== itemId);

  return prisma.lmsCareerPath.update({
    where: { userId },
    data: { roadmapItems: items }
  });
}

async function upsertCareerPath(userId, payload) {
  const { currentPhase, roadmapItems, missionStarted } = payload;
  
  return prisma.lmsCareerPath.upsert({
    where: { userId },
    update: {
      currentPhase,
      roadmapItems,
      missionStarted
    },
    create: {
      userId,
      currentPhase: currentPhase || 'foundation',
      roadmapItems: roadmapItems || [],
      missionStarted: missionStarted || false
    }
  });
}

async function fetchTargetDetails(targetType, targetId) {
  if (!targetId) return null;
  switch (targetType) {
    case 'course': return prisma.lmsCourse.findUnique({ where: { id: targetId } });
    case 'quiz': return prisma.lmsQuiz.findUnique({ where: { id: targetId } });
    case 'event': return prisma.lmsEvent.findUnique({ where: { id: targetId } });
    // etc
    default: return null;
  }
}

async function fetchPlannedItem(userId, itemId) {
  const cp = await fetchCareerPath(userId);
  const item = (cp.roadmapItems || []).find(i => i.id === itemId);

  if (!item) return null;

  const targetDetails = await fetchTargetDetails(item.targetType, item.targetId);

  return {
    ...item,
    resolvedTargetRoute: item.targetRoute || resolveRoute(item.targetType, item.targetId),
    targetDetails
  };
}

async function fetchNextAction(userId) {
  const cp = await fetchCareerPath(userId);
  const items = cp.roadmapItems || [];

  // Find first in-progress or planned
  const inProgress = items.find(i => i.status === 'in-progress');
  if (inProgress) {
    const targetDetails = await fetchTargetDetails(inProgress.targetType, inProgress.targetId);
    return { ...inProgress, targetDetails, resolvedTargetRoute: inProgress.targetRoute || resolveRoute(inProgress.targetType, inProgress.targetId) };
  }

  const planned = items.find(i => i.status === 'planned');
  if (planned) {
    const targetDetails = await fetchTargetDetails(planned.targetType, planned.targetId);
    return { ...planned, targetDetails, resolvedTargetRoute: planned.targetRoute || resolveRoute(planned.targetType, planned.targetId) };
  }

  return null;
}

module.exports = {
  fetchCareerPath,
  startMission,
  addRoadmapItem,
  updateRoadmapItem,
  removeRoadmapItem,
  fetchPlannedItem,
  fetchNextAction,
  upsertCareerPath
};
