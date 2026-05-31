import AdminInvitePanel from "@/components/AdminInvitePanel";
import AdminStudentOversightPanel from "@/components/AdminStudentOversightPanel";

export default function AdminConsolePage() {
  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <p className="section-label">Admin Console</p>
        <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Manage access, cohorts, and student execution from one place.
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-foreground/80">
          Invite links, named groups, student proof, and saved admin history now live here. Task assignment happens from Tasks so admins work in the same place students execute.
        </p>
      </section>

      <AdminInvitePanel />
      <AdminStudentOversightPanel showAssignmentComposer={false} />
    </div>
  );
}
