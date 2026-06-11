import type {ItemJournalAdjustmentType} from '../../@types/types.dto';

export type ItemJournalScreenConfig = {
  lockedAdjustmentType: ItemJournalAdjustmentType;
  pageTitle: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptySubtextCreate: string;
  emptySubtextNoCreate: string;
  emptyButtonLabel: string;
  addFormTitle: string;
  editFormTitle: string;
  accessDeniedMessage: string;
};

export const OPERATIONAL_JOURNAL_CONFIG: ItemJournalScreenConfig = {
  lockedAdjustmentType: 'operational',
  pageTitle: 'Adjust inventory',
  searchPlaceholder: 'Search open adjustments...',
  emptyTitle: 'No adjustments found',
  emptySubtextCreate: 'Create your first stock adjustment to get started.',
  emptySubtextNoCreate: 'No open adjustments available.',
  emptyButtonLabel: 'Add adjustment',
  addFormTitle: 'Add adjustment',
  editFormTitle: 'Edit adjustment',
  accessDeniedMessage: 'You do not have permission to view stock adjustments.',
};

export const OPENING_BALANCE_JOURNAL_CONFIG: ItemJournalScreenConfig = {
  lockedAdjustmentType: 'opening_balance',
  pageTitle: 'Opening balance',
  searchPlaceholder: 'Search open opening balances...',
  emptyTitle: 'No opening balances found',
  emptySubtextCreate: 'Create your first opening balance adjustment to get started.',
  emptySubtextNoCreate: 'No open opening balance lines available.',
  emptyButtonLabel: 'Add opening balance',
  addFormTitle: 'Add opening balance',
  editFormTitle: 'Edit opening balance',
  accessDeniedMessage: 'You do not have permission to view opening balance adjustments.',
};
