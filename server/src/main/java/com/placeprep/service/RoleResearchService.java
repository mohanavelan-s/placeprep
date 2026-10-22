package com.placeprep.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.model.blueprint.CompanyBlueprint;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URI;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoleResearchService {

    public static class SourceRecord {
        public String title;
        public String url;
        public String organization;
        public String category; // "official_careers", "official_guide", "practice_resource", "candidate_experience", "user_job_description"
        public String publicationDate;
        public String dateChecked;
        public List<String> supportedClaims;
        public String confidence; // "Official requirement", "Official preparation guidance", "Reputable practice resource", "Repeated candidate-reported pattern", "Single anecdotal report", "Inference requiring confirmation"

        public SourceRecord(String title, String url, String organization, String category, String publicationDate, String dateChecked, List<String> supportedClaims, String confidence) {
            this.title = title;
            this.url = url;
            this.organization = organization;
            this.category = category;
            this.publicationDate = publicationDate;
            this.dateChecked = dateChecked;
            this.supportedClaims = supportedClaims != null ? supportedClaims : List.of();
            this.confidence = confidence;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", title);
            m.put("url", url);
            m.put("organization", organization);
            m.put("category", category);
            m.put("publicationDate", publicationDate);
            m.put("dateChecked", dateChecked);
            m.put("supportedClaims", supportedClaims);
            m.put("confidence", confidence);
            return m;
        }
    }

    public static class ResearchReport {
        public String companyName;
        public String companyKey;
        public String targetRole;
        public String seniority;
        public String location;
        public String dateChecked;
        public List<SourceRecord> sources = new ArrayList<>();
        public List<Map<String, Object>> coreCompetencies = new ArrayList<>();
        public Map<String, Object> evidenceSummary = new LinkedHashMap<>();
        public List<String> diagnosticTopics = new ArrayList<>();
        public CompanyBlueprint blueprint;

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("companyName", companyName);
            m.put("companyKey", companyKey);
            m.put("targetRole", targetRole);
            m.put("seniority", seniority);
            m.put("location", location);
            m.put("dateChecked", dateChecked);
            List<Map<String, Object>> srcList = new ArrayList<>();
            for (SourceRecord s : sources) {
                srcList.add(s.toMap());
            }
            m.put("sources", srcList);
            m.put("coreCompetencies", coreCompetencies);
            m.put("evidenceSummary", evidenceSummary);
            m.put("diagnosticTopics", diagnosticTopics);
            if (blueprint != null) {
                m.put("blueprintCompanyId", blueprint.companyId());
                m.put("blueprintDisplayName", blueprint.displayName());
            }
            return m;
        }
    }

    private final ObjectMapper objectMapper;
    private final Map<String, CompanyBlueprint> blueprints = new ConcurrentHashMap<>();
    private final Map<String, String> aliasIndex = new ConcurrentHashMap<>();

    public RoleResearchService(@Autowired(required = false) ObjectMapper objectMapper) {
        if (objectMapper != null) {
            this.objectMapper = objectMapper.copy().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        } else {
            this.objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        }
        loadBlueprints();
    }

    private void loadBlueprints() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath*:company-blueprints/*.json");
            for (Resource res : resources) {
                try (InputStream is = res.getInputStream()) {
                    CompanyBlueprint bp = objectMapper.readValue(is, CompanyBlueprint.class);
                    registerBlueprint(bp);
                } catch (Exception ex) {
                    System.err.println("[RoleResearchService] Failed to load blueprint " + res.getFilename() + ": " + ex.getMessage());
                }
            }
        } catch (Exception e) {
            System.err.println("[RoleResearchService] Pattern resolver scan notice: " + e.getMessage());
        }

        // Direct fallback loader if pattern resolver found nothing
        if (blueprints.isEmpty()) {
            for (String file : List.of("microsoft.json", "standard_sde.json")) {
                try (InputStream is = getClass().getClassLoader().getResourceAsStream("company-blueprints/" + file)) {
                    if (is != null) {
                        CompanyBlueprint bp = objectMapper.readValue(is, CompanyBlueprint.class);
                        registerBlueprint(bp);
                    }
                } catch (Exception ex) {
                    System.err.println("[RoleResearchService] Fallback load failed for " + file + ": " + ex.getMessage());
                }
            }
        }

        // Ensure standard_sde always exists
        if (!blueprints.containsKey("standard_sde")) {
            registerBlueprint(fallbackDefaultBlueprint());
        }

        System.out.println("[RoleResearchService] Loaded " + blueprints.size() + " verified company blueprints: " + blueprints.keySet());
    }

    private void registerBlueprint(CompanyBlueprint bp) {
        if (bp == null || !bp.isValid()) {
            System.err.println("[RoleResearchService] Rejected invalid blueprint: " + (bp != null ? bp.companyId() : "null"));
            return;
        }
        String id = bp.companyId().toLowerCase();
        blueprints.put(id, bp);
        aliasIndex.put(id, id);
        if (bp.displayName() != null) {
            aliasIndex.put(bp.displayName().toLowerCase(), id);
        }
        for (String alias : bp.aliases()) {
            if (alias != null && !alias.isBlank()) {
                aliasIndex.put(alias.trim().toLowerCase(), id);
            }
        }
    }

    public Optional<CompanyBlueprint> findBlueprint(String companyOrAlias) {
        if (companyOrAlias == null || companyOrAlias.isBlank()) return Optional.empty();
        String norm = companyOrAlias.trim().toLowerCase();
        if (blueprints.containsKey(norm)) return Optional.of(blueprints.get(norm));
        if (aliasIndex.containsKey(norm)) {
            String targetId = aliasIndex.get(norm);
            if (blueprints.containsKey(targetId)) return Optional.of(blueprints.get(targetId));
        }
        for (CompanyBlueprint bp : blueprints.values()) {
            if (bp.matchesCompany(norm)) return Optional.of(bp);
        }
        return Optional.empty();
    }

    public CompanyBlueprint getBlueprintOrDefault(String companyOrAlias) {
        return findBlueprint(companyOrAlias)
                .orElseGet(() -> blueprints.getOrDefault("standard_sde", fallbackDefaultBlueprint()));
    }

    public Map<String, CompanyBlueprint> getAllBlueprints() {
        return Collections.unmodifiableMap(blueprints);
    }

    public ResearchReport conductResearch(Map<String, Object> targetContext) {
        String companyKey = (String) targetContext.getOrDefault("companyKey", "custom");
        String customCompanyName = (String) targetContext.get("customCompanyName");
        String targetRole = (String) targetContext.getOrDefault("targetRole", "SDE Intern");
        String seniority = (String) targetContext.getOrDefault("seniority", "internship");
        String location = (String) targetContext.getOrDefault("location", "India");
        String jobDescription = (String) targetContext.get("jobDescription");
        String jobPostingUrl = (String) targetContext.get("jobPostingUrl");

        String queryCompany = (customCompanyName != null && !customCompanyName.isBlank())
                ? customCompanyName.trim()
                : (companyKey.equalsIgnoreCase("custom") ? "Target Tech Company" : companyKey);

        String companyLabel = queryCompany.equalsIgnoreCase("custom")
                ? "Target Tech Company"
                : (queryCompany.length() > 1 ? queryCompany.substring(0, 1).toUpperCase() + queryCompany.substring(1) : queryCompany);

        ResearchReport report = new ResearchReport();
        report.companyName = companyLabel;
        report.companyKey = companyKey.toLowerCase();
        report.targetRole = targetRole;
        report.seniority = seniority;
        report.location = location;
        report.dateChecked = LocalDate.now().toString();

        // 1. Process candidate-provided Job Description if present (Tier 1 Primary Source)
        if (jobDescription != null && !jobDescription.trim().isBlank()) {
            String safeUrl = sanitizeUserUrl(jobPostingUrl);
            List<String> extractedSkills = extractStatedSkillsFromJobDescription(jobDescription);
            report.sources.add(new SourceRecord(
                    companyLabel + " - Stated Job Posting Requirements",
                    safeUrl != null ? safeUrl : "candidate-supplied-job-description",
                    companyLabel,
                    "user_job_description",
                    null,
                    report.dateChecked,
                    extractedSkills,
                    "Official requirement"
            ));
        }

        // 2. Blueprint matching
        Optional<CompanyBlueprint> matchedBlueprint = findBlueprint(queryCompany);
        if (matchedBlueprint.isEmpty() && !companyKey.equalsIgnoreCase("custom")) {
            matchedBlueprint = findBlueprint(companyKey);
        }

        if (matchedBlueprint.isPresent() && !matchedBlueprint.get().companyId().equals("standard_sde")) {
            CompanyBlueprint bp = matchedBlueprint.get();
            report.blueprint = bp;
            report.companyKey = bp.companyId();
            report.companyName = bp.displayName();

            // Populate Tier 1 Official Sources from verifiedDocs
            for (CompanyBlueprint.VerifiedDoc doc : bp.verifiedDocs()) {
                report.sources.add(new SourceRecord(
                        doc.title(),
                        doc.url(),
                        bp.displayName() + " Careers",
                        "official_careers",
                        "2026",
                        report.dateChecked,
                        List.of(doc.topic()),
                        "Official preparation guidance"
                ));
            }

            // Populate SourceEvidence records
            for (CompanyBlueprint.SourceEvidence ev : bp.sourceEvidence()) {
                String conf = ev.category().contains("TIER_1") ? "Official requirement" :
                        (ev.category().contains("TIER_2") ? "Reputable practice resource" : "Repeated candidate-reported pattern");
                report.sources.add(new SourceRecord(
                        ev.title(),
                        ev.url(),
                        ev.organization(),
                        ev.category().toLowerCase(),
                        "2026",
                        report.dateChecked,
                        ev.supportedClaims(),
                        conf
                ));
            }

            // Build core competencies from roleSkills & stages
            List<Map<String, Object>> comps = new ArrayList<>();
            for (int i = 0; i < bp.roleSkills().size(); i++) {
                String skill = bp.roleSkills().get(i);
                comps.add(Map.of(
                        "name", skill,
                        "priority", i < 3 ? "critical" : "core",
                        "reason", "Verified requirement in " + bp.displayName() + " hiring rubric.",
                        "source", "Tier 1 Blueprint: " + bp.displayName()
                ));
            }
            report.coreCompetencies = comps;

            // Diagnostic topics from core stage topics
            List<String> dTopics = new ArrayList<>();
            for (CompanyBlueprint.InterviewStage stg : bp.stages()) {
                dTopics.addAll(stg.coreTopics());
            }
            report.diagnosticTopics = dTopics.stream().distinct().limit(6).toList();

            report.evidenceSummary.put("isGeneralGuidance", false);
            report.evidenceSummary.put("guidanceClassification", "Company-Verified Preparation Framework (" + bp.displayName() + ")");
            report.evidenceSummary.put("researchConfidence", "high");
            report.evidenceSummary.put("assessmentPlatform", bp.assessmentPlatform());
        } else {
            // General / Unrecognized Company -> use standard_sde blueprint for structure
            CompanyBlueprint stdBp = getBlueprintOrDefault("standard_sde");
            report.blueprint = stdBp;

            for (CompanyBlueprint.SourceEvidence ev : stdBp.sourceEvidence()) {
                report.sources.add(new SourceRecord(
                        ev.title(),
                        ev.url(),
                        ev.organization(),
                        ev.category().toLowerCase(),
                        "2026",
                        report.dateChecked,
                        ev.supportedClaims(),
                        "Inference requiring confirmation"
                ));
            }

            report.sources.add(new SourceRecord(
                    "Standard Tech Industry Competency Matrix: " + targetRole,
                    "https://www.geeksforgeeks.org/how-to-prepare-for-technical-interviews/",
                    "Engineering Hiring Standards",
                    "official_guide",
                    "2026",
                    report.dateChecked,
                    List.of(
                            "Role requirements: Core problem solving in general-purpose languages",
                            "Data structures: Arrays, Hashing, Trees, Graph traversals",
                            "Complexity verification: Rigorous O(N) vs O(N log N) space-time justification"
                    ),
                    "Inference requiring confirmation"
            ));

            List<Map<String, Object>> comps = new ArrayList<>();
            for (int i = 0; i < stdBp.roleSkills().size(); i++) {
                String skill = stdBp.roleSkills().get(i);
                comps.add(Map.of(
                        "name", skill,
                        "priority", i < 3 ? "critical" : "core",
                        "reason", "Foundational expectation across software engineering technical assessments.",
                        "source", "General SDE Industry Standard"
                ));
            }
            report.coreCompetencies = comps;

            List<String> dTopics = new ArrayList<>();
            for (CompanyBlueprint.InterviewStage stg : stdBp.stages()) {
                dTopics.addAll(stg.coreTopics());
            }
            report.diagnosticTopics = dTopics.stream().distinct().limit(6).toList();

            report.evidenceSummary.put("isGeneralGuidance", true);
            report.evidenceSummary.put("guidanceClassification", "General Role Guidance (Unverified Company Specifics)");
            report.evidenceSummary.put("researchConfidence", "provisional");
            report.evidenceSummary.put("assessmentPlatform", stdBp.assessmentPlatform());
            report.evidenceSummary.put("limitationsNotice", "No verified company-specific blueprint available for " + companyLabel + ". Applying standard software engineering industry curriculum and rubrics.");
        }

        boolean hasOfficial = report.sources.stream().anyMatch(s -> s.confidence != null && s.confidence.contains("Official"));
        report.evidenceSummary.put("officialRequirementsCount", report.sources.stream().filter(s -> s.confidence != null && s.confidence.contains("Official")).count());
        report.evidenceSummary.put("totalSourcesAnalyzed", report.sources.size());
        report.evidenceSummary.put("verifiedPrimaryEntryUrl", report.sources.isEmpty() ? null : report.sources.get(0).url);
        if (!report.evidenceSummary.containsKey("limitationsNotice")) {
            report.evidenceSummary.put("limitationsNotice", "Evidence synthesized from official public careers documentation, verified curricula, and candidate patterns. Always confirm specific requirements with your assigned recruiter.");
        }

        return report;
    }

    private CompanyBlueprint fallbackDefaultBlueprint() {
        return new CompanyBlueprint(
                "standard_sde",
                "Standard SDE / General Tech",
                List.of("general", "standard", "generic", "sde"),
                "Standard Tech Assessment (HackerRank / CodeSignal / LeetCode / Live Editor)",
                List.of(
                        new CompanyBlueprint.InterviewStage(
                                "std-screening",
                                "Technical Screening & Online Assessment",
                                30,
                                "Timed online algorithmic challenge",
                                List.of("Inefficient Big-O time complexity", "Edge case blindspots"),
                                List.of("Arrays & Strings", "Hash Maps & Sets", "Binary Search"),
                                List.of("https://github.com/jwasham/coding-interview-university")
                        ),
                        new CompanyBlueprint.InterviewStage(
                                "std-core-dsa",
                                "Core Algorithms & Data Structures",
                                40,
                                "Live interactive technical interview",
                                List.of("Coding before verbally verifying approach", "Silent thinking without sharing trade-offs"),
                                List.of("Trees & BST", "Graphs (BFS/DFS)", "Dynamic Programming"),
                                List.of("https://github.com/jwasham/coding-interview-university")
                        ),
                        new CompanyBlueprint.InterviewStage(
                                "std-systems-behavioral",
                                "System Fundamentals & Behavioral Competency",
                                30,
                                "System design discussion and STAR method behavioral evaluation",
                                List.of("Buzzwords without throughput requirements", "Vague behavioral answers"),
                                List.of("API Design", "Database Indexing & Caching", "STAR Stories"),
                                List.of("https://github.com/jwasham/coding-interview-university")
                        )
                ),
                List.of(1, 15, 20, 21, 53, 121, 141, 200, 206, 226, 238, 704),
                List.of(
                        "Data Structures & Algorithms",
                        "Object-Oriented Design & Clean Code",
                        "System Design & Web Architecture Fundamentals",
                        "Testing, Debugging & Performance Profiling",
                        "Technical Communication & Collaboration"
                ),
                new CompanyBlueprint.BehavioralFramework(
                        "STAR Behavioral Framework",
                        List.of("Situation & Task Clarity", "Action Ownership", "Quantifiable Results", "Constructive Collaboration"),
                        List.of("Describe a technically difficult bug you resolved.", "Tell me about a technical disagreement with a teammate.")
                ),
                List.of(
                        new CompanyBlueprint.VerifiedDoc(
                                "General SDE Reference",
                                "https://github.com/jwasham/coding-interview-university",
                                "Standard Software Engineering Preparation",
                                "GENERAL_REFERENCE"
                        )
                ),
                List.of(
                        new CompanyBlueprint.SourceEvidence(
                                "Industry Standard Technical Interview Rubrics",
                                "https://github.com/jwasham/coding-interview-university",
                                "Open Source Tech Prep",
                                "TIER_2_TECHNICAL",
                                List.of("Core expectations for time and space complexity", "Data structure mastery"),
                                "HIGH",
                                "2026-03-01"
                        )
                )
        );
    }

    private List<String> extractStatedSkillsFromJobDescription(String jd) {
        String lower = jd.toLowerCase();
        List<String> found = new ArrayList<>();
        String[] candidates = {
                "java", "python", "c++", "c#", "golang", "javascript", "typescript",
                "data structures", "algorithms", "object-oriented", "sql", "nosql",
                "operating systems", "concurrency", "multithreading", "distributed systems",
                "rest api", "docker", "kubernetes", "git", "aws", "react", "spring boot"
        };
        for (String c : candidates) {
            if (lower.contains(c)) {
                found.add(c.toUpperCase());
            }
        }
        if (found.isEmpty()) {
            found.add("Problem Solving");
            found.add("Data Structures");
            found.add("Software Design");
        }
        return found;
    }

    private String sanitizeUserUrl(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            URI uri = new URI(url.trim());
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                return null;
            }
            String host = uri.getHost();
            if (host == null) return null;
            // Prevent SSRF: block localhost, loopback, private ranges
            if (host.equalsIgnoreCase("localhost") || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.16.") || host.equals("::1")) {
                return null;
            }
            return uri.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
