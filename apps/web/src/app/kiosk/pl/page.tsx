/**
 * Seite: kiosk / pl (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { texts } from '@/lib/texts';
import { useKioskPl } from '@/components/kiosk/pl/use-kiosk-pl';
import { PlConfirmationScreen } from '@/components/kiosk/pl/pl-confirmation-screen';
import { PlTimesheetDetailScreen } from '@/components/kiosk/pl/pl-timesheet-detail-screen';
import { PlHomeScreen } from '@/components/kiosk/pl/pl-home-screen';
import { PlIdleScreen } from '@/components/kiosk/pl/pl-idle-screen';

/**
 * UI-Komponente `KioskPlPage`.
 */
export default function KioskPlPage() {
  const pl = useKioskPl();
  const t = texts.kiosk.pl;

  if (!pl.config) return null;

  if (pl.state === 'confirmation') {
    return (
      <PlConfirmationScreen
        successTitle={t.successTitle}
        confirmMessage={pl.confirmMessage}
        onPointerDown={pl.tryEnterFullscreen}
      />
    );
  }

  if (pl.state === 'timesheet_detail' && pl.detail) {
    return (
      <PlTimesheetDetailScreen
        detail={pl.detail}
        timeStr={pl.timeStr}
        signerName={pl.signerName}
        signing={pl.signing}
        signError={pl.signError}
        countdown={pl.countdown}
        onPointerDown={pl.tryEnterFullscreen}
        resetActivity={pl.resetActivity}
        onBack={pl.handleDetailBack}
        onSignerNameChange={pl.setSignerName}
        onSignAndApprove={(canvasRef) => void pl.handleSignAndApprove(canvasRef)}
      />
    );
  }

  if (pl.state === 'home' && pl.user) {
    return (
      <PlHomeScreen
        config={pl.config}
        user={pl.user}
        itemBased={pl.itemBased}
        mainTab={pl.mainTab}
        sheets={pl.sheets}
        sheetsLoading={pl.sheetsLoading}
        detailLoading={pl.detailLoading}
        countdown={pl.countdown}
        timeStr={pl.timeStr}
        onPointerDown={pl.tryEnterFullscreen}
        resetActivity={pl.resetActivity}
        resetToIdle={pl.resetToIdle}
        setMainTab={pl.setMainTab}
        loadSheets={pl.loadSheets}
        loadDetail={(id) => void pl.loadDetail(id)}
      />
    );
  }

  return (
    <PlIdleScreen
      config={pl.config}
      pin={pl.pin}
      pinError={pl.pinError}
      pinLoading={pl.pinLoading}
      timeStr={pl.timeStr}
      dateStr={pl.dateStr}
      showAdminDialog={pl.showAdminDialog}
      adminPinInput={pl.adminPinInput}
      onPointerDown={pl.tryEnterFullscreen}
      setShowAdminDialog={pl.setShowAdminDialog}
      setAdminPinInput={pl.setAdminPinInput}
      handlePinDigit={pl.handlePinDigit}
      handlePinClear={pl.handlePinClear}
      submitPin={pl.submitPin}
      handleAdminPinConfirm={pl.handleAdminPinConfirm}
    />
  );
}
