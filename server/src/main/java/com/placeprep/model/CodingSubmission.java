package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class CodingSubmission {

    private UUID id;
    private UUID userId;
    private UUID taskId;
    private Map<String, Object> problem = new HashMap<>();
    private String language;
    private String sourceCode;
    private String stdin;
    private String expectedOutput;
    private String status = "accepted";
    private String stdout;
    private String stderr;
    private String compileOutput;
    private String judgeToken;
    private Double time = 0.05;
    private Integer memory = 10240;
    private List<Map<String, Object>> testResults = List.of();
    private Map<String, Object> analysis = new HashMap<>();
    private Map<String, Object> rubric = new HashMap<>();
    private Double score = 100.0;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public CodingSubmission() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }

    public Map<String, Object> getProblem() { return problem; }
    public void setProblem(Map<String, Object> problem) { this.problem = problem != null ? problem : new HashMap<>(); }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getSourceCode() { return sourceCode; }
    public void setSourceCode(String sourceCode) { this.sourceCode = sourceCode; }

    public String getStdin() { return stdin; }
    public void setStdin(String stdin) { this.stdin = stdin; }

    public String getExpectedOutput() { return expectedOutput; }
    public void setExpectedOutput(String expectedOutput) { this.expectedOutput = expectedOutput; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStdout() { return stdout; }
    public void setStdout(String stdout) { this.stdout = stdout; }

    public String getStderr() { return stderr; }
    public void setStderr(String stderr) { this.stderr = stderr; }

    public String getCompileOutput() { return compileOutput; }
    public void setCompileOutput(String compileOutput) { this.compileOutput = compileOutput; }

    public String getJudgeToken() { return judgeToken; }
    public void setJudgeToken(String judgeToken) { this.judgeToken = judgeToken; }

    public Double getTime() { return time; }
    public void setTime(Double time) { this.time = time; }

    public Integer getMemory() { return memory; }
    public void setMemory(Integer memory) { this.memory = memory; }

    public List<Map<String, Object>> getTestResults() { return testResults; }
    public void setTestResults(List<Map<String, Object>> testResults) { this.testResults = testResults != null ? testResults : List.of(); }

    public Map<String, Object> getAnalysis() { return analysis; }
    public void setAnalysis(Map<String, Object> analysis) { this.analysis = analysis != null ? analysis : new HashMap<>(); }

    public Map<String, Object> getRubric() { return rubric; }
    public void setRubric(Map<String, Object> rubric) { this.rubric = rubric != null ? rubric : new HashMap<>(); }

    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
