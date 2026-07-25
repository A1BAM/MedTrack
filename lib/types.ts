export type Dose = {
  id: number;
  takenAt: string; // ISO timestamp
  amount: number; // mg
  notes: string | null;
};

export type CheckIn = {
  id: number;
  doseId: number | null;
  recordedAt: string; // ISO timestamp
  effectiveness: number; // 0-10
  sideEffects: string | null;
  notes: string | null;
};

export type TrendCheckIn = {
  id: number;
  recordedAt: string;
  effectiveness: number;
  doseTakenAt: string | null;
};

export type ActionResult = { ok: boolean; message: string } | null;
