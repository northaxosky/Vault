export interface TransactionData {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number;
  date: string;
  category: string | null;
  subcategory: string | null;
  pending: boolean;
  isRecurring: boolean;
  recurringFrequency: string | null;
  currency: string;
  accountName: string;
  notes: string | null;
  userCategory: string | null;
}
