export const KIOSK_CONFIG_KEY = 'office_kiosk_config';

export const PL_IDLE_SECONDS = 120;
/** Idle für Item-Board/Fotos etwas länger (analog Terminal max 180). */
export const PL_ITEMS_IDLE_SECONDS = 180;

export type PlState = 'idle' | 'home' | 'timesheet_detail' | 'confirmation';
export type MainTab = 'items' | 'timesheets';
