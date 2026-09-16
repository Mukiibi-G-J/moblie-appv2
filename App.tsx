import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text } from 'react-native';
import SplashScreen from './src/Screens/SplashScreen/SplashScreen';
import OnBoarding from './src/OnBoarding/OnBoarding';
import SignIn from './src/Screens/Authentication/SignIn';
import { AppProvider, useAppContext, useAuth } from './src/context/Store';
import { QueryProvider } from './src/context/QueryProvider';
import { TenantProvider } from './src/context/TenantContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { OfflineProvider } from './src/context/OfflineContext';
import MainLayout from './src/Screens/MainLayout';
import Cart from './src/Screens/Cart/Cart';
import { CartProvider } from './src/context/CartStore';
import { SearchModeProvider } from './src/context/SearchModeStore';
import { navigationRef } from './src/hooks/NavigationService';
import Settings from './src/Screens/Settings/Settings';
import LocalDatabase from './src/Screens/Settings/LocalDatabase';
import ProfileScreen from './src/Screens/Profile/ProfileScreen';
import SyncQueue from './src/Screens/Sync/SyncQueue';
import BusinessDetails from './src/Screens/BusinessDetails/BusinessDetails';
import AvailableModulesScreen from './src/Screens/Help/AvailableModulesScreen';
import Expenses from './src/Screens/Expenses/Expenses';
import ExpenseHistory from './src/Screens/Expenses/ExpenseHistory';
import MyWallet from './src/Screens/MyWallet/MyWallet';
import ReportsMenu from './src/Screens/Reports/ReportsMenu';
import ReportStatementScreen from './src/Screens/Reports/ReportStatementScreen';
import AllItems from './src/Screens/Items/Items';
import ItemsMenu from './src/Screens/Items/ItemsMenu';
import Customers from './src/Screens/Customers/Customers';
import ItemCategories from './src/Screens/Items/ItemCategories';
import UnitsOfMeasure from './src/Screens/Items/UnitsOfMeasure';
import SalesHistory from './src/Screens/Sales/SalesHistory';
import PrintLabels from './src/Screens/PrintLabels/PrintLabels';
import SignUp from './src/Screens/Authentication/SignUp';
import CompanyProvisioningScreen from './src/Screens/Authentication/CompanyProvisioningScreen';
import {
  getPendingCompanyCreation,
  clearPendingCompanyCreation,
} from './src/utils/pendingCompanyCreation';
import {
  getRestaurantDevicePrefs,
  RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
} from './src/storage/restaurantDeviceStorage';
import Otp from './src/Screens/Otp/Otp';
import ItemJournal from './src/Screens/ItemJournal/ItemJournal';
import OpeningBalanceJournal from './src/Screens/ItemJournal/OpeningBalanceJournal';
import ItemJournalHistory from './src/Screens/ItemJournal/ItemJournalHistory';
import SearchPage from './src/Screens/Search/SearchPage';
import NetworkManager from './src/utils/networkManager';
import AppToastHost from './src/Components/AppToastHost';
import Login from './src/Screens/Authentication/Login';
import ForgotPassword from './src/Screens/Authentication/ForgotPassword';
import SelectBranch from './src/Screens/Authentication/SelectBranch';
import RestaurantPinSignIn from './src/Screens/Authentication/RestaurantPinSignIn';
import RestaurantPinSetup from './src/Screens/Authentication/RestaurantPinSetup';
import AuthGuard from './src/Components/AuthGuard';
import PurchaseHistory from './src/Screens/Purchases/PurchaseHistory';
import PurchaseCreation from './src/Screens/Purchases/PurchaseCreation';
import Suppliers from './src/Screens/Suppliers/Suppliers';
import Payments from './src/Screens/Payments/Payments';
import Prepayments from './src/Screens/Prepayments/Prepayments';
import BankAccounts from './src/Screens/BankAccounts/BankAccounts';
import BankAccountLedger from './src/Screens/BankAccounts/BankAccountLedger';
import Financials from './src/Screens/Financials/Financials';
import UserManagement from './src/Screens/UserManagement/UserManagement';
import Users from './src/Screens/UserManagement/Users';
import UserSetupList from './src/Screens/UserManagement/UserSetupList';
import { CompanyBillingGate, ProtectedScreen } from './src/Components/ProtectedScreen';
import { PAGE_NAMES } from './src/constants/pageNames';
import RestaurantHub from './src/Screens/Restaurant/RestaurantHub';
import RestaurantPOS from './src/Screens/Restaurant/RestaurantPOS';
import RestaurantOrders from './src/Screens/Restaurant/RestaurantOrders';
import RestaurantKitchen from './src/Screens/Restaurant/RestaurantKitchen';
import RestaurantDashboard from './src/Screens/Restaurant/RestaurantDashboard';
import RestaurantTables from './src/Screens/Restaurant/RestaurantTables';
import RestaurantReservations from './src/Screens/Restaurant/RestaurantReservations';
import RestaurantMenus from './src/Screens/Restaurant/RestaurantMenus';
import RestaurantSettings from './src/Screens/Restaurant/RestaurantSettings';
import PrinterConfig from './src/Screens/PrinterConfig/PrinterConfig';
import SubscriptionPage from './src/Screens/Subscription/SubscriptionPage';
import MobileMoneyPaymentInstructions from './src/Screens/Subscription/MobileMoneyPaymentInstructions';
import BarcodeScannerScreen from './src/Screens/Scanner/BarcodeScannerScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { COLORS } from './src/constants';
import { AppUpdateGate } from './src/Components/AppUpdateGate';
import RestaurantPinRouteGate from './src/Components/RestaurantPinRouteGate';
import BranchSelectModal from './src/Components/BranchSelectModal';
import NotificationBootstrap from './src/Components/NotificationBootstrap';
import CustomerDisplayHost from './src/Components/CustomerDisplayHost';

const Stack = createStackNavigator();

function guestRoute<P extends object>(
  Inner: React.ComponentType<P>,
): React.ComponentType<P> {
  function Wrapped(props: P) {
    return (
      <AuthGuard requireAuth={false}>
        <Inner {...props} />
      </AuthGuard>
    );
  }
  const innerName =
    Inner.displayName ?? (Inner as {name?: string}).name ?? 'Screen';
  Wrapped.displayName = `GuestRoute(${innerName})`;
  return Wrapped;
}

const GuestOnBoarding = guestRoute(OnBoarding);
const GuestLogin = guestRoute(Login);
const GuestRestaurantPinSignIn = guestRoute(RestaurantPinSignIn);
const GuestSignUp = guestRoute(SignUp);
const GuestCompanyProvisioning = guestRoute(CompanyProvisioningScreen);
const GuestOtp = guestRoute(Otp);
const GuestForgotPassword = guestRoute(ForgotPassword);

type ProtectedPageName = React.ComponentProps<typeof ProtectedScreen>['pageName'];

/** Stable `ProtectedScreen` wrapper for stack routes (avoids inline `component={() => …}`). */
function protectRoute<P extends object>(
  Inner: React.ComponentType<P>,
  pageName: ProtectedPageName,
): React.ComponentType<P> {
  function Wrapped(props: P) {
    return (
      <ProtectedScreen pageName={pageName}>
        <Inner {...props} />
      </ProtectedScreen>
    );
  }
  const innerName =
    Inner.displayName ?? (Inner as {name?: string}).name ?? 'Screen';
  Wrapped.displayName = `ProtectedRoute(${innerName})`;
  return Wrapped;
}

function ProfitLossReportRoute(props: any) {
  return (
    <ProtectedScreen pageName={PAGE_NAMES.PROFIT_AND_LOSS}>
      <ReportStatementScreen {...props} reportType="profit-loss" />
    </ProtectedScreen>
  );
}
ProfitLossReportRoute.displayName = 'ProfitLossReportRoute';

function BalanceSheetReportRoute(props: any) {
  return (
    <ProtectedScreen pageName={PAGE_NAMES.BALANCE_SHEET}>
      <ReportStatementScreen {...props} reportType="balance-sheet" />
    </ProtectedScreen>
  );
}
BalanceSheetReportRoute.displayName = 'BalanceSheetReportRoute';

function protectCompanyBilling<P extends object>(
  Inner: React.ComponentType<P>,
): React.ComponentType<P> {
  function Wrapped(props: P) {
    return (
      <CompanyBillingGate>
        <Inner {...props} />
      </CompanyBillingGate>
    );
  }
  const innerName =
    Inner.displayName ?? (Inner as {name?: string}).name ?? 'Screen';
  Wrapped.displayName = `CompanyBillingRoute(${innerName})`;
  return Wrapped;
}

const RouteCart = protectRoute(Cart, PAGE_NAMES.SALES);
const RouteBusinessDetails = protectCompanyBilling(BusinessDetails);
const RouteAvailableModules = protectCompanyBilling(AvailableModulesScreen);
const RouteExpenses = protectRoute(Expenses, PAGE_NAMES.EXPENSES);
const RouteExpenseHistory = protectRoute(
  ExpenseHistory,
  PAGE_NAMES.EXPENSE_HISTORY,
);
const RouteMyWallet = protectRoute(MyWallet, PAGE_NAMES.PAYMENTS);
const RouteReportsMenu = protectRoute(ReportsMenu, PAGE_NAMES.REPORTS);
const RouteItemsMenu = protectRoute(ItemsMenu, PAGE_NAMES.ITEMS);
const RouteAllItems = protectRoute(AllItems, PAGE_NAMES.ITEMS);
const RouteCustomers = protectRoute(Customers, PAGE_NAMES.CUSTOMER_MANAGEMENT);
const RouteItemCategories = protectRoute(
  ItemCategories,
  PAGE_NAMES.ITEM_CATEGORIES,
);
const RouteUnitsOfMeasure = protectRoute(UnitsOfMeasure, PAGE_NAMES.ITEMS);
const RouteSalesHistory = protectRoute(SalesHistory, PAGE_NAMES.SALES_HISTORY);
const RoutePrintLabels = protectRoute(PrintLabels, PAGE_NAMES.ITEMS);
const RouteItemJournal = protectRoute(ItemJournal, PAGE_NAMES.ITEM_JOURNAL);
const RouteOpeningBalanceJournal = protectRoute(
  OpeningBalanceJournal,
  PAGE_NAMES.ITEM_JOURNAL,
);
const RouteItemJournalHistory = protectRoute(
  ItemJournalHistory,
  PAGE_NAMES.ADJUST_INVENTORY_HISTORY,
);
const RouteSearchPage = SearchPage;
const RoutePurchaseHistory = protectRoute(
  PurchaseHistory,
  PAGE_NAMES.PURCHASES,
);
const RoutePurchaseCreation = protectRoute(
  PurchaseCreation,
  PAGE_NAMES.PURCHASES,
);
const RouteSuppliers = protectRoute(Suppliers, PAGE_NAMES.SUPPLIERS);
const RoutePayments = protectRoute(Payments, PAGE_NAMES.PAYMENTS);
const RouteBankAccounts = protectRoute(
  BankAccounts,
  PAGE_NAMES.BANK_ACCOUNT_MANAGEMENT,
);
const RoutePrepayments = protectRoute(Prepayments, PAGE_NAMES.PREPAYMENTS);
const RouteBankAccountLedger = protectRoute(
  BankAccountLedger,
  PAGE_NAMES.BANK_ACCOUNT_LEDGER_ENTRIES,
);
const RouteFinancials = protectRoute(Financials, PAGE_NAMES.FINANCIAL_REPORTS);
const RouteUserManagement = protectRoute(
  UserManagement,
  PAGE_NAMES.USER_MANAGEMENT,
);
const RouteUsers = protectRoute(Users, PAGE_NAMES.USER_MANAGEMENT);
const RouteUserSetupList = protectRoute(UserSetupList, [
  PAGE_NAMES.USER_SETUP,
  PAGE_NAMES.USER_MANAGEMENT,
]);
const RouteRestaurantPOS = protectRoute(
  RestaurantPOS,
  PAGE_NAMES.RESTAURANT_POS,
);
const RouteRestaurantOrders = protectRoute(
  RestaurantOrders,
  PAGE_NAMES.RESTAURANT_ORDERS,
);
const RouteRestaurantKitchen = protectRoute(
  RestaurantKitchen,
  PAGE_NAMES.RESTAURANT_KITCHEN_DISPLAY,
);
const RouteRestaurantDashboard = protectRoute(
  RestaurantDashboard,
  PAGE_NAMES.RESTAURANT_DASHBOARD,
);
const RouteRestaurantTables = protectRoute(
  RestaurantTables,
  PAGE_NAMES.RESTAURANT_TABLE_MANAGEMENT,
);
const RouteRestaurantReservations = protectRoute(
  RestaurantReservations,
  PAGE_NAMES.RESTAURANT_RESERVATIONS,
);
const RouteRestaurantMenus = protectRoute(RestaurantMenus, [
  PAGE_NAMES.RESTAURANT_MENUS,
  PAGE_NAMES.RESTAURANT_MENU_MANAGEMENT,
  PAGE_NAMES.RESTAURANT_MENU_LAYOUT_EDITOR,
]);
const RouteRestaurantSettings = protectRoute(
  RestaurantSettings,
  PAGE_NAMES.RESTAURANT_SETTINGS,
);

function HomeAuthenticatedLayout(props: object) {
  return (
    <AuthGuard requireAuth={true}>
      <MainLayout {...props} />
    </AuthGuard>
  );
}
HomeAuthenticatedLayout.displayName = 'HomeAuthenticatedLayout';

/** Routes registered only on the guest stack — never use auth-only names here. */
const GUEST_STACK_ROUTES = new Set<string>([
  'OnBoarding',
  'SignIn',
  'RestaurantPinSignIn',
  'SignUp',
  'CompanyProvisioning',
  'Otp',
  'ForgotPassword',
]);

const AppNavigator = () => {
  const { accessToken } = useAuth();
  const { sessionHydrated } = useAppContext() as any;
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('OnBoarding');
  const isFirstRunRef = useRef(true);
  const bootstrapCompleteRef = useRef(false);

  const guestInitialRouteName = useMemo(() => {
    if (GUEST_STACK_ROUTES.has(initialRoute)) {
      return initialRoute;
    }
    return 'SignIn';
  }, [initialRoute]);

  useEffect(() => {
    if (!sessionHydrated) {
      return;
    }

    const initializeApp = async () => {
      const isColdStart = !bootstrapCompleteRef.current;
      try {
        if (isColdStart) {
          setIsLoading(true);
        }
        const onboardingComplete = await AsyncStorage.getItem(
          '@onboarding_complete',
        );
        if (accessToken) {
          await clearPendingCompanyCreation();
          const showPinImmediate = await AsyncStorage.getItem(
            RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
          );
          if (showPinImmediate === '1') {
            setInitialRoute('RestaurantPinSetup');
            await AsyncStorage.removeItem(RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY);
          } else {
            setInitialRoute('Home');
          }
        } else {
          const pendingCompany = await getPendingCompanyCreation();
          if (pendingCompany) {
            setInitialRoute('CompanyProvisioning');
          } else {
            const prefs = await getRestaurantDevicePrefs();
            if (
              prefs?.isRestaurantDevice &&
              prefs.deviceId &&
              prefs.schemaName
            ) {
              await AsyncStorage.setItem(
                'tenant',
                prefs.schemaName.trim().toLowerCase(),
              );
              setInitialRoute('RestaurantPinSignIn');
            } else if (onboardingComplete === 'true') {
              setInitialRoute('SignIn');
            } else {
              setInitialRoute('OnBoarding');
            }
          }
        }
        if (isColdStart) {
          const delay = isFirstRunRef.current ? 2000 : 400;
          isFirstRunRef.current = false;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('Error during app initialization:', error);
      } finally {
        bootstrapCompleteRef.current = true;
        setIsLoading(false);
      }
    };
    NetworkManager.getInstance();
    initializeApp();
  }, [accessToken, sessionHydrated]);

  if (isLoading || !sessionHydrated) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack.Navigator
        key={accessToken ? 'auth' : 'guest'}
        initialRouteName={
          accessToken
            ? initialRoute === 'RestaurantPinSetup'
              ? 'RestaurantPinSetup'
              : 'Home'
            : guestInitialRouteName
        }
        screenOptions={{
          headerShown: false,
          gestureEnabled: false, // Disable swipe back gesture
        }}>
        {!accessToken ? (
          // Authentication screens - only show when not logged in
          <>
            <Stack.Screen
              name="OnBoarding"
              component={GuestOnBoarding}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignIn"
              component={GuestLogin}
              options={{
                headerShown: false,
                gestureEnabled: false, // Disable swipe back gesture
              }}
            />
            <Stack.Screen
              name="RestaurantPinSignIn"
              component={GuestRestaurantPinSignIn}
              options={{headerShown: false, gestureEnabled: false}}
            />
            <Stack.Screen
              name="SignUp"
              component={GuestSignUp}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CompanyProvisioning"
              component={GuestCompanyProvisioning}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Otp"
              component={GuestOtp}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={GuestForgotPassword}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Main app screens - only show when logged in
          <>
            <Stack.Screen
              name="SelectBranch"
              children={(props: any) => (
                <AuthGuard requireAuth={true}>
                  <SelectBranch {...props} />
                </AuthGuard>
              )}
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="RestaurantPinSetup"
              children={(props: any) => (
                <AuthGuard requireAuth={true}>
                  <RestaurantPinSetup {...props} />
                </AuthGuard>
              )}
              options={{headerShown: false, gestureEnabled: false}}
            />
            <Stack.Screen
              name="Home"
              component={HomeAuthenticatedLayout}
              options={{
                headerShown: false,
                gestureEnabled: false, // Disable swipe back gesture
              }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionPage}
              options={{headerShown: false, gestureEnabled: false}}
            />
            <Stack.Screen
              name="SubscriptionMobileMoney"
              component={MobileMoneyPaymentInstructions}
              options={{headerShown: false, gestureEnabled: false}}
            />
            <Stack.Screen
              name="Cart"
              component={RouteCart}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={Settings}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SyncQueue"
              component={SyncQueue}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LocalDatabase"
              component={LocalDatabase}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BusinessDetails"
              component={RouteBusinessDetails}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AvailableModules"
              component={RouteAvailableModules}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Expenses"
              component={RouteExpenses}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ExpenseHistory"
              component={RouteExpenseHistory}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MyWallet"
              component={RouteMyWallet}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Reports"
              component={RouteReportsMenu}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProfitLossReport"
              component={ProfitLossReportRoute}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BalanceSheetReport"
              component={BalanceSheetReportRoute}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Items"
              component={RouteItemsMenu}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AllItems"
              component={RouteAllItems}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AllServices"
              component={RouteAllItems}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Customers"
              component={RouteCustomers}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ItemCategories"
              component={RouteItemCategories}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UnitsOfMeasure"
              component={RouteUnitsOfMeasure}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SalesHistory"
              component={RouteSalesHistory}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PrintLabels"
              component={RoutePrintLabels}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ItemJournal"
              component={RouteItemJournal}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OpeningBalanceJournal"
              component={RouteOpeningBalanceJournal}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ItemJournalHistory"
              component={RouteItemJournalHistory}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SearchPage"
              component={RouteSearchPage}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Purchases"
              component={RoutePurchaseHistory}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PurchaseCreation"
              component={RoutePurchaseCreation}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Suppliers"
              component={RouteSuppliers}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Payments"
              component={RoutePayments}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BankAccounts"
              component={RouteBankAccounts}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Prepayments"
              component={RoutePrepayments}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BankAccountLedger"
              component={RouteBankAccountLedger}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Financials"
              component={RouteFinancials}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UserManagement"
              component={RouteUserManagement}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Users"
              component={RouteUsers}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="UserSetupList"
              component={RouteUserSetupList}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantHub"
              component={RestaurantHub}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantPOS"
              component={RouteRestaurantPOS}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantOrders"
              component={RouteRestaurantOrders}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantKitchen"
              component={RouteRestaurantKitchen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantDashboard"
              component={RouteRestaurantDashboard}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantTables"
              component={RouteRestaurantTables}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantReservations"
              component={RouteRestaurantReservations}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantMenus"
              component={RouteRestaurantMenus}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RestaurantSettings"
              component={RouteRestaurantSettings}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="PrinterConfig"
              component={PrinterConfig}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BarcodeScanner"
              component={BarcodeScannerScreen}
              options={{headerShown: false}}
            />
          </>
        )}
      </Stack.Navigator>
      <AppToastHost />
    </>
  );
};

function ThemedNavigation() {
  const {isDark, colors} = useTheme();
  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: COLORS.primary,
        background: colors.screenMuted,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
      },
    }),
    [isDark, colors],
  );
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <AppNavigator />
      <BranchSelectModal />
      <RestaurantPinRouteGate />
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AppProvider>
          <NetworkProvider>
            <OfflineProvider>
              <TenantProvider>
                <CartProvider>
                  <SearchModeProvider>
                    <ThemeProvider>
                      <AppUpdateGate>
                        <ThemedNavigation />
                        <NotificationBootstrap />
                        <CustomerDisplayHost />
                      </AppUpdateGate>
                    </ThemeProvider>
                  </SearchModeProvider>
                </CartProvider>
              </TenantProvider>
            </OfflineProvider>
          </NetworkProvider>
        </AppProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

export default App;
