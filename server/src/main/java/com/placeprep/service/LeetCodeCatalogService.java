package com.placeprep.service;

import com.placeprep.util.JsonUtil;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Single source of truth for verified LeetCode problem metadata.
 * Acyclic leaf service: does NOT depend on AiService or CodingService.
 */
@Service
public class LeetCodeCatalogService {

    public record CanonicalProblemMeta(
            String number,
            String slug,
            String title,
            String url,
            String difficulty,
            List<String> topics,
            boolean isPaidOnly,
            String source
    ) {
        public CanonicalProblemMeta {
            topics = topics != null ? List.copyOf(topics) : List.of();
            if (url == null || url.isBlank()) {
                url = "https://leetcode.com/problems/" + (slug != null ? slug : "problem-" + number) + "/";
            }
        }
    }

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final Map<String, CanonicalProblemMeta> byNumber = new ConcurrentHashMap<>();
    private final Map<String, CanonicalProblemMeta> bySlug = new ConcurrentHashMap<>();
    private volatile boolean remoteLoaded = false;

    public LeetCodeCatalogService() {
        seedCanonicalCatalog();
        CompletableFuture.runAsync(this::loadRemoteCatalogSafely);
    }

    public boolean isReady() {
        return !byNumber.isEmpty();
    }

    public boolean isRemoteLoaded() {
        return remoteLoaded;
    }

    public int size() {
        return byNumber.size();
    }

    public Optional<CanonicalProblemMeta> findByNumber(String number) {
        if (number == null || number.isBlank()) return Optional.empty();
        return Optional.ofNullable(byNumber.get(number.trim()));
    }

    public Optional<CanonicalProblemMeta> findByNumber(int number) {
        return findByNumber(String.valueOf(number));
    }

    public Optional<CanonicalProblemMeta> findBySlug(String slug) {
        if (slug == null || slug.isBlank()) return Optional.empty();
        return Optional.ofNullable(bySlug.get(slug.trim().toLowerCase()));
    }

    public Optional<CanonicalProblemMeta> findProblem(String query) {
        if (query == null || query.isBlank()) return Optional.empty();
        String trimmed = query.trim();

        // 1. Check if number or contains #123 / leetcode 123
        Matcher m = Pattern.compile("^(?:(?:leetcode|lc)\\s*#?)?\\s*(\\d{1,5})$", Pattern.CASE_INSENSITIVE).matcher(trimmed);
        if (m.find()) {
            Optional<CanonicalProblemMeta> byNum = findByNumber(m.group(1));
            if (byNum.isPresent()) return byNum;
        }

        // 2. Direct slug lookup
        String slugCandidate = trimmed.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        Optional<CanonicalProblemMeta> bySlg = findBySlug(slugCandidate);
        if (bySlg.isPresent()) return bySlg;

        // 3. Exact title match
        for (CanonicalProblemMeta meta : byNumber.values()) {
            if (meta.title().equalsIgnoreCase(trimmed)) {
                return Optional.of(meta);
            }
        }

        // 4. Extract embedded number
        Matcher m2 = Pattern.compile("(?:leetcode|lc|problem)?\\s*#?\\s*(\\d{1,5})\\b", Pattern.CASE_INSENSITIVE).matcher(trimmed);
        if (m2.find()) {
            Optional<CanonicalProblemMeta> byNum = findByNumber(m2.group(1));
            if (byNum.isPresent()) return byNum;
        }

        return Optional.empty();
    }

    public boolean isKnownProblem(String numberOrSlug) {
        return findProblem(numberOrSlug).isPresent();
    }

    public List<CanonicalProblemMeta> getProblemsByNumbers(List<Integer> numbers) {
        if (numbers == null) return List.of();
        List<CanonicalProblemMeta> list = new ArrayList<>();
        for (Integer num : numbers) {
            if (num != null) {
                findByNumber(num).ifPresent(list::add);
            }
        }
        return list;
    }

    public List<CanonicalProblemMeta> getProblemsByTopic(String topic) {
        if (topic == null || topic.isBlank()) return List.of();
        String lower = topic.trim().toLowerCase();
        List<CanonicalProblemMeta> list = new ArrayList<>();
        for (CanonicalProblemMeta p : byNumber.values()) {
            if (p.topics().stream().anyMatch(t -> t.toLowerCase().contains(lower))) {
                list.add(p);
            }
        }
        return list;
    }

    public void register(
            String number,
            String slug,
            String title,
            String difficulty,
            List<String> topics,
            boolean isPaidOnly,
            String source
    ) {
        String num = number != null ? number.trim() : "";
        String slg = slug != null ? slug.trim().toLowerCase() : "";
        if (num.isBlank() && slg.isBlank()) return;

        CanonicalProblemMeta meta = new CanonicalProblemMeta(
                num,
                slg,
                title != null ? title.trim() : (slg.isBlank() ? "Problem " + num : slg),
                "https://leetcode.com/problems/" + slg + "/",
                difficulty != null ? difficulty : "Medium",
                topics,
                isPaidOnly,
                source != null ? source : "canonical"
        );
        if (!num.isBlank()) byNumber.put(num, meta);
        if (!slg.isBlank()) bySlug.put(slg, meta);
    }

    private void seedCanonicalCatalog() {
        // High-Frequency Microsoft + Standard SDE + Core Algorithms
        register("1", "two-sum", "Two Sum", "Easy", List.of("Array", "Hash Table"), false, "canonical");
        register("2", "add-two-numbers", "Add Two Numbers", "Medium", List.of("Linked List", "Math", "Recursion"), false, "canonical");
        register("3", "longest-substring-without-repeating-characters", "Longest Substring Without Repeating Characters", "Medium", List.of("Hash Table", "String", "Sliding Window"), false, "canonical");
        register("4", "median-of-two-sorted-arrays", "Median of Two Sorted Arrays", "Hard", List.of("Array", "Binary Search", "Divide and Conquer"), false, "canonical");
        register("5", "longest-palindromic-substring", "Longest Palindromic Substring", "Medium", List.of("String", "Dynamic Programming"), false, "canonical");
        register("11", "container-with-most-water", "Container With Most Water", "Medium", List.of("Array", "Two Pointers", "Greedy"), false, "canonical");
        register("15", "3sum", "3Sum", "Medium", List.of("Array", "Two Pointers", "Sorting"), false, "canonical");
        register("20", "valid-parentheses", "Valid Parentheses", "Easy", List.of("String", "Stack"), false, "canonical");
        register("21", "merge-two-sorted-lists", "Merge Two Sorted Lists", "Easy", List.of("Linked List", "Recursion"), false, "canonical");
        register("22", "generate-parentheses", "Generate Parentheses", "Medium", List.of("String", "Dynamic Programming", "Backtracking"), false, "canonical");
        register("26", "remove-duplicates-from-sorted-array", "Remove Duplicates from Sorted Array", "Easy", List.of("Array", "Two Pointers"), false, "canonical");
        register("33", "search-in-rotated-sorted-array", "Search in Rotated Sorted Array", "Medium", List.of("Array", "Binary Search"), false, "canonical");
        register("42", "trapping-rain-water", "Trapping Rain Water", "Hard", List.of("Array", "Two Pointers", "Dynamic Programming", "Stack"), false, "canonical");
        register("46", "permutations", "Permutations", "Medium", List.of("Array", "Backtracking"), false, "canonical");
        register("48", "rotate-image", "Rotate Image", "Medium", List.of("Array", "Math", "Matrix"), false, "canonical");
        register("49", "group-anagrams", "Group Anagrams", "Medium", List.of("Array", "Hash Table", "String", "Sorting"), false, "canonical");
        register("53", "maximum-subarray", "Maximum Subarray", "Medium", List.of("Array", "Divide and Conquer", "Dynamic Programming"), false, "canonical");
        register("56", "merge-intervals", "Merge Intervals", "Medium", List.of("Array", "Sorting"), false, "canonical");
        register("70", "climbing-stairs", "Climbing Stairs", "Easy", List.of("Math", "Dynamic Programming", "Memoization"), false, "canonical");
        register("72", "edit-distance", "Edit Distance", "Medium", List.of("String", "Dynamic Programming"), false, "canonical");
        register("74", "search-a-2d-matrix", "Search a 2D Matrix", "Medium", List.of("Array", "Binary Search", "Matrix"), false, "canonical");
        register("75", "sort-colors", "Sort Colors", "Medium", List.of("Array", "Two Pointers", "Sorting"), false, "canonical");
        register("76", "minimum-window-substring", "Minimum Window Substring", "Hard", List.of("Hash Table", "String", "Sliding Window"), false, "canonical");
        register("79", "word-search", "Word Search", "Medium", List.of("Array", "Backtracking", "Matrix"), false, "canonical");
        register("98", "validate-binary-search-tree", "Validate Binary Search Tree", "Medium", List.of("Tree", "Depth-First Search", "Binary Search Tree", "Binary Tree"), false, "canonical");
        register("102", "binary-tree-level-order-traversal", "Binary Tree Level Order Traversal", "Medium", List.of("Tree", "Breadth-First Search", "Binary Tree"), false, "canonical");
        register("104", "maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree", "Easy", List.of("Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"), false, "canonical");
        register("121", "best-time-to-buy-and-sell-stock", "Best Time to Buy and Sell Stock", "Easy", List.of("Array", "Dynamic Programming"), false, "canonical");
        register("124", "binary-tree-maximum-path-sum", "Binary Tree Maximum Path Sum", "Hard", List.of("Dynamic Programming", "Tree", "Depth-First Search", "Binary Tree"), false, "canonical");
        register("125", "valid-palindrome", "Valid Palindrome", "Easy", List.of("Two Pointers", "String"), false, "canonical");
        register("138", "copy-list-with-random-pointer", "Copy List with Random Pointer", "Medium", List.of("Hash Table", "Linked List"), false, "canonical");
        register("141", "linked-list-cycle", "Linked List Cycle", "Easy", List.of("Hash Table", "Linked List", "Two Pointers"), false, "canonical");
        register("146", "lru-cache", "LRU Cache", "Medium", List.of("Hash Table", "Linked List", "Design", "Doubly-Linked List"), false, "canonical");
        register("152", "maximum-product-subarray", "Maximum Product Subarray", "Medium", List.of("Array", "Dynamic Programming"), false, "canonical");
        register("155", "min-stack", "Min Stack", "Medium", List.of("Stack", "Design"), false, "canonical");
        register("160", "intersection-of-two-linked-lists", "Intersection of Two Linked Lists", "Easy", List.of("Hash Table", "Linked List", "Two Pointers"), false, "canonical");

        // SQL Problems
        register("175", "combine-two-tables", "Combine Two Tables", "Easy", List.of("Database"), false, "canonical");
        register("176", "second-highest-salary", "Second Highest Salary", "Medium", List.of("Database"), false, "canonical");
        register("177", "nth-highest-salary", "Nth Highest Salary", "Medium", List.of("Database"), false, "canonical");
        register("178", "rank-scores", "Rank Scores", "Medium", List.of("Database"), false, "canonical");
        register("180", "consecutive-numbers", "Consecutive Numbers", "Medium", List.of("Database"), false, "canonical");
        register("181", "employees-earning-more-than-their-managers", "Employees Earning More Than Their Managers", "Easy", List.of("Database"), false, "canonical");
        register("182", "duplicate-emails", "Duplicate Emails", "Easy", List.of("Database"), false, "canonical");
        register("183", "customers-who-never-order", "Customers Who Never Order", "Easy", List.of("Database"), false, "canonical");
        register("184", "department-highest-salary", "Department Highest Salary", "Medium", List.of("Database"), false, "canonical");
        register("185", "department-top-three-salaries", "Department Top Three Salaries", "Hard", List.of("Database"), false, "canonical");
        register("196", "delete-duplicate-emails", "Delete Duplicate Emails", "Easy", List.of("Database"), false, "canonical");
        register("197", "rising-temperature", "Rising Temperature", "Easy", List.of("Database"), false, "canonical");

        // Graphs, Trees, Heaps
        register("200", "number-of-islands", "Number of Islands", "Medium", List.of("Array", "Depth-First Search", "Breadth-First Search", "Union Find", "Matrix"), false, "canonical");
        register("206", "reverse-linked-list", "Reverse Linked List", "Easy", List.of("Linked List", "Recursion"), false, "canonical");
        register("207", "course-schedule", "Course Schedule", "Medium", List.of("Depth-First Search", "Breadth-First Search", "Graph", "Topological Sort"), false, "canonical");
        register("208", "implement-trie-prefix-tree", "Implement Trie (Prefix Tree)", "Medium", List.of("Hash Table", "String", "Design", "Trie"), false, "canonical");
        register("215", "kth-largest-element-in-an-array", "Kth Largest Element in an Array", "Medium", List.of("Array", "Divide and Conquer", "Sorting", "Heap (Priority Queue)", "Quickselect"), false, "canonical");
        register("217", "contains-duplicate", "Contains Duplicate", "Easy", List.of("Array", "Hash Table", "Sorting"), false, "canonical");
        register("226", "invert-binary-tree", "Invert Binary Tree", "Easy", List.of("Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"), false, "canonical");
        register("232", "implement-queue-using-stacks", "Implement Queue using Stacks", "Easy", List.of("Stack", "Design", "Queue"), false, "canonical");
        register("236", "lowest-common-ancestor-of-a-binary-tree", "Lowest Common Ancestor of a Binary Tree", "Medium", List.of("Tree", "Depth-First Search", "Binary Tree"), false, "canonical");
        register("238", "product-of-array-except-self", "Product of Array Except Self", "Medium", List.of("Array", "Prefix Sum"), false, "canonical");
        register("242", "valid-anagram", "Valid Anagram", "Easy", List.of("Hash Table", "String", "Sorting"), false, "canonical");

        // Microsoft High-Frequency Additions
        register("253", "meeting-rooms-ii", "Meeting Rooms II", "Medium", List.of("Array", "Two Pointers", "Sorting", "Heap (Priority Queue)"), true, "canonical");
        register("297", "serialize-and-deserialize-binary-tree", "Serialize and Deserialize Binary Tree", "Hard", List.of("String", "Tree", "Depth-First Search", "Breadth-First Search", "Design", "Binary Tree"), false, "canonical");
        register("300", "longest-increasing-subsequence", "Longest Increasing Subsequence", "Medium", List.of("Array", "Binary Search", "Dynamic Programming"), false, "canonical");
        register("347", "top-k-frequent-elements", "Top K Frequent Elements", "Medium", List.of("Array", "Hash Table", "Divide and Conquer", "Sorting", "Heap (Priority Queue)", "Bucket Sort", "Counting", "Quickselect"), false, "canonical");
        register("416", "partition-equal-subset-sum", "Partition Equal Subset Sum", "Medium", List.of("Array", "Dynamic Programming"), false, "canonical");
        register("424", "longest-repeating-character-replacement", "Longest Repeating Character Replacement", "Medium", List.of("Hash Table", "String", "Sliding Window"), false, "canonical");
        register("443", "string-compression", "String Compression", "Medium", List.of("Two Pointers", "String"), false, "canonical");
        register("460", "lfu-cache", "LFU Cache", "Hard", List.of("Hash Table", "Linked List", "Design", "Doubly-Linked List"), false, "canonical");
        register("543", "diameter-of-binary-tree", "Diameter of Binary Tree", "Easy", List.of("Tree", "Depth-First Search", "Binary Tree"), false, "canonical");

        // Additional SQL
        register("570", "managers-with-at-least-5-direct-reports", "Managers with at Least 5 Direct Reports", "Medium", List.of("Database"), false, "canonical");
        register("584", "find-customer-referee", "Find Customer Referee", "Easy", List.of("Database"), false, "canonical");
        register("595", "big-countries", "Big Countries", "Easy", List.of("Database"), false, "canonical");
        register("620", "not-boring-movies", "Not Boring Movies", "Easy", List.of("Database"), false, "canonical");
        register("704", "binary-search", "Binary Search", "Easy", List.of("Array", "Binary Search"), false, "canonical");
        register("1143", "longest-common-subsequence", "Longest Common Subsequence", "Medium", List.of("String", "Dynamic Programming"), false, "canonical");
        register("1193", "monthly-transactions-i", "Monthly Transactions I", "Medium", List.of("Database"), false, "canonical");
        register("1280", "students-and-examinations", "Students and Examinations", "Easy", List.of("Database"), false, "canonical");
        register("1378", "replace-employee-id-with-the-unique-identifier", "Replace Employee ID With The Unique Identifier", "Easy", List.of("Database"), false, "canonical");
        register("1667", "fix-names-in-a-table", "Fix Names in a Table", "Easy", List.of("Database"), false, "canonical");
        register("1757", "recyclable-and-low-fat-products", "Recyclable and Low Fat Products", "Easy", List.of("Database"), false, "canonical");
        register("1934", "confirmation-rate", "Confirmation Rate", "Medium", List.of("Database"), false, "canonical");
    }

    private void loadRemoteCatalogSafely() {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://leetcode.com/api/problems/all/"))
                    .header("User-Agent", "Mozilla/5.0 PlacePrep-DeterministicEngine/1.0")
                    .timeout(Duration.ofSeconds(6))
                    .GET()
                    .build();
            HttpResponse<String> res = HTTP_CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 200 && res.body() != null && !res.body().isBlank()) {
                Map<String, Object> map = JsonUtil.toMap(res.body());
                if (map.containsKey("stat_status_pairs")) {
                    List<?> pairs = (List<?>) map.get("stat_status_pairs");
                    for (Object pObj : pairs) {
                        if (pObj instanceof Map<?, ?> pMap) {
                            Object statObj = pMap.get("stat");
                            boolean paidOnly = Boolean.TRUE.equals(pMap.get("paid_only"));
                            Object diffObj = pMap.get("difficulty");
                            String diffStr = "Medium";
                            if (diffObj instanceof Map<?, ?> diffMap) {
                                Object lvl = diffMap.get("level");
                                if (Objects.equals(lvl, 1)) diffStr = "Easy";
                                else if (Objects.equals(lvl, 3)) diffStr = "Hard";
                            }
                            if (statObj instanceof Map<?, ?> stat) {
                                Object qId = stat.get("frontend_question_id");
                                Object qTitle = stat.get("question__title");
                                Object qSlug = stat.get("question__title_slug");
                                if (qId != null && qSlug != null && qTitle != null) {
                                    String numStr = String.valueOf(qId).trim();
                                    String slugStr = String.valueOf(qSlug).trim().toLowerCase();
                                    String titleStr = String.valueOf(qTitle).trim();
                                    if (!byNumber.containsKey(numStr)) {
                                        register(numStr, slugStr, titleStr, diffStr, List.of(), paidOnly, "leetcode_api");
                                    }
                                }
                            }
                        }
                    }
                    remoteLoaded = true;
                    System.out.println("[LeetCodeCatalogService] Remote catalog loaded: " + byNumber.size() + " total problems indexed.");
                }
            }
        } catch (Exception e) {
            // Gracefully ignore network failures in offline/test environments
            System.err.println("[LeetCodeCatalogService] Remote catalog load skipped/failed (offline/fallback active): " + e.getMessage());
        }
    }
}
