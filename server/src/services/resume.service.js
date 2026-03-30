const resumeRepository = require('../repositories/resume.repository');
const { uploadBuffer } = require('./storage.service');
const aiService = require('./ai.service');
const AppError = require('../utils/appError');

function extractResumeText(file, providedText) {
  if (providedText) {
    return providedText.trim();
  }

  if (!file) {
    return '';
  }

  if (file.mimetype === 'text/plain') {
    return file.buffer.toString('utf8');
  }

  return '';
}

async function uploadResume(user, file, payload) {
  if (!file && !payload.resumeText) {
    throw new AppError('Resume file or resumeText is required.', 400);
  }

  let uploadResult = {
    secureUrl: null,
    publicId: null,
    storageProvider: 'local',
    bytes: 0,
  };

  if (file) {
    uploadResult = await uploadBuffer({
      buffer: file.buffer,
      folder: 'resume',
      mimeType: file.mimetype,
      originalName: file.originalname,
      resourceType: 'raw',
    });
  }

  const extractedText = extractResumeText(file, payload.resumeText);
  const analysis = await aiService.analyzeResumeText({
    resumeText: extractedText,
    targetRole: payload.targetRole || user.targetRole,
    jobDescription: payload.jobDescription,
  });

  await resumeRepository.deactivateActiveResumes(user.id);

  return resumeRepository.createResume({
    userId: user.id,
    fileName: file?.originalname || 'resume-text-input',
    mimeType: file?.mimetype || 'text/plain',
    secureUrl: uploadResult.secureUrl,
    publicId: uploadResult.publicId,
    storageProvider: uploadResult.storageProvider,
    sizeBytes: uploadResult.bytes || file?.size || Buffer.byteLength(extractedText, 'utf8'),
    extractedText,
    analysisSummary: analysis.summary,
    score: analysis.score,
    strengths: analysis.strengths,
    improvements: analysis.improvements,
    keywords: analysis.keywords,
    sections: analysis.sections,
    isActive: true,
  });
}

async function getLatestResume(user) {
  const resume = await resumeRepository.getLatestResume(user.id);

  if (!resume) {
    throw new AppError('Resume not found.', 404);
  }

  return resume;
}

async function listResumes(user) {
  return resumeRepository.listResumes(user.id);
}

module.exports = {
  uploadResume,
  getLatestResume,
  listResumes,
};
