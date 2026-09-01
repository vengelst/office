/**
 * Seite: kiosk / terminal (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useKioskTerminal } from '@/components/kiosk/terminal/use-kiosk-terminal';
import { TerminalLoadingScreen } from '@/components/kiosk/terminal/terminal-loading-screen';
import { TerminalConfirmationScreen } from '@/components/kiosk/terminal/terminal-confirmation-screen';
import { TerminalWorkItemsScreen } from '@/components/kiosk/terminal/terminal-work-items-screen';
import { TerminalActionScreen } from '@/components/kiosk/terminal/terminal-action-screen';
import { TerminalIdleScreen } from '@/components/kiosk/terminal/terminal-idle-screen';

/**
 * UI-Komponente `KioskTerminalPage`.
 */
export default function KioskTerminalPage() {
  const terminal = useKioskTerminal();

  if (!terminal.config) {
    return (
      <TerminalLoadingScreen onPointerDown={terminal.tryEnterFullscreen} />
    );
  }

  if (terminal.state === 'confirmation') {
    return (
      <TerminalConfirmationScreen
        confirmMessage={terminal.confirmMessage}
        confirmSubtext={terminal.confirmSubtext}
        onPointerDown={terminal.tryEnterFullscreen}
      />
    );
  }

  if (
    (terminal.state === 'items' || terminal.state === 'itemDetail') &&
    terminal.worker
  ) {
    return (
      <TerminalWorkItemsScreen
        state={terminal.state}
        worker={terminal.worker}
        projectId={terminal.config.projectId}
        selectedItemId={terminal.selectedItemId}
        countdown={terminal.countdown}
        t={terminal.t}
        onPointerDown={terminal.tryEnterFullscreen}
        resetActivity={terminal.resetActivity}
        setState={terminal.setState}
        setSelectedItemId={terminal.setSelectedItemId}
      />
    );
  }

  if (terminal.state === 'action' && terminal.worker) {
    return (
      <TerminalActionScreen
        worker={terminal.worker}
        config={terminal.config}
        clockStatus={terminal.clockStatus}
        activityTypes={terminal.activityTypes}
        selectedActivityTypeId={terminal.selectedActivityTypeId}
        liveWorkers={terminal.liveWorkers}
        activeProjectId={terminal.activeProjectId}
        displayProjectTitle={terminal.displayProjectTitle}
        masterProjectOptions={terminal.masterProjectOptions}
        canClockInOnKioskProject={terminal.canClockInOnKioskProject}
        itemBasedProject={terminal.itemBasedProject}
        processing={terminal.processing}
        countdown={terminal.countdown}
        photoPending={terminal.photoPending}
        photoComment={terminal.photoComment}
        timeStr={terminal.timeStr}
        dateLocale={terminal.dateLocale}
        t={terminal.t}
        onPointerDown={terminal.tryEnterFullscreen}
        resetActivity={terminal.resetActivity}
        endSession={terminal.endSession}
        setState={terminal.setState}
        setSelectedProjectId={terminal.setSelectedProjectId}
        setPhotoPending={terminal.setPhotoPending}
        setPhotoComment={terminal.setPhotoComment}
        handleActivityTypeChange={terminal.handleActivityTypeChange}
        handleClockIn={() => void terminal.handleClockIn()}
        handleClockOut={() => void terminal.handleClockOut()}
        handleBreakStart={terminal.handleBreakStart}
        handleBreakEnd={terminal.handleBreakEnd}
        handlePhoto={terminal.handlePhoto}
        uploadPhotoWithComment={terminal.uploadPhotoWithComment}
      />
    );
  }

  return (
    <TerminalIdleScreen
      config={terminal.config}
      pin={terminal.pin}
      pinError={terminal.pinError}
      pinLoading={terminal.pinLoading}
      pinLength={terminal.pinLength}
      lang={terminal.lang}
      timeStr={terminal.timeStr}
      dateStr={terminal.dateStr}
      showAdminDialog={terminal.showAdminDialog}
      adminPinInput={terminal.adminPinInput}
      t={terminal.t}
      onPointerDown={terminal.tryEnterFullscreen}
      setLang={terminal.setLang}
      setShowAdminDialog={terminal.setShowAdminDialog}
      setAdminPinInput={terminal.setAdminPinInput}
      handlePinDigit={terminal.handlePinDigit}
      handlePinClear={terminal.handlePinClear}
      submitPin={terminal.submitPin}
      handleAdminPinConfirm={terminal.handleAdminPinConfirm}
    />
  );
}
