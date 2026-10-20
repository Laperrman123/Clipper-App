/**
 * Format durasi/posisi waktu untuk ditampilkan ke user.
 *
 * Gaya yang dipakai: menit dan detik dua digit dipisah titik, contoh `02.23`.
 * Kalau durasinya lebih dari satu jam, jam ikut ditampilkan (`1.05.07`)
 * supaya angkanya tidak melebar jadi ratusan menit.
 */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}.${mm}.${ss}` : `${mm}.${ss}`;
}
