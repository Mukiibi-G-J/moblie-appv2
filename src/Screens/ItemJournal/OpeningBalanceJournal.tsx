import React from 'react';
import ItemJournalScreen from './ItemJournal';
import {OPENING_BALANCE_JOURNAL_CONFIG} from './itemJournalScreenConfig';

const OpeningBalanceJournal = () => (
  <ItemJournalScreen config={OPENING_BALANCE_JOURNAL_CONFIG} />
);

export default OpeningBalanceJournal;
