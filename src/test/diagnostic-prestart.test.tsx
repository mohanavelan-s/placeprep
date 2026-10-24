import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiagnosticPreStartDialog } from "@/components/DiagnosticPreStartDialog";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    startAssessmentSession: vi.fn(),
  };
});

describe("DiagnosticPreStartDialog Component", () => {
  const mockPendingBaseline: api.PendingBaselineSummary = {
    hasPending: true,
    id: "session-uuid-1234",
    planId: "plan-uuid-5678",
    targetRole: "AI Engineer",
    companyName: "Microsoft",
    seniority: "Senior",
    durationMinutes: 20,
    isGeneralGuidance: false,
    guidanceClassification: "Microsoft-aligned preparation based on public sources",
    sections: [
      {
        id: "A",
        title: "Section A: Conceptual Competencies",
        type: "mcq",
        questionCount: 4,
        timeMinutes: 10,
      },
      {
        id: "B",
        title: "Section B: Algorithmic Implementation",
        type: "coding",
        questionCount: 1,
        timeMinutes: 10,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders role, company, duration, and section breakdown cleanly", () => {
    const onOpenChange = vi.fn();
    render(
      <DiagnosticPreStartDialog
        open={true}
        onOpenChange={onOpenChange}
        pendingBaseline={mockPendingBaseline}
      />
    );

    expect(screen.getByText(/Begin Technical Diagnostic/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Engineer/i)).toBeInTheDocument();
    expect(screen.getByText("Microsoft")).toBeInTheDocument();
    expect(screen.getByText(/20 Minutes Timed/i)).toBeInTheDocument();
    expect(screen.getByText(/Section A: Conceptual/i)).toBeInTheDocument();
    expect(screen.getByText(/Section B: Practical Coding/i)).toBeInTheDocument();
    expect(screen.getByText("Microsoft-aligned preparation based on public sources")).toBeInTheDocument();
    expect(screen.getByText(/Exercises are practice questions synthesized from public hiring rubrics/i)).toBeInTheDocument();
    expect(screen.getByText(/Grounded in community-reported LeetCode candidate problems/i)).toBeInTheDocument();
    expect(screen.queryByText(/Company-Verified/i)).not.toBeInTheDocument();
  });

  it("calls onOpenChange(false) and starts zero sessions when Cancel is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <DiagnosticPreStartDialog
        open={true}
        onOpenChange={onOpenChange}
        pendingBaseline={mockPendingBaseline}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.startAssessmentSession).not.toHaveBeenCalled();
  });

  it("activates the session and invokes onActivated when Begin Diagnostic is clicked", async () => {
    const onOpenChange = vi.fn();
    const onActivated = vi.fn();
    const mockSession = {
      id: "session-uuid-1234",
      status: "started",
      startedAt: new Date().toISOString(),
    } as api.AssessmentSession;

    vi.mocked(api.startAssessmentSession).mockResolvedValueOnce({
      success: true,
      data: mockSession,
    });

    render(
      <DiagnosticPreStartDialog
        open={true}
        onOpenChange={onOpenChange}
        pendingBaseline={mockPendingBaseline}
        onActivated={onActivated}
      />
    );

    const beginButton = screen.getByRole("button", { name: /Begin Diagnostic/i });
    fireEvent.click(beginButton);

    await waitFor(() => {
      expect(api.startAssessmentSession).toHaveBeenCalledWith("session-uuid-1234");
      expect(onActivated).toHaveBeenCalledWith(mockSession);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("displays General Role Guidance alert when isGeneralGuidance is true", () => {
    const unverifiedBaseline: api.PendingBaselineSummary = {
      ...mockPendingBaseline,
      isGeneralGuidance: true,
      guidanceClassification: "General Role Guidance (Unverified Company Specifics)",
    };

    render(
      <DiagnosticPreStartDialog
        open={true}
        onOpenChange={vi.fn()}
        pendingBaseline={unverifiedBaseline}
      />
    );

    expect(screen.getByText(/General Role Guidance \(Unverified Company Specifics\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Company specifics could not be independently verified/i)).toBeInTheDocument();
  });
});
