package com.placeprep;

import com.placeprep.model.blueprint.CompanyBlueprint;
import com.placeprep.service.AiService;
import com.placeprep.service.AssessmentService;
import com.placeprep.service.LeetCodeCatalogService;
import com.placeprep.service.RoleResearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class AiPlanGroundingTest {

    private RoleResearchService roleResearchService;
    private LeetCodeCatalogService leetCodeCatalogService;
    private AiService aiService;

    @BeforeEach
    void setUp() {
        roleResearchService = new RoleResearchService(null);
        leetCodeCatalogService = new LeetCodeCatalogService();
        aiService = new AiService(
                null,
                null,
                roleResearchService,
                leetCodeCatalogService,
                null,
                "",
                "",
                "test-model",
                "test",
                "",
                "",
                ""
        );
    }

    @Test
    @DisplayName("Deterministic schedule calculation: N = durationMonths * 4 weeks, with exact weekly estimated hours")
    void testScheduleCalculation() {
        CompanyBlueprint msft = roleResearchService.findBlueprint("microsoft").orElseThrow();
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of("companyKey", "msft"));

        // 1-month plan -> 4 weeks, 120 min/day -> 10.0 hrs/week
        Map<String, Object> plan1M = aiService.generateDeterministicCurriculum(msft, report, 120, 1, "Software Engineer");
        List<Map<String, Object>> roadmap1M = (List<Map<String, Object>>) plan1M.get("roadmap");
        assertEquals(4, roadmap1M.size(), "1-month plan must produce exactly 4 weeks");
        for (Map<String, Object> w : roadmap1M) {
            assertEquals(10.0, ((Number) w.get("estimatedHours")).doubleValue(), 0.01,
                    "120 min/day across 5 days must be exactly 10.0 hours/week");
        }

        // 2-month plan -> 8 weeks, 60 min/day -> 5.0 hrs/week
        Map<String, Object> plan2M = aiService.generateDeterministicCurriculum(msft, report, 60, 2, "Software Engineer");
        List<Map<String, Object>> roadmap2M = (List<Map<String, Object>>) plan2M.get("roadmap");
        assertEquals(8, roadmap2M.size(), "2-month plan must produce exactly 8 weeks");
        for (Map<String, Object> w : roadmap2M) {
            assertEquals(5.0, ((Number) w.get("estimatedHours")).doubleValue(), 0.01,
                    "60 min/day across 5 days must be exactly 5.0 hours/week");
        }

        // 3-month plan -> 12 weeks, 90 min/day -> 7.5 hrs/week
        Map<String, Object> plan3M = aiService.generateDeterministicCurriculum(msft, report, 90, 3, "Software Engineer");
        List<Map<String, Object>> roadmap3M = (List<Map<String, Object>>) plan3M.get("roadmap");
        assertEquals(12, roadmap3M.size(), "3-month plan must produce exactly 12 weeks");
        for (Map<String, Object> w : roadmap3M) {
            assertEquals(7.5, ((Number) w.get("estimatedHours")).doubleValue(), 0.01,
                    "90 min/day across 5 days must be exactly 7.5 hours/week");
        }
    }

    @Test
    @DisplayName("Deliberate block focus policy: 60m (1x60), 90m (2x45), 120m (2x60), 150m (1x90, 1x60), 180m (2x90)")
    void testDeliberateBlockFocusPolicy() {
        // 60 minutes -> 1 block of 60
        List<AiService.PlanTimeBlock> b60 = AiService.computeDeliberateBlocks(60);
        assertEquals(1, b60.size());
        assertEquals(60, b60.get(0).minutes());

        // 90 minutes -> 2 blocks of 45
        List<AiService.PlanTimeBlock> b90 = AiService.computeDeliberateBlocks(90);
        assertEquals(2, b90.size());
        assertEquals(45, b90.get(0).minutes());
        assertEquals(45, b90.get(1).minutes());

        // 120 minutes -> 2 blocks of 60
        List<AiService.PlanTimeBlock> b120 = AiService.computeDeliberateBlocks(120);
        assertEquals(2, b120.size());
        assertEquals(60, b120.get(0).minutes());
        assertEquals(60, b120.get(1).minutes());

        // 150 minutes -> 1 block of 90 and 1 block of 60
        List<AiService.PlanTimeBlock> b150 = AiService.computeDeliberateBlocks(150);
        assertEquals(2, b150.size());
        assertEquals(90, b150.get(0).minutes());
        assertEquals(60, b150.get(1).minutes());

        // 180 minutes -> 2 blocks of 90
        List<AiService.PlanTimeBlock> b180 = AiService.computeDeliberateBlocks(180);
        assertEquals(2, b180.size());
        assertEquals(90, b180.get(0).minutes());
        assertEquals(90, b180.get(1).minutes());

        // Capacity with remainder (e.g. 75 min) -> 1 block of 60 + 1 identified wrap-up block of 15
        List<AiService.PlanTimeBlock> b75 = AiService.computeDeliberateBlocks(75);
        assertEquals(2, b75.size());
        assertEquals(60, b75.get(0).minutes());
        assertEquals(15, b75.get(1).minutes());
        assertTrue(b75.get(1).blockLabel().contains("Wrap-Up"));
    }

    @Test
    @DisplayName("Regression: deliberate blocks edge cases (15, 30, 35, 40, 44, 45, 76, 89, 90, 91, 104, 105, 120, 149, 150, 180) sum exactly and synthesis <= 30m")
    void testDeliberateBlocksEdgeCasesAndRemainderLimit() {
        int[] testBudgets = {15, 30, 35, 40, 44, 45, 76, 89, 90, 91, 104, 105, 120, 149, 150, 180};

        for (int budget : testBudgets) {
            List<AiService.PlanTimeBlock> blocks = AiService.computeDeliberateBlocks(budget);
            assertFalse(blocks.isEmpty(), "Blocks must not be empty for budget: " + budget);

            int totalMinutes = blocks.stream().mapToInt(AiService.PlanTimeBlock::minutes).sum();
            assertEquals(budget, totalMinutes, "Block durations must sum exactly to requested budget: " + budget);

            for (AiService.PlanTimeBlock b : blocks) {
                if ("revision".equals(b.roleType())) {
                    assertTrue(b.minutes() <= 30,
                            "Synthesis block duration (" + b.minutes() + "m) must be <= 30m for budget " + budget);
                } else if (budget > 45) {
                    assertTrue(b.minutes() == 45 || b.minutes() == 60 || b.minutes() == 90,
                            "Focus block duration (" + b.minutes() + "m) must be 45, 60, or 90m for budget " + budget);
                }
            }
        }

        // Specific structural verifications
        // 91m -> 45 (DSA) + 45 (Core CS) + 1 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b91 = AiService.computeDeliberateBlocks(91);
        assertEquals(List.of(45, 45, 1), b91.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals("revision", b91.get(2).roleType());
        assertTrue(b91.get(2).minutes() <= 30);

        // 104m -> 45 (DSA) + 45 (Core CS) + 14 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b104 = AiService.computeDeliberateBlocks(104);
        assertEquals(List.of(45, 45, 14), b104.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals("revision", b104.get(2).roleType());
        assertTrue(b104.get(2).minutes() <= 30);

        // 76m -> 60 (DSA) + 16 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b76 = AiService.computeDeliberateBlocks(76);
        assertEquals(List.of(60, 16), b76.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertTrue(b76.get(1).minutes() <= 30);

        // 89m -> 60 (DSA) + 29 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b89 = AiService.computeDeliberateBlocks(89);
        assertEquals(List.of(60, 29), b89.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertTrue(b89.get(1).minutes() <= 30);

        // 149m -> 90 (DSA) + 45 (Core CS) + 14 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b149 = AiService.computeDeliberateBlocks(149);
        assertEquals(List.of(90, 45, 14), b149.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertTrue(b149.get(2).minutes() <= 30);

        // Small budgets <= 45: single block of budget minutes, 0 synthesis
        for (int small : new int[]{15, 30, 35, 40, 44, 45}) {
            List<AiService.PlanTimeBlock> bSmall = AiService.computeDeliberateBlocks(small);
            assertEquals(1, bSmall.size());
            assertEquals(small, bSmall.get(0).minutes());
            assertEquals("dsa", bSmall.get(0).roleType());
        }

        // Large budgets: 210, 211, 239, 240, 269, 270, 300, 600
        int[] largeBudgets = {210, 211, 239, 240, 269, 270, 300, 600};
        for (int lb : largeBudgets) {
            List<AiService.PlanTimeBlock> blocks = AiService.computeDeliberateBlocks(lb);
            int sum = blocks.stream().mapToInt(AiService.PlanTimeBlock::minutes).sum();
            assertEquals(lb, sum, "Sum must equal large budget: " + lb);

            List<AiService.PlanTimeBlock> focus = blocks.stream()
                    .filter(b -> !"revision".equals(b.roleType()))
                    .toList();
            assertFalse(focus.isEmpty());

            // Strict role alternation: DSA -> Core CS -> DSA -> Core CS
            for (int i = 0; i < focus.size() - 1; i++) {
                assertNotEquals(focus.get(i).roleType(), focus.get(i + 1).roleType(),
                        "Focus blocks at index " + i + " and " + (i + 1) + " must alternate roles for budget " + lb);
            }

            // Synthesis <= 30m
            blocks.stream()
                    .filter(b -> "revision".equals(b.roleType()))
                    .forEach(b -> assertTrue(b.minutes() <= 30, "Synthesis block must be <= 30m for budget " + lb));
        }

        // Specific structural verifications for large budgets:
        // 210m -> 90 (DSA) + 60 (Core CS) + 60 (DSA)
        List<AiService.PlanTimeBlock> b210 = AiService.computeDeliberateBlocks(210);
        assertEquals(List.of(90, 60, 60), b210.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa"), b210.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // 211m -> 90 (DSA) + 60 (Core CS) + 60 (DSA) + 1 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b211 = AiService.computeDeliberateBlocks(211);
        assertEquals(List.of(90, 60, 60, 1), b211.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa", "revision"), b211.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // 239m -> 90 (DSA) + 90 (Core CS) + 45 (DSA) + 14 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b239 = AiService.computeDeliberateBlocks(239);
        assertEquals(List.of(90, 90, 45, 14), b239.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa", "revision"), b239.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // 240m -> 90 (DSA) + 90 (Core CS) + 60 (DSA)
        List<AiService.PlanTimeBlock> b240 = AiService.computeDeliberateBlocks(240);
        assertEquals(List.of(90, 90, 60), b240.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa"), b240.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // 269m -> 90 (DSA) + 90 (Core CS) + 60 (DSA) + 29 (Synthesis <= 30)
        List<AiService.PlanTimeBlock> b269 = AiService.computeDeliberateBlocks(269);
        assertEquals(List.of(90, 90, 60, 29), b269.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa", "revision"), b269.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // 270m -> 90 (DSA) + 90 (Core CS) + 90 (DSA)
        List<AiService.PlanTimeBlock> b270 = AiService.computeDeliberateBlocks(270);
        assertEquals(List.of(90, 90, 90), b270.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa"), b270.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // 300m -> 90 (DSA) + 90 (Core CS) + 60 (DSA) + 60 (Core CS)
        List<AiService.PlanTimeBlock> b300 = AiService.computeDeliberateBlocks(300);
        assertEquals(List.of(90, 90, 60, 60), b300.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa", "core_cs"), b300.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // 600m -> 6 x 90m + 1 x 60m with strict alternating roles
        List<AiService.PlanTimeBlock> b600 = AiService.computeDeliberateBlocks(600);
        assertEquals(List.of(90, 90, 90, 90, 90, 90, 60), b600.stream().map(AiService.PlanTimeBlock::minutes).toList());
        assertEquals(List.of("dsa", "core_cs", "dsa", "core_cs", "dsa", "core_cs", "dsa"),
                b600.stream().map(AiService.PlanTimeBlock::roleType).toList());

        // Input boundaries: 0 and negative budgets throw IllegalArgumentException
        assertThrows(IllegalArgumentException.class, () -> AiService.computeDeliberateBlocks(0));
        assertThrows(IllegalArgumentException.class, () -> AiService.computeDeliberateBlocks(-1));
        assertThrows(IllegalArgumentException.class, () -> AiService.computeDeliberateBlocks(-60));
    }

    @Test
    @DisplayName("Exhaustive verification of computeDeliberateBlocks for every integer budget 1 through 1000")
    void testExhaustiveDeliberateBlocksScan1Through1000() {
        for (int budget = 1; budget <= 1000; budget++) {
            List<AiService.PlanTimeBlock> blocks = AiService.computeDeliberateBlocks(budget);
            assertNotNull(blocks, "Blocks must not be null for budget " + budget);
            assertFalse(blocks.isEmpty(), "Blocks must not be empty for budget " + budget);

            int totalMinutes = 0;
            List<AiService.PlanTimeBlock> focusBlocks = new ArrayList<>();

            for (AiService.PlanTimeBlock b : blocks) {
                assertTrue(b.minutes() > 0,
                        "Every block must have a positive duration, found " + b.minutes() + " for budget " + budget);
                totalMinutes += b.minutes();

                if ("revision".equals(b.roleType())) {
                    assertTrue(b.minutes() <= 30,
                            "Synthesis/revision block must be <= 30m, found " + b.minutes() + "m for budget " + budget);
                } else {
                    focusBlocks.add(b);
                    if (budget > 45) {
                        assertTrue(b.minutes() == 45 || b.minutes() == 60 || b.minutes() == 90,
                                "Focus block must be 45, 60, or 90m for budget " + budget + ", found: " + b.minutes());
                    }
                }
            }

            assertEquals(budget, totalMinutes, "All block durations must sum exactly to budget " + budget);

            for (int i = 0; i < focusBlocks.size() - 1; i++) {
                assertNotEquals(focusBlocks.get(i).roleType(), focusBlocks.get(i + 1).roleType(),
                        "Focus blocks at index " + i + " and " + (i + 1) + " must alternate roles for budget " + budget);
            }
        }
    }

    @Test
    @DisplayName("Request intake with non-positive timePerDay defaults to 120 minutes")
    void testRequestIntakeNonPositiveTimePerDayDefaultsTo120() {
        assertThrows(IllegalArgumentException.class, () -> AiService.computeDeliberateBlocks(0));
        assertThrows(IllegalArgumentException.class, () -> AiService.computeDeliberateBlocks(-1));
        assertThrows(IllegalArgumentException.class, () -> AiService.computeDeliberateBlocks(-120));

        assertEquals(120, AiService.sanitizeTimePerDay(0));
        assertEquals(120, AiService.sanitizeTimePerDay(-1));
        assertEquals(120, AiService.sanitizeTimePerDay(-60));
        assertEquals(120, AiService.sanitizeTimePerDay(null));
        assertEquals(90, AiService.sanitizeTimePerDay(90));

        CompanyBlueprint msft = roleResearchService.findBlueprint("microsoft").orElseThrow();
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of("companyKey", "msft"));

        // Non-positive timePerDay in generateDeterministicCurriculum safely defaults to 120
        Map<String, Object> planZero = aiService.generateDeterministicCurriculum(msft, report, 0, 1, "SDE");
        List<Map<String, Object>> tasksZero = (List<Map<String, Object>>) planZero.get("tasks");
        assertEquals(120, ((Number) tasksZero.get(0).get("totalEstimatedMinutes")).intValue());

        Map<String, Object> planNeg = aiService.generateDeterministicCurriculum(msft, report, -45, 1, "SDE");
        List<Map<String, Object>> tasksNeg = (List<Map<String, Object>>) planNeg.get("tasks");
        assertEquals(120, ((Number) tasksNeg.get(0).get("totalEstimatedMinutes")).intValue());
    }

    @Test
    @DisplayName("Daily task duration constraint: each day's items must sum exactly to timePerDay using deliberate blocks")
    void testDailyTaskDurationStrictSum() {
        CompanyBlueprint msft = roleResearchService.findBlueprint("microsoft").orElseThrow();
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of("companyKey", "msft"));

        for (int timeBudget : new int[]{60, 90, 120, 150, 180}) {
            Map<String, Object> curriculum = aiService.generateDeterministicCurriculum(msft, report, timeBudget, 1, "SDE");
            List<Map<String, Object>> tasks = (List<Map<String, Object>>) curriculum.get("tasks");
            assertEquals(5, tasks.size(), "Curriculum must have exactly 5 study days");

            List<AiService.PlanTimeBlock> expectedBlocks = AiService.computeDeliberateBlocks(timeBudget);

            for (Map<String, Object> day : tasks) {
                assertEquals(timeBudget, ((Number) day.get("totalEstimatedMinutes")).intValue());
                List<Map<String, Object>> items = (List<Map<String, Object>>) day.get("items");
                assertEquals(expectedBlocks.size(), items.size(), "Day items count should match deliberate blocks count");

                for (int i = 0; i < expectedBlocks.size(); i++) {
                    assertEquals(expectedBlocks.get(i).minutes(), ((Number) items.get(i).get("estimatedMinutes")).intValue(),
                            "Block " + i + " duration must match deliberate policy for " + timeBudget + " mins");
                }

                int itemSum = items.stream()
                        .mapToInt(it -> ((Number) it.get("estimatedMinutes")).intValue())
                        .sum();
                assertEquals(timeBudget, itemSum,
                        "Sum of daily items for " + day.get("day") + " must equal timePerDay (" + timeBudget + " mins)");
            }
        }
    }

    @Test
    @DisplayName("Coding tasks are grounded in canonical LeetCode catalog and contain verified metadata")
    void testCodingTasksGroundedInCatalog() {
        CompanyBlueprint msft = roleResearchService.findBlueprint("microsoft").orElseThrow();
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of("companyKey", "msft"));

        Map<String, Object> curriculum = aiService.generateDeterministicCurriculum(msft, report, 120, 1, "SDE");
        List<Map<String, Object>> tasks = (List<Map<String, Object>>) curriculum.get("tasks");

        for (Map<String, Object> day : tasks) {
            List<Map<String, Object>> items = (List<Map<String, Object>>) day.get("items");
            Map<String, Object> dsaItem = items.stream()
                    .filter(it -> "dsa".equalsIgnoreCase((String) it.get("type")))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("Every day must have at least one DSA coding task"));

            assertNotNull(dsaItem.get("leetcodeId"), "DSA item must have leetcodeId");
            int lcId = ((Number) dsaItem.get("leetcodeId")).intValue();
            assertTrue(leetCodeCatalogService.findByNumber(lcId).isPresent(),
                    "Problem ID #" + lcId + " must exist in canonical catalog");

            String refUrl = (String) dsaItem.get("referenceUrl");
            assertNotNull(refUrl);
            assertTrue(refUrl.startsWith("https://leetcode.com/problems/"),
                    "Reference URL must point to legitimate LeetCode domain");

            String codingLabUrl = (String) dsaItem.get("codingLabUrl");
            assertNotNull(codingLabUrl);
            assertTrue(codingLabUrl.startsWith("/coding-lab?problem="));

            assertNotNull(dsaItem.get("rubricInsight"), "Must have rubricInsight from blueprint");
            assertNotNull(dsaItem.get("whyMattersForRole"), "Must have whyMattersForRole justification");
        }
    }

    @Test
    @DisplayName("Hallucination correction: normalizeAndValidatePlan replaces unverified LeetCode IDs and enforces daily sum")
    void testHallucinationCorrectionAndDurationNormalization() {
        CompanyBlueprint msft = roleResearchService.findBlueprint("microsoft").orElseThrow();

        // Simulate malformed AI output:
        // 1. Only 2 weeks instead of 4
        // 2. Daily items sum to 100 instead of 120
        // 3. Hallucinated problem "LeetCode #99999 - NonExistent Problem"
        List<Map<String, Object>> roadmap = new ArrayList<>();
        roadmap.add(new LinkedHashMap<>(Map.of("week", 1, "title", "Week 1", "estimatedHours", 99)));
        roadmap.add(new LinkedHashMap<>(Map.of("week", 2, "title", "Week 2", "estimatedHours", 99)));

        List<Map<String, Object>> tasks = new ArrayList<>();
        List<Map<String, Object>> day1Items = new ArrayList<>();

        Map<String, Object> fakeDsa = new LinkedHashMap<>();
        fakeDsa.put("title", "Quantum Tree Traversal");
        fakeDsa.put("type", "dsa");
        fakeDsa.put("referenceLabel", "LeetCode #99999");
        fakeDsa.put("referenceUrl", "https://fake-link.com");
        fakeDsa.put("estimatedMinutes", 50);
        day1Items.add(fakeDsa);

        Map<String, Object> coreItem = new LinkedHashMap<>();
        coreItem.put("title", "Database Locks");
        coreItem.put("type", "core_cs");
        coreItem.put("estimatedMinutes", 40);
        day1Items.add(coreItem);

        Map<String, Object> day1 = new LinkedHashMap<>();
        day1.put("day", "Day 1");
        day1.put("totalEstimatedMinutes", 90); // incorrect
        day1.put("items", day1Items);
        tasks.add(day1);

        // Run validation & normalization
        aiService.normalizeAndValidatePlan(roadmap, tasks, msft, 120, 1);

        // 1. Roadmap normalized to 4 weeks with correct 10.0 hours
        assertEquals(4, roadmap.size());
        for (Map<String, Object> w : roadmap) {
            assertEquals(10.0, ((Number) w.get("estimatedHours")).doubleValue(), 0.01);
        }

        // 2. Day 1 items normalized to sum to exactly 120
        assertEquals(120, ((Number) day1.get("totalEstimatedMinutes")).intValue());
        int sum = day1Items.stream().mapToInt(it -> ((Number) it.get("estimatedMinutes")).intValue()).sum();
        assertEquals(120, sum, "Sum must be strictly adjusted to 120");

        // 3. Hallucinated LeetCode #99999 replaced with verified Microsoft ID
        assertNotNull(fakeDsa.get("leetcodeId"));
        int correctedId = ((Number) fakeDsa.get("leetcodeId")).intValue();
        assertTrue(msft.highFrequencyLeetCodeIds().contains(correctedId),
                "Corrected ID should be from Microsoft high-frequency list");
        assertTrue(fakeDsa.get("referenceUrl").toString().startsWith("https://leetcode.com/problems/"));
        assertTrue(fakeDsa.get("codingLabUrl").toString().startsWith("/coding-lab?problem="));
    }

    @Test
    @DisplayName("Valid LeetCode ID resolves accurately to canonical metadata")
    void testValidIdResolvesToCanonicalMetadata() {
        Optional<LeetCodeCatalogService.CanonicalProblemMeta> metaOpt = leetCodeCatalogService.findByNumber(146);
        assertTrue(metaOpt.isPresent());
        LeetCodeCatalogService.CanonicalProblemMeta meta = metaOpt.get();
        assertEquals("146", meta.number());
        assertEquals("LRU Cache", meta.title());
        assertEquals("lru-cache", meta.slug());
        assertEquals("https://leetcode.com/problems/lru-cache/", meta.url());
        assertEquals("Medium", meta.difficulty());
    }

    @Test
    @DisplayName("Offline canonical catalog is immediately ready without waiting for remote network calls")
    void testOfflineCatalogImmediateAvailabilityWithoutRemoteNetwork() {
        LeetCodeCatalogService freshOffline = new LeetCodeCatalogService();
        assertTrue(freshOffline.isReady(), "Catalog must be immediately ready upon construction");
        assertTrue(freshOffline.size() >= 80, "Offline seed must contain at least 80 canonical high-frequency problems");

        // Verify key problems exist synchronously without network dependency
        assertTrue(freshOffline.findByNumber(1).isPresent(), "Two Sum must be present offline");
        assertTrue(freshOffline.findByNumber(200).isPresent(), "Number of Islands must be present offline");
        assertTrue(freshOffline.findByNumber(253).isPresent(), "Meeting Rooms II must be present offline");
    }

    @Test
    @DisplayName("Fallback never misrepresents generic guidance as official company requirements")
    void testFallbackNeverLabelsGenericAsOfficial() {
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of(
                "companyKey", "custom",
                "customCompanyName", "Unknown Startup LLC"
        ));

        assertEquals(true, report.evidenceSummary.get("isGeneralGuidance"));
        assertEquals("General Role Guidance (Unverified Company Specifics)", report.evidenceSummary.get("guidanceClassification"));
        assertEquals("provisional", report.evidenceSummary.get("researchConfidence"));
        assertNotEquals("Official requirement", report.sources.get(0).confidence);
        assertTrue(report.evidenceSummary.get("limitationsNotice").toString().contains("No verified company-specific blueprint"));
    }

    @Test
    @DisplayName("Role archetype differentiation: Daily tasks and topics tailored to AI, Backend, Frontend, and SDE Intern")
    void testRoleArchetypeDifferentiation() {
        CompanyBlueprint msft = roleResearchService.findBlueprint("microsoft").orElseThrow();
        RoleResearchService.ResearchReport report = roleResearchService.conductResearch(Map.of("companyKey", "msft"));

        // 1. AI Engineer
        Map<String, Object> aiPlan = aiService.generateDeterministicCurriculum(msft, report, 90, 1, "AI Engineer");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> aiTasks = (List<Map<String, Object>>) aiPlan.get("tasks");
        assertFalse(aiTasks.isEmpty());
        @SuppressWarnings("unchecked")
        String aiDay1Title = ((List<Map<String, Object>>) aiTasks.get(0).get("items")).get(0).get("title").toString();
        assertTrue(aiDay1Title.toLowerCase().contains("matrix") || aiDay1Title.toLowerCase().contains("image") || aiDay1Title.toLowerCase().contains("ml") || aiDay1Title.toLowerCase().contains("python") || aiDay1Title.contains("74") || aiDay1Title.contains("48"),
                "AI Engineer task should focus on ML/Matrix/Image/Python: " + aiDay1Title);

        // 2. Backend Engineer
        Map<String, Object> backendPlan = aiService.generateDeterministicCurriculum(msft, report, 90, 1, "Backend Engineer");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> backendTasks = (List<Map<String, Object>>) backendPlan.get("tasks");
        @SuppressWarnings("unchecked")
        String backendDay1Title = ((List<Map<String, Object>>) backendTasks.get(0).get("items")).get(0).get("title").toString();
        assertTrue(backendDay1Title.toLowerCase().contains("interval") || backendDay1Title.toLowerCase().contains("cache") || backendDay1Title.toLowerCase().contains("lru") || backendDay1Title.toLowerCase().contains("system") || backendDay1Title.contains("56") || backendDay1Title.contains("146"),
                "Backend Engineer task should focus on intervals/caching/distributed systems: " + backendDay1Title);

        // 3. Frontend Engineer
        Map<String, Object> frontendPlan = aiService.generateDeterministicCurriculum(msft, report, 90, 1, "Frontend Engineer");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> frontendTasks = (List<Map<String, Object>>) frontendPlan.get("tasks");
        @SuppressWarnings("unchecked")
        String frontendDay1Title = ((List<Map<String, Object>>) frontendTasks.get(0).get("items")).get(0).get("title").toString();
        assertTrue(frontendDay1Title.toLowerCase().contains("parentheses") || frontendDay1Title.toLowerCase().contains("string") || frontendDay1Title.toLowerCase().contains("compression") || frontendDay1Title.toLowerCase().contains("dom") || frontendDay1Title.contains("20") || frontendDay1Title.contains("443"),
                "Frontend Engineer task should focus on UI/DOM/Strings: " + frontendDay1Title);

        // 4. SDE Intern
        Map<String, Object> internPlan = aiService.generateDeterministicCurriculum(msft, report, 90, 1, "SDE Intern");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> internTasks = (List<Map<String, Object>>) internPlan.get("tasks");
        @SuppressWarnings("unchecked")
        String internDay1Title = ((List<Map<String, Object>>) internTasks.get(0).get("items")).get(0).get("title").toString();
        assertTrue(internDay1Title.toLowerCase().contains("search") || internDay1Title.toLowerCase().contains("interval") || internDay1Title.toLowerCase().contains("array") || internDay1Title.contains("704") || internDay1Title.contains("56"),
                "SDE Intern task should focus on core fundamentals/binary search/intervals: " + internDay1Title);
    }

    @Test
    @DisplayName("Plan-specific baseline diagnostic: 4 MCQs (Section A) + 1 DSA Coding (Section B) tailored by role")
    void testBaselineQuestionsTailoringAndSections() {
        AssessmentService assessmentService = new AssessmentService(null, null, null, leetCodeCatalogService);

        // Test Generic AI Engineer Baseline
        RoleResearchService.ResearchReport aiReport = new RoleResearchService.ResearchReport();
        aiReport.companyKey = "google";
        aiReport.companyName = "Google";
        aiReport.targetRole = "AI Engineer";
        aiReport.seniority = "Senior";
        aiReport.blueprint = roleResearchService.getBlueprintOrDefault("standard_sde");
        aiReport.evidenceSummary = Map.of("isGeneralGuidance", true);

        List<Map<String, Object>> aiQuestions = assessmentService.buildBaselineQuestions(aiReport);
        assertEquals(5, aiQuestions.size(), "Must contain 4 MCQs + 1 Coding question");
        assertEquals("A", aiQuestions.get(0).get("section"));
        assertEquals("B", aiQuestions.get(4).get("section"));
        assertEquals("coding", aiQuestions.get(4).get("type"));
        assertEquals(74, aiQuestions.get(4).get("leetcodeNumber"));
        assertTrue((Boolean) aiQuestions.get(0).get("isGeneralGuidance"));

        // Test Backend Engineer Baseline (Generic)
        RoleResearchService.ResearchReport backendReport = new RoleResearchService.ResearchReport();
        backendReport.companyKey = "generic";
        backendReport.companyName = "Generic Corp";
        backendReport.targetRole = "Backend Systems Engineer";
        backendReport.seniority = "Mid-Level";
        backendReport.blueprint = roleResearchService.getBlueprintOrDefault("standard_sde");
        backendReport.evidenceSummary = Map.of("isGeneralGuidance", true);

        List<Map<String, Object>> backendQuestions = assessmentService.buildBaselineQuestions(backendReport);
        assertEquals(5, backendQuestions.size());
        assertEquals(56, backendQuestions.get(4).get("leetcodeNumber"));

        // Test Frontend Engineer Baseline (Generic)
        RoleResearchService.ResearchReport frontendReport = new RoleResearchService.ResearchReport();
        frontendReport.companyKey = "generic";
        frontendReport.companyName = "Generic Corp";
        frontendReport.targetRole = "Frontend UI Engineer";
        frontendReport.seniority = "Junior";
        frontendReport.blueprint = roleResearchService.getBlueprintOrDefault("standard_sde");
        frontendReport.evidenceSummary = Map.of("isGeneralGuidance", true);

        List<Map<String, Object>> frontendQuestions = assessmentService.buildBaselineQuestions(frontendReport);
        assertEquals(5, frontendQuestions.size());
        assertEquals(20, frontendQuestions.get(4).get("leetcodeNumber"));

        // Test SDE Intern Baseline (Generic)
        RoleResearchService.ResearchReport internReport = new RoleResearchService.ResearchReport();
        internReport.companyKey = "startup";
        internReport.companyName = "Generic Inc";
        internReport.targetRole = "SDE Intern";
        internReport.seniority = "internship";
        internReport.blueprint = null;
        internReport.evidenceSummary = Map.of("isGeneralGuidance", true);

        List<Map<String, Object>> internQuestions = assessmentService.buildBaselineQuestions(internReport);
        assertEquals(5, internQuestions.size());
        assertEquals(704, internQuestions.get(4).get("leetcodeNumber"));
        assertTrue((Boolean) internQuestions.get(0).get("isGeneralGuidance"), "General guidance flag must propagate to questions");
    }

    @Test
    @DisplayName("Company-specific baseline evidence grounding: Microsoft AI Engineer vs Generic AI Engineer with deterministic stability")
    void testCompanySpecificBaselineEvidenceGroundingAiEngineer() {
        AssessmentService assessmentService = new AssessmentService(null, null, null, leetCodeCatalogService);

        // 1. Microsoft AI Engineer (Company-Verified Blueprint)
        RoleResearchService.ResearchReport msftAiReport = roleResearchService.conductResearch(Map.of(
                "companyKey", "msft",
                "targetRole", "AI Engineer",
                "seniority", "Mid-Level"
        ));
        assertNotNull(msftAiReport.blueprint);
        assertEquals("microsoft", msftAiReport.blueprint.companyId());

        List<Map<String, Object>> msftQuestions1 = assessmentService.buildBaselineQuestions(msftAiReport);
        List<Map<String, Object>> msftQuestions2 = assessmentService.buildBaselineQuestions(msftAiReport);

        // Deterministic stability check
        assertEquals(msftQuestions1, msftQuestions2, "Repeat baseline generation must be completely deterministic and stable");

        assertEquals(5, msftQuestions1.size());
        assertFalse((Boolean) msftQuestions1.get(0).get("isGeneralGuidance"), "Microsoft verified blueprint must not be general guidance");
        assertEquals("Microsoft-aligned preparation based on public sources", msftQuestions1.get(0).get("guidanceClassification"));
        assertFalse(msftQuestions1.get(0).get("guidanceClassification").toString().contains("Company-Verified"),
                "Guidance label must not misrepresent community/practice questions as Company-Verified");

        // Section A Q4 grounded in Tier 2 DirectML tensor strides & memory layout documentation
        Map<String, Object> msftQ4 = msftQuestions1.get(3);
        assertEquals("diag_q4", msftQ4.get("id"));
        assertEquals("Engineering Fundamentals & Tensor Memory Layout", msftQ4.get("topic"));
        assertTrue(msftQ4.get("prompt").toString().contains("packed row-major DirectML tensor"));
        assertTrue(msftQ4.get("prompt").toString().contains("width stride of 1"));
        assertEquals("b", msftQ4.get("correctAnswer"));
        assertTrue(msftQ4.get("options").toString().contains("adjacent positions in linear memory"));
        assertEquals("Source-informed technical practice", msftQ4.get("evidenceType"));
        assertTrue(msftQ4.get("provenanceNote").toString().contains("dml-strides"),
                "Provenance must cite DirectML tensor-strides documentation");
        assertTrue(msftQ4.get("provenanceNote").toString().contains("learn.microsoft.com/en-us/windows/ai/directml/dml-strides"),
                "Provenance must reference full DirectML strides documentation path");
        assertTrue(msftQ4.get("provenanceNote").toString().contains("not an official Microsoft interview question"),
                "Must explicitly disclaim being an official Microsoft interview question");
        assertFalse(msftQ4.get("provenanceNote").toString().contains("Company-Verified"),
                "Must not claim Company-Verified");

        // Section B Coding grounded in Microsoft high-frequency LeetCode #48 (Rotate Image)
        Map<String, Object> msftCoding = msftQuestions1.get(4);
        assertEquals("B", msftCoding.get("section"));
        assertEquals("coding", msftCoding.get("type"));
        assertEquals(48, msftCoding.get("leetcodeNumber"));
        assertEquals("Rotate Image", msftCoding.get("taskTitle"));
        assertTrue(msftCoding.get("prompt").toString().contains("rotate the image by 90 degrees"));
        assertEquals("Community-reported candidate problems", msftCoding.get("evidenceType"));
        assertTrue(msftCoding.get("provenanceNote").toString().contains("Community-reported candidate practice problem"));
        assertFalse(msftCoding.get("provenanceNote").toString().contains("Company-Verified"));

        // 2. Generic AI Engineer (e.g. Google - unverified company blueprint)
        RoleResearchService.ResearchReport googleAiReport = roleResearchService.conductResearch(Map.of(
                "companyKey", "google",
                "targetRole", "AI Engineer",
                "seniority", "Mid-Level"
        ));
        assertEquals("standard_sde", googleAiReport.blueprint.companyId(), "Unverified company must fall back to standard_sde blueprint");
        assertTrue((Boolean) googleAiReport.evidenceSummary.get("isGeneralGuidance"));

        List<Map<String, Object>> googleQuestions = assessmentService.buildBaselineQuestions(googleAiReport);
        assertEquals(5, googleQuestions.size());
        assertTrue((Boolean) googleQuestions.get(0).get("isGeneralGuidance"), "Unverified company must have isGeneralGuidance = true");
        assertEquals("General Role Guidance (Unverified Company Specifics)", googleQuestions.get(0).get("guidanceClassification"));

        // Section A Q4 is generic ML metric evaluation
        Map<String, Object> googleQ4 = googleQuestions.get(3);
        assertEquals("ML System Design & Evaluation Metrics", googleQ4.get("topic"));
        assertTrue(googleQ4.get("prompt").toString().contains("false negatives"));

        // Section B Coding is generic LeetCode #74 (Search a 2D Matrix)
        Map<String, Object> googleCoding = googleQuestions.get(4);
        assertEquals(74, googleCoding.get("leetcodeNumber"));
        assertEquals("Search a 2D Matrix", googleCoding.get("taskTitle"));

        // Meaningful differences asserted:
        assertNotEquals(msftQ4.get("topic"), googleQ4.get("topic"), "Section A Q4 must reflect verified company engineering rubric vs generic");
        assertNotEquals(msftCoding.get("leetcodeNumber"), googleCoding.get("leetcodeNumber"), "Section B must select company high-frequency problem vs generic");
    }

    @Test
    @DisplayName("Company-specific baseline evidence grounding: Microsoft SDE Intern vs Generic SDE Intern with deterministic stability")
    void testCompanySpecificBaselineEvidenceGroundingSdeIntern() {
        AssessmentService assessmentService = new AssessmentService(null, null, null, leetCodeCatalogService);

        // 1. Microsoft SDE Intern (Company-Verified Blueprint)
        RoleResearchService.ResearchReport msftInternReport = roleResearchService.conductResearch(Map.of(
                "companyKey", "microsoft",
                "targetRole", "SDE Intern",
                "seniority", "internship"
        ));
        assertNotNull(msftInternReport.blueprint);
        assertEquals("microsoft", msftInternReport.blueprint.companyId());

        List<Map<String, Object>> msftQuestions1 = assessmentService.buildBaselineQuestions(msftInternReport);
        List<Map<String, Object>> msftQuestions2 = assessmentService.buildBaselineQuestions(msftInternReport);

        // Deterministic stability check
        assertEquals(msftQuestions1, msftQuestions2, "Repeat baseline generation must be completely deterministic and stable");

        assertEquals(5, msftQuestions1.size());
        assertFalse((Boolean) msftQuestions1.get(0).get("isGeneralGuidance"));
        assertEquals("Microsoft-aligned preparation based on public sources", msftQuestions1.get(0).get("guidanceClassification"));
        assertFalse(msftQuestions1.get(0).get("guidanceClassification").toString().contains("Company-Verified"),
                "Guidance label must not misrepresent community/practice questions as Company-Verified");

        // Section A Q4 grounded in Microsoft official careers rubric guidance (clarifying constraints and edge cases)
        Map<String, Object> msftQ4 = msftQuestions1.get(3);
        assertEquals("diag_q4", msftQ4.get("id"));
        assertEquals("Technical Problem Solving & Edge Case Invariants", msftQ4.get("topic"));
        assertTrue(msftQ4.get("prompt").toString().contains("Microsoft's official technical interview guidance"));
        assertEquals("Official employer interview guidance", msftQ4.get("evidenceType"));
        assertTrue(msftQ4.get("provenanceNote").toString().contains("careers.microsoft.com"));

        // Section B Coding grounded in Microsoft high-frequency LeetCode #56 (Merge Intervals)
        Map<String, Object> msftCoding = msftQuestions1.get(4);
        assertEquals(56, msftCoding.get("leetcodeNumber"));
        assertEquals("Merge Intervals", msftCoding.get("taskTitle"));
        assertEquals("Community-reported candidate problems", msftCoding.get("evidenceType"));
        assertTrue(msftCoding.get("provenanceNote").toString().contains("Community-reported candidate practice problem"));
        assertFalse(msftCoding.get("provenanceNote").toString().contains("Company-Verified"));

        // 2. Generic SDE Intern (e.g. Google SDE Intern - unverified company blueprint)
        RoleResearchService.ResearchReport googleInternReport = roleResearchService.conductResearch(Map.of(
                "companyKey", "google",
                "targetRole", "SDE Intern",
                "seniority", "internship"
        ));
        assertEquals("standard_sde", googleInternReport.blueprint.companyId());
        assertTrue((Boolean) googleInternReport.evidenceSummary.get("isGeneralGuidance"));

        List<Map<String, Object>> googleQuestions = assessmentService.buildBaselineQuestions(googleInternReport);
        assertEquals(5, googleQuestions.size());
        assertTrue((Boolean) googleQuestions.get(0).get("isGeneralGuidance"));
        assertEquals("General Role Guidance (Unverified Company Specifics)", googleQuestions.get(0).get("guidanceClassification"));
        assertEquals("General role guidance", googleQuestions.get(0).get("evidenceType"));

        // Section A Q4 is generic Operating Systems Coffman deadlock conditions
        Map<String, Object> googleQ4 = googleQuestions.get(3);
        assertEquals("Operating Systems & Concurrency", googleQ4.get("topic"));
        assertTrue(googleQ4.get("prompt").toString().contains("Coffman's four necessary conditions"));
        assertEquals("General role guidance", googleQ4.get("evidenceType"));

        // Section B Coding is generic LeetCode #704 (Binary Search)
        Map<String, Object> googleCoding = googleQuestions.get(4);
        assertEquals(704, googleCoding.get("leetcodeNumber"));
        assertEquals("Binary Search", googleCoding.get("taskTitle"));
        assertEquals("General role guidance", googleCoding.get("evidenceType"));

        // Meaningful differences asserted:
        assertNotEquals(msftQ4.get("topic"), googleQ4.get("topic"));
        assertNotEquals(msftCoding.get("leetcodeNumber"), googleCoding.get("leetcodeNumber"));
    }
}
