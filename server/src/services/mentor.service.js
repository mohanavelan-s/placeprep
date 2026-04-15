const {
  getAIStatus,
  getOpenAIClient,
  markAIUnavailable,
  markAIWorking,
  normalizeErrorReason,
} = require('../config/openai');
const mentorMessageRepository = require('../repositories/mentorMessage.repository');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const AppError = require('../utils/appError');

function buildFallbackReply(message, context) {
  const lowered = message.toLowerCase();
  const focusTopic = context.targetTopics[0] || context.weakAreas[0] || 'your next weak area';

  if (/dynamic programming|dp/.test(lowered)) {
    return [
      'State first. Transition second. Code last.',
      'Define the subproblem in one sentence, write the recurrence, test the smallest base case, then dry-run one example before coding.',
      `Practice next: House Robber, Coin Change, and one ${focusTopic} follow-up.`,
    ].join(' ');
  }

  if (/system design|design/.test(lowered)) {
    return [
      'Start with scale, read/write ratio, and the single most important failure mode.',
      'Then choose the core data model and request path before you talk about caches or queues.',
      'Keep each tradeoff defensible.',
    ].join(' ');
  }

  if (/dbms|sql|database/.test(lowered)) {
    return [
      'Answer from first principles: schema shape, index choice, query path, then tradeoffs.',
      'If performance is the concern, say what you would measure before changing the design.',
    ].join(' ');
  }

  return [
    `Focus on ${focusTopic} before chasing breadth.`,
    'Break the problem into what is given, what must be produced, and what repeated operation is still expensive.',
    'Then pick one pattern, dry-run a tiny example, and only write code when the invariant is clear.',
  ].join(' ');
}

async function getContext(user) {
  const latestPlan = await prepPlanRepository.findLatestActiveByUser(user.id);

  return {
    latestPlan,
    knownTopics: latestPlan?.knownTopics || user.strongTopics || [],
    targetTopics: latestPlan?.targetTopics || user.weakAreas || [],
    weakAreas: user.weakAreas || [],
    targetRole: latestPlan?.targetRole || user.targetRole || 'placements',
  };
}

async function requestMentorReply(message, history, context) {
  const currentStatus = getAIStatus();
  const fallbackReply = buildFallbackReply(message, context);

  if (currentStatus.fallbackMode && ['quota_exceeded', 'no_key'].includes(currentStatus.reason)) {
    return {
      reply: fallbackReply,
      usedFallback: true,
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    return {
      reply: fallbackReply,
      usedFallback: true,
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: currentStatus.model,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: [
            'Act as a strict placement mentor.',
            '',
            'User context:',
            `* Known topics: ${context.knownTopics.join(', ') || 'Not enough data'}`,
            `* Weak areas: ${context.weakAreas.join(', ') || 'Execution discipline'}`,
            `* Goal: placements for ${context.targetRole}`,
            '',
            'Respond:',
            '* Clearly',
            '* Concisely',
            '* No fluff',
            '* Guide, do not spoon-feed',
          ].join('\n'),
        },
        ...history.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const reply = String(response.choices[0]?.message?.content || '').trim() || fallbackReply;
    markAIWorking();

    return {
      reply,
      usedFallback: false,
    };
  } catch (error) {
    const reason = normalizeErrorReason(error);
    if (reason) {
      markAIUnavailable(reason, error);
    }

    return {
      reply: fallbackReply,
      usedFallback: true,
    };
  }
}

async function sendMessage(user, payload = {}) {
  const message = String(payload.message || '').trim();
  if (!message) {
    throw new AppError('Message is required.', 400);
  }

  const context = await getContext(user);
  const history = await mentorMessageRepository.listRecentByUser(user.id, 12);

  const userMessage = await mentorMessageRepository.createMessage({
    userId: user.id,
    role: 'user',
    content: message,
  });

  const { reply, usedFallback } = await requestMentorReply(message, history.slice(-10), context);

  const assistantMessage = await mentorMessageRepository.createMessage({
    userId: user.id,
    role: 'assistant',
    content: reply,
    metadata: {
      usedFallback,
    },
  });

  return {
    reply,
    usedFallback,
    message: assistantMessage,
    history: [...history, userMessage, assistantMessage].slice(-20),
  };
}

async function getHistory(user) {
  return mentorMessageRepository.listRecentByUser(user.id, 30);
}

async function clearHistory(user) {
  const deleted = await mentorMessageRepository.deleteByUser(user.id);
  return {
    deleted,
    clearedAt: new Date().toISOString(),
  };
}

module.exports = {
  sendMessage,
  getHistory,
  clearHistory,
};
