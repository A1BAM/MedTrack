export type Dose = {
  id: number;
  takenAt: string; // ISO timestamp
  amount: number; // mg
  notes: string | null;
};

export type Peak = {
  id: number;
  doseId: number | null;
  peakAt: string; // ISO timestamp — when the peak happened
  recordedAt: string; // ISO timestamp — when it was logged
  sideEffects: string | null;
  notes: string | null;
};

export type TrendPeak = {
  id: number;
  peakAt: string;
  doseTakenAt: string | null;
};

export type ActionResult = { ok: boolean; message: string } | null;
