export type DiaryEntryType = 'expense' | 'income' | 'farmActivity';

export interface FarmDiaryEntry {
  id: string;
  title: string;
  category: string;
  type: DiaryEntryType;
  amount: number;
  date: string;
  cropName: string;
  notes: string;
}

export interface AddDiaryEntryRes {
  entry: FarmDiaryEntry;
  agriCoinsEarned: number;
}
