import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PrepPlanView from "@/components/PrepPlanView";
import type { PrepPlan } from "@/lib/api";

describe("PrepPlanView Component", () => {
  it("renders gracefully with empty or missing arrays without crashing", () => {
    const minimalPlan: PrepPlan = {
      id: "plan-1",
      userId: "user-1",
      version: 1,
      targetRole: "Software Development Engineer",
      companyName: "Google",
      durationMonths: 3,
      timePerDay: 120,
      roadmap: [],
      tasks: [],
      resources: [],
      flashcards: [],
      metadata: {},
    };

    render(
      <MemoryRouter>
        <PrepPlanView plan={minimalPlan} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Version 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Current plan/i)).toBeInTheDocument();
  });

  it("renders Baseline Diagnostic Assessment Pending banner when status is assessment_pending", () => {
    const pendingPlan: PrepPlan = {
      id: "plan-2",
      userId: "user-1",
      version: 1,
      status: "assessment_pending",
      targetRole: "SDE Intern",
      companyName: "Amazon",
      durationMonths: 3,
      timePerDay: 120,
      roadmap: [],
      metadata: { status: "assessment_pending" },
    };

    render(
      <MemoryRouter>
        <PrepPlanView plan={pendingPlan} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Baseline Diagnostic Assessment Pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Calibrate Your Roadmap With A 20-Min Diagnostic/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Take Baseline Diagnostic/i });
    expect(link).toHaveAttribute("href", "/assessments");
  });

  it("displays General Role Guidance badge when isGeneralGuidance is true", () => {
    const unverifiedPlan: PrepPlan = {
      id: "plan-3",
      userId: "user-1",
      version: 1,
      targetRole: "Full Stack Engineer",
      companyName: "Custom Tech Corp",
      durationMonths: 2,
      timePerDay: 90,
      isGeneralGuidance: true,
      guidanceClassification: "General Role Guidance (Unverified Company Specifics)",
      roadmap: [],
      researchReport: {
        companyName: "Custom Tech Corp",
        companyKey: "custom",
        targetRole: "Full Stack Engineer",
        seniority: "internship",
        location: "India",
        dateChecked: "2026-10-12",
        sources: [
          {
            title: "Standard Tech Industry Competency Matrix: Full Stack Engineer",
            url: "https://www.geeksforgeeks.org/how-to-prepare-for-technical-interviews/",
            organization: "Engineering Hiring Standards",
            sourceType: "official_guide",
            publicationYear: "2026",
            dateVerified: "2026-10-12",
            supportedClaims: ["Core problem solving in general-purpose languages"],
            confidence: "Inference requiring confirmation",
          },
        ],
        coreCompetencies: [],
        evidenceSummary: {
          officialRequirementsCount: 0,
          totalSourcesAnalyzed: 1,
          researchConfidence: "provisional",
          notes: "General guidance",
          tier1SourceCount: 0,
          tier2SourceCount: 1,
          tier3SourceCount: 0,
          isGeneralGuidance: true,
        },
        diagnosticTopics: ["Arrays & Strings", "Complexity Analysis"],
        isGeneralGuidance: true,
      },
      metadata: {},
    };

    render(
      <MemoryRouter>
        <PrepPlanView plan={unverifiedPlan} />
      </MemoryRouter>
    );

    expect(screen.getByText(/General Role Guidance \(Unverified Company Specifics\)/i)).toBeInTheDocument();
    expect(screen.getByText(/General Guidance/i)).toBeInTheDocument();
    expect(screen.getByText(/Standard Tech Industry Competency Matrix/i)).toBeInTheDocument();
  });

  it("displays Verified Company Sources badge when verified official sources are present", () => {
    const verifiedPlan: PrepPlan = {
      id: "plan-4",
      userId: "user-1",
      version: 1,
      targetRole: "SDE Intern",
      companyName: "Amazon",
      durationMonths: 3,
      timePerDay: 120,
      isGeneralGuidance: false,
      guidanceClassification: "Company-Verified Preparation Framework",
      roadmap: [],
      researchReport: {
        companyName: "Amazon",
        companyKey: "amazon",
        targetRole: "SDE Intern",
        seniority: "internship",
        location: "India",
        dateChecked: "2026-10-12",
        sources: [
          {
            title: "Amazon SDE Internship Online Assessment Preparation",
            url: "https://www.amazon.jobs/content/en/how-we-hire/university/sde-oa",
            organization: "Amazon University Recruiting",
            sourceType: "official_guide",
            publicationYear: "2026",
            dateVerified: "2026-10-12",
            supportedClaims: ["Online Assessment structure: 2 coding questions on DS&A"],
            confidence: "Official preparation guidance",
          },
        ],
        coreCompetencies: [],
        evidenceSummary: {
          officialRequirementsCount: 1,
          totalSourcesAnalyzed: 1,
          researchConfidence: "high",
          notes: "Verified",
          tier1SourceCount: 1,
          tier2SourceCount: 0,
          tier3SourceCount: 0,
          isGeneralGuidance: false,
        },
        diagnosticTopics: ["Arrays & Strings", "Binary Trees"],
        isGeneralGuidance: false,
      },
      metadata: {},
    };

    render(
      <MemoryRouter>
        <PrepPlanView plan={verifiedPlan} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Company-Verified Preparation Framework/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Company Sources/i)).toBeInTheDocument();
    expect(screen.getByText(/Amazon SDE Internship Online Assessment Preparation/i)).toBeInTheDocument();
  });
});
