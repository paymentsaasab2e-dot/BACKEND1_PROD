const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Returns an instance of OpenAI Client
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Returns an instance of Anthropic Client
 */
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_anthropic_key') return null;
  return new Anthropic({ apiKey });
}

/**
 * Returns an instance of Google Gemini Client
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Helper to extract JSON from markdown fences
 */
function extractJson(text = '') {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
    
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  
  if (start === -1 || end === -1) {
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1) {
      return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
    }
    throw new Error('AI did not return valid JSON');
  }
  
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---------------------------------------------------------
// LMS AI FUNCTIONS WITH MULTI-PROVIDER FALLBACK
// ---------------------------------------------------------

async function generateDashboardInsight(userState) {
  const prompt = `You are a personalized LMS coaching assistant. Analyze the user state and provide one primary insight on what they should do next.
User State:
${JSON.stringify(userState, null, 2)}

Return ONLY valid JSON with no markdown in this format:
{
  "primaryInsight": "A single sentence insight.",
  "reason": "Brief reason why.",
  "ctaRoute": "/lms/courses"
}`;

  // Try Anthropic first
  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      });
      return extractJson(message.content[0].text);
    }
  } catch (e) {
    console.warn('Anthropic failed, falling back to OpenAI...', e.message);
  }

  // Fallback to OpenAI
  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (e) {
    console.error('OpenAI also failed:', e.message);
  }

  return {
    primaryInsight: "Keep up the momentum in your current career path.",
    reason: "Consistent learning leads to better outcomes.",
    ctaRoute: "/lms/career-path"
  };
}

async function generateInterviewQuestions(topic, role, count, difficulty) {
  const prompt = `Generate ${count} ${difficulty} level interview questions.
Topic: ${topic}
Target Role: ${role}

Return ONLY a JSON array of objects with this shape:
[
  { "id": "q1", "text": "Question text here..." }
]`;

  // Try OpenAI first for question generation (usually more uniform JSON)
  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (e) {
    console.warn('OpenAI failed for questions, trying Anthropic...', e.message);
  }

  // Fallback to Anthropic
  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }]
      });
      return extractJson(message.content[0].text);
    }
  } catch (e) {
    console.error('Anthropic also failed:', e.message);
  }

  return [{ id: 'error-q1', text: `Could not generate questions for ${topic} at this time.` }];
}

async function scoreInterviewAnswer(question, answer) {
  const prompt = `Evaluate the following interview answer.
Question: ${question}
User Answer: ${answer}

Provide feedback and return ONLY a JSON object with this shape:
{
  "strengthsArray": ["strength 1", "strength 2"],
  "improvementsArray": ["improvement 1", "improvement 2"],
  "rewrittenAnswer": "A strong, professional way to answer this question.",
  "score": 8.5
}`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('scoreInterviewAnswer error:', error);
  }

  return {
    strengthsArray: ['Answer recorded.'],
    improvementsArray: ['AI scoring temporarily unavailable.'],
    rewrittenAnswer: answer,
    score: 5
  };
}

async function scoreAllSessionAnswers(questionsWithAnswers) {
  const prompt = `Evaluate an entire mock interview session.
Session details:
${JSON.stringify(questionsWithAnswers, null, 2)}

Return ONLY a JSON object with this shape:
{
  "overallScore": 8.0,
  "feedback": {
    "question_id_here": {
      "strengthsArray": [],
      "improvementsArray": [],
      "rewrittenAnswer": "",
      "score": 8
    }
  }
}`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('scoreAllSessionAnswers error:', error);
  }

  const fallbackFeedback = {};
  questionsWithAnswers.forEach(q => {
    fallbackFeedback[q.id] = {
      strengthsArray: ['Recorded'],
      improvementsArray: ['Unavailable'],
      rewrittenAnswer: q.userAnswer || '',
      score: 5
    };
  });
  return { overallScore: 5, feedback: fallbackFeedback };
}

async function generateNoteAction(noteBody, action) {
  const prompt = `Perform the following action on the provided note text.
Action: ${action}
Note Text:
${noteBody}

Return ONLY the output string in plain text (or markdown).`;

  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });
      return message.content[0].text.trim();
    }
  } catch (e) {
    console.warn('Anthropic failed for note action, trying OpenAI...', e.message);
  }

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      });
      return completion.choices[0].message.content.trim();
    }
  } catch (e) {
    console.error('OpenAI also failed for note action:', e.message);
  }

  return "AI generation failed. Please try again later.";
}

async function improveResumeSection(section, content, targetRole) {
  const prompt = `Improve this resume section.
Section: ${section}
Target Role: ${targetRole}
Current Content: ${content}

Return ONLY the improved content in plain text.`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      return completion.choices[0].message.content.trim();
    }
  } catch (error) {
    console.error('improveResumeSection error:', error);
  }
  return content;
}

async function generateResumeSummary(headline, experienceContext = '') {
  const prompt = `You are a professional resume writer for high-end roles. Generate a compelling, 3-5 line professional summary for a candidate.
Candidate Headline: ${headline}
${experienceContext ? `Key Experience Context: ${experienceContext}` : ''}

CRITICAL INSTRUCTIONS:
1. Start with a strong role identification.
2. Highlight core strengths and quantifiable impact.
3. Keep it professional, sharp, and ATS-friendly.
4. Maximum 200 words.
5. Return ONLY the summary text, no conversational filler.

Return ONLY the summary text directly.`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      return completion.choices[0].message.content.trim();
    }
  } catch (error) {
    console.warn('OpenAI failed for summary, trying Anthropic...', error.message);
  }

  // Fallback to Anthropic
  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });
      return message.content[0].text.trim();
    }
    
    throw new Error('AI providers not configured (OPENAI_API_KEY/ANTHROPIC_API_KEY missing)');
  } catch (error) {
    console.error('generateResumeSummary final error:', error);
    throw new Error('Failed to generate summary with AI: ' + error.message);
  }
}

async function checkResumeATS(resumeData, jobDescription) {
  const prompt = `Act as an ATS (Applicant Tracking System). Compare this resume to the job description.
Job Description:
${jobDescription}
Resume:
${JSON.stringify(resumeData, null, 2)}

Return ONLY a JSON object with this shape:
{
  "matchScore": 85,
  "missingKeywords": [],
  "suggestions": []
}`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('checkResumeATS error:', error);
  }
  return { matchScore: 0, missingKeywords: [], suggestions: ["ATS checking unavailable at this time."] };
}

async function getCompanyResearchData(companyName) {
  const prompt = `Provide research data for the company: ${companyName}.
Return ONLY a JSON object with this shape:
{
  "name": "${companyName}",
  "overview": "...",
  "culture": "...",
  "commonInterviewTopics": [],
  "suggestedQuestions": []
}`;

  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 600,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      });
      return extractJson(message.content[0].text);
    }
  } catch (e) {
    console.warn('Anthropic failed for research, trying OpenAI...', e.message);
  }

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (e) {
    console.error('OpenAI also failed for research:', e.message);
  }

  return {
    name: companyName,
    overview: 'Data temporarily unavailable.',
    culture: 'Unknown',
    commonInterviewTopics: [],
    suggestedQuestions: []
  };
}

module.exports = {
  generateDashboardInsight,
  generateInterviewQuestions,
  scoreInterviewAnswer,
  scoreAllSessionAnswers,
  generateNoteAction,
  improveResumeSection,
  generateResumeSummary,
  checkResumeATS,
  getCompanyResearchData
};
