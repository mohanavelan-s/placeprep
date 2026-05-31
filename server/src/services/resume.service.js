const resumeRepository = require('../repositories/resume.repository');
const { deleteStoredAsset, uploadBuffer } = require('./storage.service');
const aiService = require('./ai.service');
const AppError = require('../utils/appError');
const { extractResumeText } = require('../utils/resumeTextExtractor');

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

  const extraction = extractResumeText(file, payload.resumeText);
  const extractedText = extraction.text;
  const targetRole = payload.targetRole || user.targetRole;
  const analysis = await aiService.analyzeResumeText({
    resumeText: extractedText,
    targetRole,
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
    sections: {
      ...(analysis.sections || {}),
      _analysis: {
        targetRole: targetRole || null,
        jobDescriptionFocus: payload.jobDescription || null,
        jobMatchScore: analysis.jobMatchScore ?? null,
        missingKeywords: analysis.missingKeywords || [],
        benchmarkHighlights: analysis.benchmarkHighlights || [],
        extraction,
      },
    },
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

async function scoreAgainstJobDescription(user, payload = {}) {
  const latestResume = await resumeRepository.getLatestResume(user.id);
  const resumeText = String(payload.resumeText || latestResume?.extractedText || '').trim();

  if (!resumeText) {
    throw new AppError('Upload a resume or paste resume text before scoring it against a job description.', 400);
  }

  if (!String(payload.jobDescription || '').trim()) {
    throw new AppError('Job description text is required.', 400);
  }

  const analysis = await aiService.scoreResumeAgainstJobDescription({
    resumeText,
    targetRole: payload.targetRole || user.targetRole,
    jobDescription: payload.jobDescription,
  });

  return analysis;
}

async function clearHistory(user) {
  const deletedResumes = await resumeRepository.deleteByUser(user.id);

  await Promise.allSettled(
    deletedResumes
      .filter((resume) => resume.publicId && resume.storageProvider)
      .map((resume) =>
        deleteStoredAsset({
          publicId: resume.publicId,
          storageProvider: resume.storageProvider,
          resourceType: 'raw',
        })
      )
  );

  return {
    deleted: deletedResumes.length,
    clearedAt: new Date().toISOString(),
  };
}

module.exports = {
  uploadResume,
  getLatestResume,
  listResumes,
  scoreAgainstJobDescription,
  clearHistory,
};
