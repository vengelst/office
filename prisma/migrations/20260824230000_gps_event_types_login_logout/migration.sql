-- GPS-Ereignistypen für Login/Logout/Foto/Aktionen (neben CLOCK_* und MANUAL/Intervall)
ALTER TYPE "GpsEventType" ADD VALUE 'LOGIN';
ALTER TYPE "GpsEventType" ADD VALUE 'LOGOUT';
ALTER TYPE "GpsEventType" ADD VALUE 'PHOTO';
ALTER TYPE "GpsEventType" ADD VALUE 'ACTION';
