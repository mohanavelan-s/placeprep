package com.placeprep.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.exception.AppException;
import com.placeprep.model.Resume;
import com.placeprep.model.User;
import com.placeprep.repository.ResumeRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final StorageService storageService;
    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public ResumeService(
            ResumeRepository resumeRepository,
            StorageService storageService,
            AiService aiService,
            ObjectMapper objectMapper
    ) {
        this.resumeRepository = resumeRepository;
        this.storageService = storageService;
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    public static String cleanFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) return "resume.pdf";
        try {
            byte[] bytes = fileName.getBytes(StandardCharsets.ISO_8859_1);
            String utf8 = new String(bytes, StandardCharsets.UTF_8);
            if (!utf8.contains("\uFFFD") && !utf8.contains("â")) {
                fileName = utf8;
            }
        } catch (Exception ignored) {}

        return fileName
                .replace("â\u0080\u0099", "'")
                .replace("â\u0080\u0093", "-")
                .replace("â\u0080\u0094", "--")
                .replace("â ", "'s ")
                .replace("â", "-")
                .trim();
    }

    private String extractTextFromDocx(byte[] bytes) {
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("word/document.xml".equals(entry.getName())) {
                    String xml = new String(zis.readAllBytes(), StandardCharsets.UTF_8);
                    return xml.replaceAll("<w:tab\\s*/>", "\t")
                            .replaceAll("<w:br\\s*/>", "\n")
                            .replaceAll("</w:p>", "\n")
                            .replaceAll("</w:tr>", "\n")
                            .replaceAll("<[^>]+>", " ")
                            .replaceAll("&amp;", "&")
                            .replaceAll("&lt;", "<")
                            .replaceAll("&gt;", ">")
                            .replaceAll("&quot;", "\"")
                            .replaceAll("&apos;", "'")
                            .replaceAll("[ \\t]{2,}", " ")
                            .trim();
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String extractText(MultipartFile file, String pastedText) {
        StringBuilder extracted = new StringBuilder();

        if (file != null && !file.isEmpty()) {
            String name = (file.getOriginalFilename() != null ? file.getOriginalFilename() : "").toLowerCase();
            String mime = (file.getContentType() != null ? file.getContentType() : "").toLowerCase();

            if (mime.contains("pdf") || name.endsWith(".pdf")) {
                try (PDDocument document = PDDocument.load(file.getInputStream())) {
                    PDFTextStripper stripper = new PDFTextStripper();
                    stripper.setSortByPosition(true);
                    String text = stripper.getText(document);
                    if (text != null && !text.isBlank()) {
                        extracted.append(text.trim());
                    }
                } catch (Exception e) {
                    System.err.println("[ResumeService] PDF extraction failed: " + e.getMessage());
                }
            } else if (name.endsWith(".docx")) {
                try {
                    String docxText = extractTextFromDocx(file.getBytes());
                    if (docxText != null && !docxText.isBlank()) {
                        extracted.append(docxText);
                    }
                } catch (Exception ignored) {}
            }

            if (extracted.length() == 0) {
                try {
                    String raw = new String(file.getBytes(), StandardCharsets.UTF_8);
                    // Filter out unprintable binary chars
                    String clean = raw.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", "");
                    if (clean.length() > 20) {
                        extracted.append(clean.trim());
                    }
                } catch (Exception ignored) {}
            }
        }

        if (pastedText != null && !pastedText.isBlank()) {
            if (extracted.length() > 0) {
                extracted.append("\n\n--- User Provided Notes & Corrections ---\n").append(pastedText.trim());
            } else {
                extracted.append(pastedText.trim());
            }
        }

        return extracted.toString().trim();
    }

    private static class RoleBenchmark {
        final String label;
        final List<String> keywords;
        final List<String> highlights;

        RoleBenchmark(String label, List<String> keywords, List<String> highlights) {
            this.label = label;
            this.keywords = keywords;
            this.highlights = highlights;
        }
    }

    private static final Map<String, RoleBenchmark> ROLE_BENCHMARKS = new LinkedHashMap<>();

    static {
        ROLE_BENCHMARKS.put("sde_intern", new RoleBenchmark(
                "SDE Intern",
                List.of("data structures", "algorithms", "problem solving", "python", "java", "c++", "git", "oop", "rest api", "sql", "linux", "projects", "leetcode", "debugging"),
                List.of("SDE Intern resumes score best with solid DSA mastery, clear project ownership, and core CS fundamentals (OOP, DBMS, OS).",
                        "Clean GitHub project links and hackathon / academic execution prove practical capability.")
        ));
        ROLE_BENCHMARKS.put("software_engineer", new RoleBenchmark(
                "Software Engineer",
                List.of("data structures", "algorithms", "system design", "java", "python", "c++", "sql", "testing", "apis", "projects", "git", "microservices"),
                List.of("Software Engineering resumes score best when balancing strong projects, core CS signals, and measurable impact.",
                        "Recruiters look for architectural clarity, clean design patterns, and quantifiable results.")
        ));
        ROLE_BENCHMARKS.put("backend_engineer", new RoleBenchmark(
                "Backend Engineer",
                List.of("java", "spring boot", "node.js", "rest api", "postgresql", "sql", "redis", "docker", "testing", "microservices", "system design", "kafka"),
                List.of("Backend resumes score best when showing API design, database schemas, and measurable reliability or latency wins.",
                        "Observability, caching, and clean relational data modeling establish production readiness.")
        ));
        ROLE_BENCHMARKS.put("frontend_engineer", new RoleBenchmark(
                "Frontend Engineer",
                List.of("react", "typescript", "javascript", "html", "css", "responsive", "accessibility", "performance", "state management", "testing", "tailwind"),
                List.of("Frontend resumes score best with responsive component systems, state management, and user-facing speed improvements.",
                        "Shipped web apps, clean animations, and accessibility signals attract recruiters.")
        ));
        ROLE_BENCHMARKS.put("full_stack_engineer", new RoleBenchmark(
                "Full Stack Engineer",
                List.of("react", "node.js", "sql", "api", "database", "authentication", "deployment", "testing", "typescript", "docker"),
                List.of("Full-Stack resumes score best when showing end-to-end delivery across UI, API, data, and deployment.",
                        "Evidence of shipping complete production workflows demonstrates full lifecycle autonomy.")
        ));
        ROLE_BENCHMARKS.put("data_engineer", new RoleBenchmark(
                "Data Engineer",
                List.of("sql", "etl", "elt", "data warehouse", "spark", "airflow", "python", "pipelines", "data modeling", "orchestration", "kafka", "bigquery"),
                List.of("Data Engineer resumes score best when showing pipeline ownership, warehousing, data modeling, and reliability.",
                        "Throughput, latency, freshness, and failure-recovery metrics add essential credibility.")
        ));
        ROLE_BENCHMARKS.put("data_analyst", new RoleBenchmark(
                "Data Analyst",
                List.of("sql", "excel", "power bi", "tableau", "python", "pandas", "dashboard", "kpi", "analysis", "statistics"),
                List.of("Data Analyst resumes score best with SQL, dashboards, metrics, and stakeholder-ready insight delivery.",
                        "Bullets should directly link analytical work to business decision impact and KPI growth.")
        ));
        ROLE_BENCHMARKS.put("data_scientist", new RoleBenchmark(
                "Data Scientist",
                List.of("python", "machine learning", "statistics", "pandas", "numpy", "model", "classification", "regression", "evaluation", "deep learning"),
                List.of("Data Science resumes score best with statistical rigour, model evaluation metrics, and clear problem formulation.",
                        "Demonstrating end-to-end model training, validation, and serving validates applied expertise.")
        ));
    }

    private RoleBenchmark getBenchmark(String targetRole) {
        if (targetRole == null || targetRole.isBlank()) {
            return ROLE_BENCHMARKS.get("software_engineer");
        }
        String norm = targetRole.trim().toLowerCase();
        if (norm.contains("intern") || norm.contains("sde intern") || norm.contains("swe intern")) return ROLE_BENCHMARKS.get("sde_intern");
        if (norm.contains("data eng")) return ROLE_BENCHMARKS.get("data_engineer");
        if (norm.contains("data analy")) return ROLE_BENCHMARKS.get("data_analyst");
        if (norm.contains("data sci") || norm.contains("machine learn") || norm.contains("ml")) return ROLE_BENCHMARKS.get("data_scientist");
        if (norm.contains("front")) return ROLE_BENCHMARKS.get("frontend_engineer");
        if (norm.contains("full")) return ROLE_BENCHMARKS.get("full_stack_engineer");
        if (norm.contains("back")) return ROLE_BENCHMARKS.get("backend_engineer");
        return ROLE_BENCHMARKS.get("software_engineer");
    }

    private Map<String, Object> runHeuristicAnalysis(String resumeText, String targetRole, String jobDescription) {
        RoleBenchmark benchmark = getBenchmark(targetRole);
        String norm = resumeText.toLowerCase();

        // 1. Detect Sections
        boolean hasSummary = Pattern.compile("(?i)\\b(summary|objective|profile|about me)\\b").matcher(resumeText).find();
        boolean hasEducation = Pattern.compile("(?i)\\b(education|academic|bachelor|b\\.tech|degree|university|college|gpa|cgpa)\\b").matcher(resumeText).find();
        boolean hasExperience = Pattern.compile("(?i)\\b(experience|internship|employment|work history)\\b").matcher(resumeText).find();
        boolean hasProjects = Pattern.compile("(?i)\\b(projects|academic projects|personal projects|hackathon)\\b").matcher(resumeText).find();
        boolean hasSkills = Pattern.compile("(?i)\\b(skills|technical skills|technologies|tools|languages)\\b").matcher(resumeText).find();
        boolean hasAchievements = Pattern.compile("(?i)\\b(achievements|awards|certifications|competitions|honors)\\b").matcher(resumeText).find();

        int sectionPoints = 0;
        if (hasEducation) sectionPoints += 15;
        if (hasProjects) sectionPoints += 25;
        if (hasSkills) sectionPoints += 20;
        if (hasExperience) sectionPoints += 15;
        if (hasSummary) sectionPoints += 5;
        if (hasAchievements) sectionPoints += 5;

        // 2. Keyword Matching
        List<String> matched = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String kw : benchmark.keywords) {
            if (norm.contains(kw.toLowerCase())) {
                matched.add(kw);
            } else {
                missing.add(kw);
            }
        }
        int keywordScore = Math.min(30, (int) Math.round((double) matched.size() / Math.max(1, benchmark.keywords.size()) * 40));

        // 3. Metric Signals (quantifiable results)
        Matcher metricMatcher = Pattern.compile("(\\d+%|\\d+\\+|₹\\s?\\d+|\\$\\s?\\d+|\\d+\\s?(ms|sec|hrs|hours|days|users|records|rows|pipelines|apis|models))", Pattern.CASE_INSENSITIVE).matcher(resumeText);
        int metricCount = 0;
        while (metricMatcher.find()) metricCount++;
        int metricScore = Math.min(15, metricCount * 4);

        // 4. Action Verbs
        Matcher verbMatcher = Pattern.compile("(?i)\\b(built|developed|designed|implemented|optimized|spearheaded|architected|engineered|created|reduced|accelerated|automated|integrated)\\b").matcher(resumeText);
        int verbCount = 0;
        while (verbMatcher.find()) verbCount++;
        int verbScore = Math.min(10, verbCount * 2);

        int totalScore = Math.min(96, Math.max(35, sectionPoints + keywordScore + metricScore + verbScore));

        List<String> strengths = new ArrayList<>();
        if (hasProjects) strengths.add("Projects section provides tangible proof of hands-on engineering execution.");
        if (hasSkills) strengths.add("Skills section provides a clean anchor for technical ATS parsers.");
        if (matched.size() >= 3) strengths.add("Strong alignment with core " + benchmark.label + " competencies: " + String.join(", ", matched.subList(0, Math.min(4, matched.size()))) + ".");
        if (metricCount >= 2) strengths.add("Quantified metrics reinforce your project accomplishments with real measurable impact.");
        if (hasEducation) strengths.add("Education chronology provides structured academic credentials.");

        List<String> improvements = new ArrayList<>();
        if (metricCount < 2) improvements.add("Quantify project bullets with concrete outcomes (e.g., % latency reduction, user throughput, data volume, accuracy).");
        if (!missing.isEmpty()) improvements.add("Strengthen " + benchmark.label + " keyword signals by adding evidence for: " + String.join(", ", missing.subList(0, Math.min(3, missing.size()))) + ".");
        if (!hasExperience) improvements.add("Include internship, open-source contribution, or leadership experience to showcase team collaboration.");
        if (!hasSummary) improvements.add("Add a concise 2-sentence summary outlining your primary stack and target role (" + benchmark.label + ").");

        String summary = String.format("%s ATS review complete. The resume was scored against %s signals with emphasis on %s. The current draft %s.",
                benchmark.label,
                benchmark.label,
                benchmark.highlights.get(0).toLowerCase(),
                metricCount >= 2 ? "already features valuable quantified impact" : "needs more quantified metric outcomes"
        );

        Map<String, Boolean> sectionMap = new LinkedHashMap<>();
        sectionMap.put("summary", hasSummary);
        sectionMap.put("education", hasEducation);
        sectionMap.put("experience", hasExperience);
        sectionMap.put("projects", hasProjects);
        sectionMap.put("skills", hasSkills);
        sectionMap.put("achievements", hasAchievements);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("score", totalScore);
        result.put("summary", summary);
        result.put("strengths", strengths);
        result.put("improvements", improvements);
        result.put("matchedKeywords", matched);
        result.put("missingKeywords", missing);
        result.put("sections", sectionMap);
        result.put("benchmarkHighlights", benchmark.highlights);
        return result;
    }

    private Map<String, Object> analyzeResumeWithAi(String resumeText, String targetRole, String jobDescription) {
        RoleBenchmark benchmark = getBenchmark(targetRole);

        // Try LLM deep analysis first
        try {
            String systemPrompt = String.format("""
                You are PlacePrep's Senior Technical Recruiter & ATS (Applicant Tracking System) Evaluation Engine.
                Evaluate the provided candidate resume text rigorously against the target role: "%s".
                %s

                Rules:
                1. Calculate an honest, realistic ATS compatibility score (0-100) based on role suitability, section completeness, metric quantification, and technical skills.
                2. If the resume has strong projects, DSA, and modern tech, score appropriately (70-90+). If it lacks metrics or essential skills, reflect that.
                3. Return STRICTLY a valid JSON object with NO markdown formatting, NO backticks, NO commentary:
                {
                  "score": <integer 0-100>,
                  "jobMatchScore": <integer 0-100 or null>,
                  "summary": "<2-3 sentence executive ATS review specifically naming the target role and key strengths/gaps>",
                  "strengths": ["<strength 1 with concrete evidence>", "<strength 2>", "<strength 3>", "<strength 4>"],
                  "improvements": ["<actionable improvement 1>", "<actionable improvement 2>", "<actionable improvement 3>"],
                  "matchedKeywords": ["<matched skill 1>", "<matched skill 2>", "<matched skill 3>"],
                  "missingKeywords": ["<missing keyword 1 for %s>", "<missing keyword 2>"],
                  "sections": {
                    "summary": <boolean>,
                    "education": <boolean>,
                    "experience": <boolean>,
                    "projects": <boolean>,
                    "skills": <boolean>,
                    "achievements": <boolean>
                  }
                }
                """,
                    benchmark.label,
                    jobDescription != null && !jobDescription.isBlank() ? "Scoring focus also incorporates this Job Description: " + jobDescription : "",
                    benchmark.label
            );

            String userPrompt = "Resume Text:\n" + (resumeText.length() > 6000 ? resumeText.substring(0, 6000) : resumeText);
            String aiResult = aiService.completePrompt(systemPrompt, userPrompt);

            if (aiResult != null && !aiResult.isBlank()) {
                String cleanJson = aiResult.replaceAll("(?s)^```json\\s*", "").replaceAll("(?s)```\\s*$", "").trim();
                Map<String, Object> parsed = objectMapper.readValue(cleanJson, new TypeReference<Map<String, Object>>() {});
                if (parsed.containsKey("score") && parsed.containsKey("summary")) {
                    parsed.put("benchmarkHighlights", benchmark.highlights);
                    return parsed;
                }
            }
        } catch (Exception ex) {
            System.err.println("[ResumeService] AI resume evaluation failed, falling back to rule engine: " + ex.getMessage());
        }

        // High-fidelity heuristic fallback
        return runHeuristicAnalysis(resumeText, benchmark.label, jobDescription);
    }

    public Resume uploadResume(User user, MultipartFile file, String resumeText, String targetRole, String jobDescription) {
        if ((file == null || file.isEmpty()) && (resumeText == null || resumeText.isBlank())) {
            throw new AppException("Resume file or resumeText is required.", HttpStatus.BAD_REQUEST);
        }

        String secureUrl = null;
        String publicId = null;
        String storageProvider = "local";
        String fileName = "resume-text-input";
        String mimeType = "text/plain";
        long sizeBytes = 0;

        if (file != null && !file.isEmpty()) {
            fileName = cleanFileName(file.getOriginalFilename());
            mimeType = file.getContentType() != null ? file.getContentType() : "application/pdf";
            sizeBytes = file.getSize();
            try {
                StorageService.UploadResult upload = storageService.upload(file, "resume");
                secureUrl = upload.secureUrl;
                publicId = upload.publicId;
                storageProvider = upload.storageProvider;
            } catch (IOException e) {
                throw new AppException("Failed to store resume file: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

        String extractedText = extractText(file, resumeText);
        if (extractedText.isBlank()) {
            extractedText = resumeText != null ? resumeText.trim() : "";
        }

        String effectiveRole = (targetRole != null && !targetRole.isBlank())
                ? targetRole.trim()
                : (user.getTargetRole() != null && !user.getTargetRole().isBlank() ? user.getTargetRole() : "SDE Intern");

        Map<String, Object> analysis = analyzeResumeWithAi(extractedText, effectiveRole, jobDescription);

        int score = analysis.get("score") instanceof Number n ? n.intValue() : 75;
        String summary = (String) analysis.getOrDefault("summary", "Resume evaluated for technical readiness.");

        List<String> strengths = castStringList(analysis.get("strengths"));
        List<String> improvements = castStringList(analysis.get("improvements"));
        List<String> matchedKw = castStringList(analysis.get("matchedKeywords"));
        List<String> missingKw = castStringList(analysis.get("missingKeywords"));

        resumeRepository.deactivateActiveResumes(user.getId());

        Resume resume = new Resume();
        resume.setUserId(user.getId());
        resume.setFileName(fileName);
        resume.setMimeType(mimeType);
        resume.setSecureUrl(secureUrl);
        resume.setPublicId(publicId);
        resume.setStorageProvider(storageProvider);
        resume.setSizeBytes((int) sizeBytes);
        resume.setExtractedText(extractedText);
        resume.setAnalysisSummary(summary);
        resume.setScore(score);
        resume.setStrengths(strengths);
        resume.setImprovements(improvements);
        resume.setKeywords(matchedKw);
        resume.setIsActive(true);

        Map<String, Object> sections = new HashMap<>();
        if (analysis.get("sections") instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                sections.put(String.valueOf(e.getKey()), e.getValue());
            }
        }

        Map<String, Object> meta = new HashMap<>();
        meta.put("targetRole", effectiveRole);
        meta.put("jobDescriptionFocus", jobDescription);
        meta.put("jobMatchScore", analysis.get("jobMatchScore"));
        meta.put("missingKeywords", missingKw);
        meta.put("benchmarkHighlights", analysis.get("benchmarkHighlights"));
        meta.put("extraction", Map.of(
                "method", (file != null && fileName.toLowerCase().endsWith(".pdf")) ? "pdfbox" : "text",
                "extractedChars", extractedText.length()
        ));
        sections.put("_analysis", meta);
        resume.setSections(sections);

        return resumeRepository.createResume(resume);
    }

    @SuppressWarnings("unchecked")
    private List<String> castStringList(Object obj) {
        if (obj instanceof List<?> l) {
            List<String> res = new ArrayList<>();
            for (Object o : l) {
                if (o != null) res.add(String.valueOf(o));
            }
            return res;
        }
        return Collections.emptyList();
    }

    public Resume getLatestResume(User user) {
        return resumeRepository.getLatestResume(user.getId())
                .orElseThrow(() -> new AppException("Resume not found.", HttpStatus.NOT_FOUND));
    }

    public List<Resume> listResumes(User user) {
        return resumeRepository.listResumes(user.getId());
    }

    public Map<String, Object> scoreAgainstJobDescription(User user, String resumeText, String targetRole, String jobDescription) {
        if (resumeText == null || resumeText.isBlank()) {
            Optional<Resume> latest = resumeRepository.getLatestResume(user.getId());
            if (latest.isPresent()) {
                resumeText = latest.get().getExtractedText();
            }
        }

        if (resumeText == null || resumeText.isBlank()) {
            throw new AppException("Upload a resume or paste resume text before scoring it against a job description.", HttpStatus.BAD_REQUEST);
        }

        if (jobDescription == null || jobDescription.trim().length() < 20) {
            throw new AppException("Job description text is required (min 20 characters).", HttpStatus.BAD_REQUEST);
        }

        String effectiveRole = (targetRole != null && !targetRole.isBlank())
                ? targetRole.trim()
                : (user.getTargetRole() != null && !user.getTargetRole().isBlank() ? user.getTargetRole() : "SDE Intern");

        Map<String, Object> analysis = analyzeResumeWithAi(resumeText, effectiveRole, jobDescription);
        int jobScore = analysis.get("jobMatchScore") instanceof Number n ? n.intValue() : (analysis.get("score") instanceof Number s ? s.intValue() : 80);

        return Map.of(
                "jobMatchScore", jobScore,
                "summary", analysis.getOrDefault("summary", "Resume matched against target job description."),
                "matchingKeywords", castStringList(analysis.get("matchedKeywords")),
                "missingKeywords", castStringList(analysis.get("missingKeywords")),
                "recommendations", castStringList(analysis.get("improvements"))
        );
    }

    public Map<String, Object> clearHistory(User user) {
        List<Resume> deleted = resumeRepository.deleteByUser(user.getId());
        return Map.of(
                "deleted", deleted.size(),
                "clearedAt", OffsetDateTime.now().toString()
        );
    }

    public Map<String, Object> deleteResume(User user, UUID id) {
        Optional<Resume> deleted = resumeRepository.deleteByIdAndUser(id, user.getId());
        return Map.of(
                "success", deleted.isPresent(),
                "deletedCount", deleted.isPresent() ? 1 : 0,
                "id", id.toString()
        );
    }
}
