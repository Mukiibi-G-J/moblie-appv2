const onboarding_screens = [
  {
    id: 1,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_Second.png'),
    title: 'Effortless Sales Management',
    description:
      'Streamline sales, inventory, and customer data in one intuitive system.',
  },
  {
    id: 2,
    backgroundImage: require('../assets/images/background_02.png'),
    bannerImage: require('../assets/images/onBoarding_Second.png'),
    title: 'Real-time Inventory Tracking',
    description:
      'Monitor stock levels, get low inventory alerts, and automate reordering.',
  },
  {
    id: 3,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_Second.png'),
    title: 'Seamless Payment Processing',
    description:
      'Accept multiple payment methods with fast, secure transactions.',
  },
  {
    id: 4,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_Second.png'),
    title: 'Insightful Analytics',
    description:
      'Track sales trends and customer behavior for data-driven decisions.',
  },
  {
    id: 5,
    backgroundImage: require('../assets/images/background_01.png'),
    bannerImage: require('../assets/images/onBoarding_Second.png'),
    title: 'Customer Relationship Management',
    description:
      'Manage loyalty programs and personalize customer experiences.',
  },
];

const screens = {
  main_layout: 'MainLayout',
  home: 'Home',
  search: 'Search',
  cart: 'Cart',
  favourite: 'Favourite',
  notification: 'Notification',
  my_wallet: 'My Wallet',
  settings: 'Settings',
  itemJournal: 'Item Journal',
  sales: 'Sales',
  inventory: 'Inventory',
  reports: 'Reports',
  analytics: 'Analytics',
  expenses: 'Expenses',
};

const bottom_tabs = [
  {
    id: 0,
    label: screens.home,
  },
  {
    id: 1,
    label: screens.search,
  },
  {
    id: 2,
    label: screens.cart,
  },
  {
    id: 3,
    label: screens.favourite,
  },
  {
    id: 4,
    label: screens.notification,
  },
  {
    id: 5,
    label: screens.settings,
  },
  {
    id: 6,
    label: screens.sales,
  },
  {
    id: 7,
    label: screens.inventory,
  },
  {
    id: 8,
    label: screens.reports,
  },
  {
    id: 9,
    label: screens.analytics,
  },
];

export default {
  onboarding_screens,
  bottom_tabs,
  screens,
};
