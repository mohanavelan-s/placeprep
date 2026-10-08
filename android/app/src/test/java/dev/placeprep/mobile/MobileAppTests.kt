package dev.placeprep.mobile

import com.google.gson.Gson
import dev.placeprep.mobile.data.AiDailyEvaluationResponse
import dev.placeprep.mobile.data.AiStuckHelpResponse
import dev.placeprep.mobile.data.PrepPlan
import dev.placeprep.mobile.data.TaskItem
import dev.placeprep.mobile.notification.PlacePrepNotificationManager
import dev.placeprep.mobile.ui.MobileStrings
import org.junit.Assert.*
import org.junit.Test

class MobileAppTests {

    private val gson = Gson()

    @Test
    fun testLocalizationHasRequiredKeysAcrossLanguages() {
        val requiredKeys = listOf(
            "chamber",
            "tasks",
            "architect",
            "mentor",
            "settings",
            "coach_me_through_it",
            "evaluate_performance",
            "push_notifications",
            "permission_granted",
            "permission_denied",
        )

        for (lang in listOf("en", "ta", "hi")) {
            for (key in requiredKeys) {
                val value = MobileStrings.get(key, lang)
                assertNotNull("Key '$key' should return a value for lang '$lang'", value)
                assertTrue("Key '$key' for lang '$lang' should not be blank", value.isNotBlank())
            }
        }
    }

    @Test
    fun testTaskItemSerialization() {
        val json = """
            {
                "id": "task-101",
                "title": "Solve 3-Sum Problem",
                "category": "dsa",
                "priority": "high",
                "status": "pending",
                "estimatedMinutes": 45,
                "difficulty": "medium"
            }
        """.trimIndent()

        val task = gson.fromJson(json, TaskItem::class.java)
        assertEquals("task-101", task.id)
        assertEquals("Solve 3-Sum Problem", task.title)
        assertEquals(45, task.estimatedMinutes)
        assertEquals("pending", task.status)
        assertEquals("high", task.priority)
    }

    @Test
    fun testAiStuckHelpContractSerialization() {
        val json = """
            {
                "hint": "Consider using two pointers after sorting the array.",
                "approachSteps": ["Sort nums", "Loop with i", "Use two pointers for j and k"],
                "similarProblems": ["Two Sum II", "4Sum"],
                "youtubeSearchKeywords": ["3Sum two pointers", "Neetcode 3sum"],
                "topic": "Array & Two Pointers",
                "usedFallback": false
            }
        """.trimIndent()

        val help = gson.fromJson(json, AiStuckHelpResponse::class.java)
        assertNotNull(help.hint)
        assertEquals(3, help.approachSteps.size)
        assertEquals(2, help.similarProblems.size)
        assertEquals(2, help.youtubeSearchKeywords.size)
        assertFalse(help.usedFallback)
    }

    @Test
    fun testDailyEvaluationContractSerialization() {
        val json = """
            {
                "score": 85,
                "verdict": "Consistent Execution",
                "evaluation": "Strong problem-solving momentum.",
                "weakAreas": ["Graph BFS"],
                "tomorrowImprovements": ["Practice 1 topological sort problem"],
                "usedFallback": false
            }
        """.trimIndent()

        val eval = gson.fromJson(json, AiDailyEvaluationResponse::class.java)
        assertEquals(85, eval.score)
        assertEquals("Consistent Execution", eval.verdict)
        assertEquals(1, eval.weakAreas.size)
        assertEquals(1, eval.tomorrowImprovements.size)
    }

    @Test
    fun testNotificationChannelConstants() {
        assertEquals("placeprep_channel_tasks", PlacePrepNotificationManager.CHANNEL_TASKS)
        assertEquals("placeprep_channel_signals", PlacePrepNotificationManager.CHANNEL_SIGNALS)
        assertEquals("placeprep_channel_motivation", PlacePrepNotificationManager.CHANNEL_MOTIVATION)
    }

    @Test
    fun testCodingProblemSummaryNullSafety() {
        val json = """
            {
                "platform": "leetcode",
                "number": "1",
                "slug": "two-sum",
                "title": "Two Sum",
                "difficulty": "Easy",
                "description": "Given an array of integers nums and an integer target, return indices..."
            }
        """.trimIndent()

        val problem = gson.fromJson(json, dev.placeprep.mobile.data.CodingProblemSummary::class.java)
        assertEquals("Two Sum", problem.title)
        assertEquals("two-sum", problem.slug)
        assertEquals("Easy", problem.difficulty)
        // Null-safe access must not crash:
        val categoryStr = (problem.category ?: "DSA").uppercase()
        assertEquals("DSA", categoryStr)
    }

    @Test
    fun testAssessmentOverviewDeserialization() {
        val json = """
            {
                "averageScore": 78.5,
                "completedCount": 4,
                "totalAssessments": 6,
                "identifiedWeakSpots": ["Dynamic Programming", "SQL"],
                "recentSessions": [
                    {
                        "id": "session-1",
                        "status": "completed",
                        "score": 80.0,
                        "assessmentType": "mcq"
                    }
                ]
            }
        """.trimIndent()

        val overview = gson.fromJson(json, dev.placeprep.mobile.data.AssessmentOverview::class.java)
        assertEquals(78.5, overview.averageScore, 0.01)
        assertEquals(4, overview.completedCount)
        assertEquals(6, overview.totalAssessments)
        assertEquals(2, overview.identifiedWeakSpots.size)
        assertEquals(1, overview.recentSessions.size)
        assertEquals(80.0, overview.recentSessions[0].score ?: 0.0, 0.01)
    }
}
