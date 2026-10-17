/**
 * Selections shared across screens: issue date, nutrient, outlook day and selected cell.
 * They persist when switching tabs, so Location Forecast (Step 2) opens on the same choice.
 * These are user choices only; no forecast data is stored here.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { IsoDate, NutrientKey } from '@/api/types';

/** Default view: a date inside the validated 2022–2025 replay range (Southwest Monsoon). */
export const DEFAULT_ISSUE_DATE: IsoDate = '2024-05-15';
export const DEFAULT_NUTRIENT: NutrientKey = 'no3';
export const DEFAULT_LEAD = 7;
/** Pre-selected cell; it is only used if /c1/cells contains it. */
export const DEFAULT_CELL_ID = 'N6.75_E79.75';

interface AppState {
  issueDate: IsoDate;
  setIssueDate: (d: IsoDate) => void;
  nutrient: NutrientKey;
  setNutrient: (n: NutrientKey) => void;
  lead: number;
  setLead: (l: number) => void;
  selectedCellId: string | null;
  setSelectedCellId: (id: string | null) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [issueDate, setIssueDate] = useState<IsoDate>(DEFAULT_ISSUE_DATE);
  const [nutrient, setNutrient] = useState<NutrientKey>(DEFAULT_NUTRIENT);
  const [lead, setLead] = useState<number>(DEFAULT_LEAD);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(DEFAULT_CELL_ID);

  const value = useMemo(
    () => ({ issueDate, setIssueDate, nutrient, setNutrient, lead, setLead, selectedCellId, setSelectedCellId }),
    [issueDate, nutrient, lead, selectedCellId],
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
