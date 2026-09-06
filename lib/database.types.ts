// أنواع قاعدة البيانات — مطابقة لمخطط Supabase في supabase/migrations
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EntryKind = "revenue" | "expense";
export type MovementType =
  | "operational"
  | "internal_transfer"
  | "custody_out"
  | "custody_expense"
  | "custody_return";
export type ReconStatus = "pending" | "reconciled";
export type DebtStatus = "open" | "cancelled";
export type CustodyState = "settled" | "outstanding" | "negative";
export type DebtState = "open" | "overdue" | "settled" | "cancelled";

type Named = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type Account = Named;
export type Ledger = Named;

export type CostCenter = Named & {
  custody_opening: number;
  is_custody: boolean;
  custody_holder: string | null;
};

export type RevenueType = Named & { is_opening: boolean };

export type Bank = Named & {
  opening_balance: number;
  is_usd: boolean;
  sort_order: number;
};

export type Creditor = Named & { phone: string | null; note: string | null };

export type Settings = {
  id: number;
  usd_rate: number;
  company_name: string;
  updated_at: string;
};

export type Entry = {
  id: string;
  kind: EntryKind;
  entry_code: string;
  amount: number;
  description: string | null;
  entry_date: string;
  revenue_type_id: string | null;
  account_id: string | null;
  ledger_id: string | null;
  cost_center_id: string | null;
  bank_id: string | null;
  movement_type: MovementType;
  recon_status: ReconStatus;
  note: string | null;
  document_url: string | null;
  debt_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type EntryView = Omit<Entry, "created_by"> & {
  revenue_type_name: string | null;
  revenue_is_opening: boolean | null;
  account_name: string | null;
  ledger_name: string | null;
  cost_center_name: string | null;
  cost_center_is_custody: boolean | null;
  bank_name: string | null;
  bank_is_usd: boolean | null;
  debt_description: string | null;
  creditor_name: string | null;
};

export type Debt = {
  id: string;
  creditor_id: string;
  description: string;
  total_amount: number;
  debt_date: string;
  due_date: string | null;
  account_id: string | null;
  ledger_id: string | null;
  cost_center_id: string | null;
  status: DebtStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type DebtItem = {
  id: string;
  debt_id: string;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
};

export type DebtView = Omit<Debt, "created_by" | "updated_at"> & {
  creditor_name: string;
  account_name: string | null;
  ledger_name: string | null;
  cost_center_name: string | null;
  paid_amount: number;
  payment_count: number;
  last_payment: string | null;
  remaining: number;
  paid_pct: number;
  state: DebtState;
};

export type BankBalance = {
  id: string;
  name: string;
  is_usd: boolean;
  is_active: boolean;
  sort_order: number;
  opening_balance: number;
  revenue_in: number;
  expense_out: number;
  custody_back: number;
  net_movement: number;
  balance: number;
  entry_count: number;
};

export type CustodyBalance = {
  id: string;
  name: string;
  custody_holder: string | null;
  custody_opening: number;
  is_active: boolean;
  paid_out: number;
  spent: number;
  returned: number;
  last_movement: string | null;
  balance: number;
  state: CustodyState;
};

export type CreditorBalance = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  is_active: boolean;
  open_debts: number;
  total_debts: number;
  total_amount: number;
  paid_amount: number;
  remaining: number;
};

export type CashPosition = {
  bank_total: number;
  usd_total: number;
  custody_total: number;
  total_cash: number;
  debts_outstanding: number;
  overdue_count: number;
  available_after_debts: number;
};

export type EntryIssue = {
  id: string;
  kind: EntryKind;
  entry_code: string;
  amount: number;
  description: string | null;
  entry_date: string;
  movement_type: MovementType;
  recon_status: ReconStatus;
  bank_name: string | null;
  account_name: string | null;
  ledger_name: string | null;
  cost_center_name: string | null;
  revenue_type_name: string | null;
  creditor_name: string | null;
  debt_id: string | null;
  issues: string[];
  issue_count: number;
};

export type DebtIssue = {
  id: string;
  description: string;
  creditor_name: string;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  due_date: string | null;
  state: DebtState;
  issues: string[];
};

export type OperationalTotals = {
  revenue: number;
  revenue_excl_opening: number;
  opening_balances: number;
  expense: number;
  net: number;
  revenue_count: number;
  expense_count: number;
  internal_transfers: number;
  custody_out_total: number;
  custody_expense_total: number;
  custody_return_total: number;
};

export type Breakdown = { name: string; total: number; cnt: number };
export type DailyMovement = {
  day: string;
  revenue: number;
  expense: number;
  net: number;
};
export type MonthlySummary = {
  month: string;
  revenue: number;
  expense: number;
  net: number;
  entry_count: number;
};

export type AuditLog = {
  id: number;
  table_name: string;
  row_id: string | null;
  action: string;
  old_data: Json | null;
  new_data: Json | null;
  changed_by: string | null;
  changed_at: string;
};

type Table<Row, Ins = Partial<Row>, Upd = Partial<Row>> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: [];
};

type View<Row> = { Row: Row; Relationships: [] };

type RangeArgs = { p_from?: string | null; p_to?: string | null };
type TopArgs = RangeArgs & { p_limit?: number };

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      accounts: Table<Account, { name: string; is_active?: boolean }>;
      ledgers: Table<Ledger, { name: string; is_active?: boolean }>;
      cost_centers: Table<
        CostCenter,
        {
          name: string;
          custody_opening?: number;
          custody_holder?: string | null;
          is_active?: boolean;
        }
      >;
      revenue_types: Table<
        RevenueType,
        { name: string; is_opening?: boolean; is_active?: boolean }
      >;
      banks: Table<
        Bank,
        {
          name: string;
          opening_balance?: number;
          is_usd?: boolean;
          sort_order?: number;
          is_active?: boolean;
        }
      >;
      creditors: Table<
        Creditor,
        {
          name: string;
          phone?: string | null;
          note?: string | null;
          is_active?: boolean;
        }
      >;
      settings: Table<Settings>;
      entries: Table<
        Entry,
        Omit<Partial<Entry>, "kind" | "amount" | "entry_date"> & {
          kind: EntryKind;
          amount: number;
          entry_date: string;
        }
      >;
      debts: Table<
        Debt,
        Omit<
          Partial<Debt>,
          "creditor_id" | "description" | "total_amount"
        > & {
          creditor_id: string;
          description: string;
          total_amount: number;
        }
      >;
      // line_total محسوب في القاعدة فلا يُكتب من التطبيق
      debt_items: Table<
        DebtItem,
        Omit<Partial<DebtItem>, "debt_id" | "name" | "quantity" | "unit_price" | "line_total"> & {
          debt_id: string;
          name: string;
          quantity: number;
          unit_price: number;
        },
        Omit<Partial<DebtItem>, "line_total">
      >;
      audit_log: Table<AuditLog>;
    };
    Views: {
      v_entries: View<EntryView>;
      v_bank_balances: View<BankBalance>;
      v_custody_balances: View<CustodyBalance>;
      v_debt_balances: View<DebtView>;
      v_creditor_balances: View<CreditorBalance>;
      v_cash_position: View<CashPosition>;
      v_entry_issues: View<EntryIssue>;
      v_debt_issues: View<DebtIssue>;
    };
    Functions: {
      f_operational_totals: { Args: RangeArgs; Returns: OperationalTotals[] };
      f_expense_by_cost_center: { Args: TopArgs; Returns: Breakdown[] };
      f_expense_by_ledger: { Args: TopArgs; Returns: Breakdown[] };
      f_expense_by_account: { Args: TopArgs; Returns: Breakdown[] };
      f_revenue_by_type: { Args: TopArgs; Returns: Breakdown[] };
      f_daily_movement: { Args: RangeArgs; Returns: DailyMovement[] };
      f_monthly_summary: { Args: Record<string, never>; Returns: MonthlySummary[] };
      f_save_debt: {
        Args: { p_id: string | null; p_debt: Json; p_items: Json };
        Returns: string;
      };
    };
    Enums: {
      entry_kind: EntryKind;
      movement_type: MovementType;
      recon_status: ReconStatus;
      debt_status: DebtStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
