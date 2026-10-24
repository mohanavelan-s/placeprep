import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminStudentOversightPanel from "@/components/AdminStudentOversightPanel";
import * as api from "@/lib/api";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    fetchCoachStudents: vi.fn(),
    fetchCoachGroups: vi.fn(),
    fetchCoachGroupCandidates: vi.fn(),
    deleteCoachStudentsBulk: vi.fn(),
  };
});

function createMockStudent(id: string, name: string, email: string): api.StudentOversightRecord {
  return {
    student: {
      id,
      name,
      username: name.toLowerCase().replace(/\s+/g, "_"),
      email,
      role: "user",
      createdAt: "2026-01-01T00:00:00Z",
      readinessScore: 75,
      streak: 5,
    } as api.User,
    invitedBy: {
      id: "admin-1",
      name: "Admin User",
      username: "admin_user",
      inviteCode: "INVITE123",
      invitedAt: "2026-01-01T00:00:00Z",
    },
    progress: {
      streak: 5,
      consistencyScore: 80,
      readinessScore: 75,
      solvedProblems: 12,
      averageTimePerProblem: 25,
      failedAttempts: 2,
      totalHours: 15.5,
      tasksCompleted: 18,
      statDate: "2026-03-01",
      weeklyProgress: [],
      topicStrength: [],
    },
    taskSummary: {
      userId: id,
      total: 20,
      pending: 2,
      inProgress: 0,
      completed: 18,
      skipped: 0,
      overdue: 0,
    },
    recentProofs: [],
    progressHistory: [],
    practiceCapsules: [],
  };
}

describe("AdminStudentOversightPanel Destructive-Operation Regression", () => {
  let queryClient: QueryClient;
  const mockStudents: api.StudentOversightRecord[] = [
    createMockStudent("student-1", "Alice Student", "alice@placeprep.test"),
    createMockStudent("student-2", "Bob Student", "bob@placeprep.test"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.mocked(api.fetchCoachStudents).mockResolvedValue(mockStudents);
    vi.mocked(api.fetchCoachGroups).mockResolvedValue([]);
    vi.mocked(api.fetchCoachGroupCandidates).mockResolvedValue([]);
  });

  function renderPanel() {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminStudentOversightPanel />
      </QueryClientProvider>
    );
  }

  it("selects all students, opens confirmation dialog, and removes selected students on success", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(api.deleteCoachStudentsBulk).mockResolvedValueOnce({
      success: true,
      deletedCount: 2,
      studentUserIds: ["student-1", "student-2"],
    });

    renderPanel();

    // Wait for students to load via the roster count text
    await waitFor(() => {
      expect(screen.getByText(/Showing 2 students/i)).toBeInTheDocument();
    });

    // Check both student checkboxes
    const aliceCheckbox = screen.getByLabelText("Select Alice Student");
    const bobCheckbox = screen.getByLabelText("Select Bob Student");
    fireEvent.click(aliceCheckbox);
    fireEvent.click(bobCheckbox);

    // Verify "Remove Selected (2)" button appears
    const removeSelectedBtn = await screen.findByRole("button", { name: /Remove Selected \(2\)/i });
    expect(removeSelectedBtn).toBeInTheDocument();

    // Click "Remove Selected (2)" to open modal
    fireEvent.click(removeSelectedBtn);

    // Modal title appears
    expect(screen.getByText("Remove Selected Students in Bulk")).toBeInTheDocument();

    // Confirm deletion
    const confirmDeleteBtn = screen.getByRole("button", { name: /Remove 2 Students/i });
    fireEvent.click(confirmDeleteBtn);

    // Verify API called with selected IDs
    await waitFor(() => {
      expect(api.deleteCoachStudentsBulk).toHaveBeenCalledWith(["student-1", "student-2"]);
    });

    // Invalidation of coach queries
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["coach", "students"] });
      expect(toast.success).toHaveBeenCalledWith("Removed 2 student members.");
    });
  });

  it("handles API failure, shows error toast, and preserves selected checkboxes on failure", async () => {
    vi.mocked(api.deleteCoachStudentsBulk).mockRejectedValueOnce(
      new Error("Foreign key constraint or database timeout")
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Showing 2 students/i)).toBeInTheDocument();
    });

    // Check both student checkboxes
    const aliceCheckbox = screen.getByLabelText("Select Alice Student");
    const bobCheckbox = screen.getByLabelText("Select Bob Student");
    fireEvent.click(aliceCheckbox);
    fireEvent.click(bobCheckbox);

    const removeSelectedBtn = await screen.findByRole("button", { name: /Remove Selected \(2\)/i });
    fireEvent.click(removeSelectedBtn);

    const confirmDeleteBtn = screen.getByRole("button", { name: /Remove 2 Students/i });
    fireEvent.click(confirmDeleteBtn);

    // Verify error toast
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Foreign key constraint or database timeout");
    });

    // Close modal via Cancel
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Verify selected checkboxes are still preserved: "Remove Selected (2)" is still present!
    expect(screen.getByRole("button", { name: /Remove Selected \(2\)/i })).toBeInTheDocument();
  });

  it("prevents duplicate submissions by disabling confirm button and displaying pending indicator", async () => {
    let resolveDelete: (val: any) => void = () => {};
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });
    vi.mocked(api.deleteCoachStudentsBulk).mockReturnValueOnce(deletePromise as any);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Showing 2 students/i)).toBeInTheDocument();
    });

    // Check both student checkboxes
    const aliceCheckbox = screen.getByLabelText("Select Alice Student");
    const bobCheckbox = screen.getByLabelText("Select Bob Student");
    fireEvent.click(aliceCheckbox);
    fireEvent.click(bobCheckbox);

    const removeSelectedBtn = await screen.findByRole("button", { name: /Remove Selected \(2\)/i });
    fireEvent.click(removeSelectedBtn);

    const confirmDeleteBtn = screen.getByRole("button", { name: /Remove 2 Students/i });
    fireEvent.click(confirmDeleteBtn);

    // Button should now be disabled and show pending text
    await waitFor(() => {
      expect(screen.getByText(/Removing \(2\)\.\.\./i)).toBeInTheDocument();
      expect(confirmDeleteBtn).toBeDisabled();
    });

    // Resolve mutation
    resolveDelete({ success: true, deletedCount: 2, studentUserIds: ["student-1", "student-2"] });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Removed 2 student members.");
    });
  });
});
