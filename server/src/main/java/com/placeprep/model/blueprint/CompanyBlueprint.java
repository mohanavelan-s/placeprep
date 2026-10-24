package com.placeprep.model.blueprint;

import java.util.List;
import java.util.Objects;

/**
 * Immutable CompanyBlueprint representing verified hiring patterns,
 * interview stages, role skills, and source evidence.
 */
public record CompanyBlueprint(
        String companyId,
        String displayName,
        List<String> aliases,
        String assessmentPlatform,
        List<InterviewStage> stages,
        List<Integer> highFrequencyLeetCodeIds,
        List<String> roleSkills,
        BehavioralFramework behavioralFramework,
        List<VerifiedDoc> verifiedDocs,
        List<SourceEvidence> sourceEvidence
) {
    public CompanyBlueprint {
        aliases = aliases != null ? List.copyOf(aliases) : List.of();
        stages = stages != null ? List.copyOf(stages) : List.of();
        highFrequencyLeetCodeIds = highFrequencyLeetCodeIds != null ? List.copyOf(highFrequencyLeetCodeIds) : List.of();
        roleSkills = roleSkills != null ? List.copyOf(roleSkills) : List.of();
        verifiedDocs = verifiedDocs != null ? List.copyOf(verifiedDocs) : List.of();
        sourceEvidence = sourceEvidence != null ? List.copyOf(sourceEvidence) : List.of();
    }

    public int totalAllocationPercent() {
        return stages.stream()
                .mapToInt(InterviewStage::studyAllocationPercent)
                .sum();
    }

    public boolean isValid() {
        if (companyId == null || companyId.isBlank()) return false;
        if (displayName == null || displayName.isBlank()) return false;
        if (stages.isEmpty()) return false;
        return totalAllocationPercent() == 100;
    }

    public boolean matchesCompany(String companyOrAlias) {
        if (companyOrAlias == null || companyOrAlias.isBlank()) return false;
        String normalized = companyOrAlias.trim().toLowerCase();
        if (companyId != null && companyId.equalsIgnoreCase(normalized)) return true;
        if (displayName != null && displayName.equalsIgnoreCase(normalized)) return true;
        return aliases.stream().anyMatch(a -> a.equalsIgnoreCase(normalized));
    }

    public record InterviewStage(
            String stageId,
            String name,
            int studyAllocationPercent,
            String format,
            List<String> rubricTraps,
            List<String> coreTopics,
            List<String> evidenceRefs
    ) {
        public InterviewStage {
            rubricTraps = rubricTraps != null ? List.copyOf(rubricTraps) : List.of();
            coreTopics = coreTopics != null ? List.copyOf(coreTopics) : List.of();
            evidenceRefs = evidenceRefs != null ? List.copyOf(evidenceRefs) : List.of();
        }
    }

    public record BehavioralFramework(
            String name,
            List<String> principles,
            List<String> sampleQuestions
    ) {
        public BehavioralFramework {
            principles = principles != null ? List.copyOf(principles) : List.of();
            sampleQuestions = sampleQuestions != null ? List.copyOf(sampleQuestions) : List.of();
        }
    }

    public record VerifiedDoc(
            String title,
            String url,
            String topic,
            String category
    ) {}

    public record SourceEvidence(
            String title,
            String url,
            String organization,
            String category,
            List<String> supportedClaims,
            String confidence,
            String dateChecked
    ) {
        public SourceEvidence {
            supportedClaims = supportedClaims != null ? List.copyOf(supportedClaims) : List.of();
        }
    }
}
