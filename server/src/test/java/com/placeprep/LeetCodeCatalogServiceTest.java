package com.placeprep;

import com.placeprep.service.LeetCodeCatalogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class LeetCodeCatalogServiceTest {

    private LeetCodeCatalogService catalogService;

    @BeforeEach
    void setUp() {
        catalogService = new LeetCodeCatalogService();
    }

    @Test
    @DisplayName("Catalog is seeded immediately and ready without waiting for remote network calls")
    void testImmediateReadiness() {
        assertTrue(catalogService.isReady());
        assertTrue(catalogService.size() >= 50, "Pre-seeded catalog should contain essential problems");
    }

    @Test
    @DisplayName("Lookups by number and slug resolve canonical problem metadata")
    void testLookupsByNumberAndSlug() {
        // Two Sum (#1)
        Optional<LeetCodeCatalogService.CanonicalProblemMeta> twoSumOpt = catalogService.findByNumber(1);
        assertTrue(twoSumOpt.isPresent());
        assertEquals("1", twoSumOpt.get().number());
        assertEquals("two-sum", twoSumOpt.get().slug());
        assertEquals("Two Sum", twoSumOpt.get().title());
        assertEquals("Easy", twoSumOpt.get().difficulty());
        assertEquals("https://leetcode.com/problems/two-sum/", twoSumOpt.get().url());

        // LRU Cache (#146)
        Optional<LeetCodeCatalogService.CanonicalProblemMeta> lruOpt = catalogService.findBySlug("lru-cache");
        assertTrue(lruOpt.isPresent());
        assertEquals("146", lruOpt.get().number());
        assertEquals("LRU Cache", lruOpt.get().title());
        assertEquals("Medium", lruOpt.get().difficulty());
        assertFalse(lruOpt.get().isPaidOnly());

        // Meeting Rooms II (#253)
        Optional<LeetCodeCatalogService.CanonicalProblemMeta> mrOpt = catalogService.findByNumber(253);
        assertTrue(mrOpt.isPresent());
        assertEquals("meeting-rooms-ii", mrOpt.get().slug());
        assertEquals("Meeting Rooms II", mrOpt.get().title());
        assertTrue(mrOpt.get().isPaidOnly());
    }

    @Test
    @DisplayName("Fuzzy and query-based lookups extract problem IDs accurately")
    void testQueryLookups() {
        assertTrue(catalogService.findProblem("LeetCode #146").isPresent());
        assertEquals("146", catalogService.findProblem("LeetCode #146").get().number());

        assertTrue(catalogService.findProblem("lc 200").isPresent());
        assertEquals("200", catalogService.findProblem("lc 200").get().number());

        assertTrue(catalogService.findProblem("Trapping Rain Water").isPresent());
        assertEquals("42", catalogService.findProblem("Trapping Rain Water").get().number());

        assertFalse(catalogService.findProblem("NonExistentFakeProblem999999").isPresent());
    }

    @Test
    @DisplayName("All verified Microsoft high-frequency IDs exist in catalog")
    void testMicrosoftHighFrequencyCoverage() {
        List<Integer> msftIds = List.of(1, 146, 253, 200, 207, 79, 138, 297, 443, 124, 215, 56, 460, 42);
        for (Integer id : msftIds) {
            Optional<LeetCodeCatalogService.CanonicalProblemMeta> meta = catalogService.findByNumber(id);
            assertTrue(meta.isPresent(), "Microsoft verified ID #" + id + " must exist in LeetCode catalog");
            assertNotNull(meta.get().title());
            assertNotNull(meta.get().slug());
            assertNotNull(meta.get().url());
        }
    }
}
