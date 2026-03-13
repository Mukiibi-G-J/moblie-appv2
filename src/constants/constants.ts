const onboarding_screens = [
  {
    id: 1,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_First.jpg'),
    title: 'Modern POS Solution',
    description:
      'Streamline your daily transactions with our integrated point of sale system',
  },
  {
    id: 2,
    backgroundImage: require('../assets/images/background_02.png'),
    bannerImage: require('../assets/images/onBoarding_Second.png'),
    title: 'Inventory Control',
    description:
      'Track stock levels in real-time with automated alerts and reporting',
  },
  {
    id: 3,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_Third.jpg'),
    title: 'Secure Transactions',
    description:
      'Process payments safely with multi-payment support and instant verification',
  },
  {
    id: 4,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_Fourth.jpg'),
    title: 'Business Analytics',
    description:
      'Access detailed sales reports and performance metrics for informed decisions',
  },
  {
    id: 5,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_Fifth.jpg'),
    title: 'Customer Management',
    description:
      'Enhance customer relations with integrated loyalty and profile tracking',
  },
];

const screens = {
  main_layout: 'MainLayout',
  home: 'Home',
  sales: 'Sales',
  items: 'Items',
  itemCategories: 'Item Categories',
  customers: 'Customers',
  reports: 'Reports',
  my_wallet: 'My Wallet',
  settings: 'Settings',
  itemJournal: 'Item Journal',
  inventory: 'Inventory',
  analytics: 'Analytics',
  expenses: 'Expenses',
  expenseHistory: 'Expense History',
  purchases: 'Purchases',
  suppliers: 'Suppliers',
  payments: 'Payments',
  bankAccounts: 'Bank Accounts',
  bankAccountLedger: 'Bank Account Ledger Entries',
  loans: 'Loans',
  loanRepayments: 'Loan Repayments',
  prepayments: 'Prepayments',
  financials: 'Financials',
  userManagement: 'User Management',
  helpSupport: 'Help & Support',
};

const bottom_tabs = [
  {
    id: 0,
    label: screens.home,
  },
  {
    id: 1,
    label: screens.sales,
  },
  {
    id: 2,
    label: screens.items,
  },
  {
    id: 3,
    label: screens.customers,
  },
  {
    id: 4,
    label: screens.reports,
  },
];

export default {
  onboarding_screens,
  bottom_tabs,
  screens,
};
