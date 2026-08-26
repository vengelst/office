/**
 * Seite: worker-app / dashboard (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { OfflineClockBanner } from '@/components/offline-clock-banner';
import { ClockStatusSection } from '@/components/worker-app/dashboard/clock-status-section';
import { CurrentProjectSection } from '@/components/worker-app/dashboard/current-project-section';
import { DashboardHeader } from '@/components/worker-app/dashboard/dashboard-header';
import { LogoutButton } from '@/components/worker-app/dashboard/logout-button';
import { PhotoSection } from '@/components/worker-app/dashboard/photo-section';
import { TodayEntriesSection } from '@/components/worker-app/dashboard/today-entries-section';
import { useWorkerDashboard } from '@/components/worker-app/dashboard/use-worker-dashboard';
import { WorkItemsLink } from '@/components/worker-app/dashboard/work-items-link';
import { texts } from '@/lib/texts';

/**
 * UI-Komponente `WorkerDashboardPage`.
 */
export default function WorkerDashboardPage(): React.ReactNode {
  const dashboard = useWorkerDashboard();
  const t = texts.workerApp;

  if (!dashboard.worker) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {texts.common.loading}
      </div>
    );
  }

  const { worker } = dashboard;

  const resetPhotoState = (): void => {
    dashboard.setPhotoOpen(false);
    dashboard.setPhotoFile(null);
    dashboard.setPhotoComment('');
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-6">
      <OfflineClockBanner
        workerId={worker.id}
        onSynced={() => {
          void dashboard.refresh(worker.id);
        }}
      />

      <DashboardHeader
        worker={worker}
        gpsOk={dashboard.gpsOk}
        greeting={t.dashboard.greeting}
        gpsActiveLabel={t.dashboard.gpsActive}
        gpsInactiveLabel={t.dashboard.gpsInactive}
      />

      <CurrentProjectSection
        activeProject={dashboard.activeProject}
        current={dashboard.current}
        future={dashboard.future}
        selectedProjectId={dashboard.selectedProjectId}
        onProjectChange={dashboard.setSelectedProjectId}
        currentProjectLabel={t.dashboard.currentProject}
        noProjectLabel={t.dashboard.noProject}
        upcomingProjectsLabel={t.dashboard.upcomingProjects}
      />

      <ClockStatusSection
        clockedIn={dashboard.clockedIn}
        onBreak={dashboard.onBreak}
        status={dashboard.status}
        elapsedSeconds={dashboard.elapsedSeconds}
        masterEngineer={worker.masterEngineer ?? false}
        activityTypes={dashboard.activityTypes}
        selectedActivityTypeId={dashboard.selectedActivityTypeId}
        onActivityChange={(id) => void dashboard.handleSwitchActivity(id)}
        onSetActivityTypeId={dashboard.setSelectedActivityTypeId}
        busy={dashboard.busy}
        currentAssignments={dashboard.current}
        onBreakToggle={() =>
          void (dashboard.onBreak
            ? dashboard.handleBreakEnd()
            : dashboard.handleBreakStart())
        }
        onClockIn={() => void dashboard.handleClockIn()}
        onClockOut={() => void dashboard.handleClockOut()}
        labels={{
          clockedInSince: t.dashboard.clockedInSince,
          notClockedIn: t.dashboard.notClockedIn,
          onBreakSince: t.dashboard.onBreakSince,
          switchActivity: t.dashboard.switchActivity,
          chooseActivity: t.dashboard.chooseActivity,
          currentActivity: t.dashboard.currentActivity,
          endBreak: t.dashboard.endBreak,
          startBreak: t.dashboard.startBreak,
          working: t.dashboard.working,
          stop: t.dashboard.stop,
          start: t.dashboard.start,
        }}
      />

      {dashboard.itemBasedActive && dashboard.activeProject && (
        <WorkItemsLink
          onNavigate={() =>
            dashboard.router.push(
              `/worker-app/work-items?projectId=${encodeURIComponent(dashboard.activeProject!.id)}`,
            )
          }
        />
      )}

      <PhotoSection
        photoOpen={dashboard.photoOpen}
        photoFile={dashboard.photoFile}
        photoComment={dashboard.photoComment}
        photoBusy={dashboard.photoBusy}
        photoInputRef={dashboard.photoInput}
        onOpen={() => dashboard.setPhotoOpen(true)}
        onClose={resetPhotoState}
        onFileSelect={dashboard.setPhotoFile}
        onCommentChange={dashboard.setPhotoComment}
        onSave={(p) => void dashboard.handlePhotoUpload(p)}
        onSkip={() => void dashboard.handlePhotoUpload({ comment: '' })}
        labels={{
          addPhoto: t.dashboard.addPhoto,
          photoCancel: t.dashboard.photoCancel,
          photoCommentHint: t.dashboard.photoCommentHint,
          photoPlace: t.dashboard.photoPlace,
          photoPlaceHint: t.dashboard.photoPlaceHint,
          photoPlaceDone: t.dashboard.photoPlaceDone,
          photoClearPlace: t.dashboard.photoClearPlace,
          photoUploading: t.dashboard.photoUploading,
          photoUpload: t.dashboard.photoUpload,
          photoSkip: t.dashboard.photoSkip,
        }}
      />

      <TodayEntriesSection
        entries={dashboard.today}
        labels={{
          todayTitle: t.dashboard.todayTitle,
          todayEmpty: t.dashboard.todayEmpty,
          clockIn: t.dashboard.clockIn,
          clockOut: t.dashboard.clockOut,
          startBreak: t.dashboard.startBreak,
          endBreak: t.dashboard.endBreak,
        }}
      />

      <LogoutButton label={t.dashboard.logout} onLogout={dashboard.handleLogout} />
    </div>
  );
}
