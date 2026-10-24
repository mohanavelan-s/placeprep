package com.placeprep;

import com.placeprep.model.blueprint.CompanyBlueprint;
import com.placeprep.service.RoleResearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class RoleResearchServiceTest {

    private RoleResearchService roleResearchService;

    @BeforeEach
    void setUp() {
        roleResearchService = new RoleResearchService(null);
    }

    @Test
    @DisplayName("Verified blueprints load from classpath and validate 100% stage allocation")
    void testBlueprintsLoadedAndValid() {
        Map<String, CompanyBlueprint> all = roleResearchService.getAllBlueprints();
        assertFalse(all.isEmpty(), "Blueprints map should not be empty");
        assertTrue(all.containsKey("microsoft"), "Microsoft blueprint should be loaded");
        assertTrue(all.containsKey("standard_sde"), "Standard SDE blueprint should be loaded");

        for (CompanyBlueprint bp : all.values()) {
            assertTrue(bp.isValid(), "Blueprint " + bp.companyId() + " must be valid");
            assertEquals(100, bp.totalAllocationPercent(),
                    "Blueprint " + bp.companyId() + " stages must strictly sum to 100%");
            assertFalse(bp.stages().isEmpty(), "Blueprint " + bp.companyId() + " must have stages");
            assertFalse(bp.highFrequencyLeetCodeIds().isEmpty(),
                    "Blueprint " + bp.companyId() + " must have high frequency LeetCode IDs");
        }
    }

    @Test
    @DisplayName("Microsoft blueprint matches all official aliases and contains verified data")
    void testMicrosoftBlueprintMatching() {
        for (String alias : new String[]{"microsoft", "msft", "Microsoft", "MICROSOFT CORPORATION", "microsoft india"}) {
            Optional<CompanyBlueprint> bpOpt = roleResearchService.findBlueprint(alias);
            assertTrue(bpOpt.isPresent(), "Alias '" + alias + "' should resolve to Microsoft blueprint");
            assertEquals("microsoft", bpOpt.get().companyId());
            assertEquals("Microsoft", bpOpt.get().displayName());
        }

        CompanyBlueprint msft = roleResearchService.findBlueprint("microsoft").orElseThrow();
        assertEquals(100, msft.totalAllocationPercent());
        assertTrue(msft.assessmentPlatform().toLowerCase().contains("variable"),
                "Microsoft assessment platform should be marked variable/not universally Codility");
        assertFalse(msft.highFrequencyLeetCodeIds().isEmpty());
        assertTrue(msft.highFrequencyLeetCodeIds().contains(146), "Must include LRU Cache (146)");
        assertTrue(msft.highFrequencyLeetCodeIds().contains(253), "Must include Meeting Rooms II (253)");
        assertTrue(msft.highFrequencyLeetCodeIds().contains(200), "Must include Number of Islands (200)");
    }

    @Test
    @DisplayName("Research report for Microsoft uses official blueprint and marks isGeneralGuidance false")
    void testResearchReportMicrosoft() {
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of(
                "companyKey", "msft",
                "targetRole", "Software Engineer"
        ));

        assertNotNull(report.blueprint);
        assertEquals("microsoft", report.blueprint.companyId());
        assertEquals("Microsoft", report.companyName);
        assertEquals(false, report.evidenceSummary.get("isGeneralGuidance"),
                "Specific blueprint should not be classified as general guidance");
        assertEquals("high", report.evidenceSummary.get("researchConfidence"));
        assertFalse(report.sources.isEmpty());
        assertTrue(report.sources.stream().anyMatch(s -> s.url.contains("careers.microsoft.com")),
                "Must include official Microsoft careers URL in sources");
    }

    @Test
    @DisplayName("Unrecognized company falls back to standard_sde while preserving user company name")
    void testResearchReportFallbackToStandardSde() {
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of(
                "companyKey", "custom",
                "customCompanyName", "Stripe Inc",
                "targetRole", "Backend Engineer"
        ));

        assertNotNull(report.blueprint);
        assertEquals("standard_sde", report.blueprint.companyId());
        assertEquals("Stripe Inc", report.companyName, "User's company name must be preserved");
        assertEquals(true, report.evidenceSummary.get("isGeneralGuidance"),
                "Unverified company must be marked as general guidance");
        assertEquals("provisional", report.evidenceSummary.get("researchConfidence"));
        assertTrue(report.evidenceSummary.get("limitationsNotice").toString().contains("No verified company-specific blueprint"));
    }
}
