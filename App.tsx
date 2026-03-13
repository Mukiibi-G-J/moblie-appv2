import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text } from 'react-native';
import SplashScreen from './src/Screens/SplashScreen/SplashScreen';
import OnBoarding from './src/OnBoarding/OnBoarding';
import SignIn from './src/Screens/Authentication/SignIn';
import { AppProvider, useAuth } from './src/context/Store';
import { TenantProvider } from './src/context/TenantContext';
import { NetworkProvider } from './src/context/NetworkContext';
import CustomDrawer from './src/navigation/CustomDrawer';
import Cart from './src/Screens/Cart/Cart';
import { CartProvider } from './src/context/CartStore';
import { SearchModeProvider } from './src/context/SearchModeStore';
import { navigationRef } from './src/hooks/NavigationService';
import Settings from './src/Screens/Settings/Settings';
import Expenses from './src/Screens/Expenses/Expenses';
import ExpenseHistory from './src/Screens/Expenses/ExpenseHistory';
import MyWallet from './src/Screens/MyWallet/MyWallet';
import Reports from './src/Screens/Reports/Reports';
import Items from './src/Screens/Items/Items';
import ItemCategories from './src/Screens/Items/ItemCategories';
import SalesHistory from './src/Screens/Sales/SalesHistory';
import PrintLabels from './src/Screens/PrintLabels/PrintLabels';
import SignUp from './src/Screens/Authentication/SignUp';
import Otp from './src/Screens/Otp/Otp';
import ItemJournal from './src/Screens/ItemJournal/ItemJournal';
import SearchPage from './src/Screens/Search/SearchPage';
import NetworkManager from './src/utils/networkManager';
import Toast from 'react-native-toast-message';
import Login from './src/Screens/Authentication/Login';
import AuthGuard from './src/Components/AuthGuard';
import Purchases from './src/Screens/Purchases/Purchases';
import PurchaseCreation from './src/Screens/Purchases/PurchaseCreation';
import Suppliers from './src/Screens/Suppliers/Suppliers';
import Payments from './src/Screens/Payments/Payments';
import Loans from './src/Screens/Loans/Loans';
import LoanRepayments from './src/Screens/Loans/LoanRepayments';
import Prepayments from './src/Screens/Prepayments/Prepayments';
import BankAccounts from './src/Screens/BankAccounts/BankAccounts';
import BankAccountLedger from './src/Screens/BankAccounts/BankAccountLedger';
import Financials from './src/Screens/Financials/Financials';
import UserManagement from './src/Screens/UserManagement/UserManagement';
import { ProtectedScreen } from './src/Components/ProtectedScreen';
import { PAGE_NAMES } from './src/constants/pageNames';
import PrinterConfig from './src/Screens/PrinterConfig/PrinterConfig';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('OnBoarding');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const onboardingComplete = await AsyncStorage.getItem(
          '@onboarding_complete',
        );
        if (accessToken) {
          setInitialRoute('Home');
        } else if (onboardingComplete === 'true') {
          setInitialRoute('SignIn');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error during app initialization:', error);
      } finally {
        setIsLoading(false);
      }
    };
    NetworkManager.getInstance();
    initializeApp();
  }, [accessToken]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          gestureEnabled: false, // Disable swipe back gesture
        }}>
        {!accessToken ? (
          // Authentication screens - only show when not logged in
          <>
            <Stack.Screen
              name="OnBoarding"
              component={(props: any) => (
                <AuthGuard requireAuth={false}>
                  <OnBoarding {...props} />
                </AuthGuard>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignIn"
              component={(props: any) => (
                <AuthGuard requireAuth={false}>
                  <Login {...props} />
                </AuthGuard>
              )}
              options={{
                headerShown: false,
                gestureEnabled: false, // Disable swipe back gesture
              }}
            />
            <Stack.Screen
              name="SignUp"
              component={(props: any) => (
                <AuthGuard requireAuth={false}>
                  <SignUp {...props} />
                </AuthGuard>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Otp"
              component={(props: any) => (
                <AuthGuard requireAuth={false}>
                  <Otp {...props} />
                </AuthGuard>
              )}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Main app screens - only show when logged in
          <>
            <Stack.Screen
              name="Home"
              component={(props: any) => (
                <AuthGuard requireAuth={true}>
                  <CustomDrawer {...props} />
                </AuthGuard>
              )}
              options={{
                headerShown: false,
                gestureEnabled: false, // Disable swipe back gesture
              }}
            />
            <Stack.Screen
              name="Cart"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.SALES}>
                  <Cart {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.PROFILE_SETTINGS}>
                  <Settings {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Expenses"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.EXPENSES}>
                  <Expenses {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ExpenseHistory"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.EXPENSE_HISTORY}>
                  <ExpenseHistory {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MyWallet"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.PAYMENTS}>
                  <MyWallet {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Reports"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.REPORTS}>
                  <Reports {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Items"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.ITEMS}>
                  <Items {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ItemCategories"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.ITEM_CATEGORIES}>
                  <ItemCategories {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SalesHistory"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.SALES_HISTORY}>
                  <SalesHistory {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PrintLabels"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.ITEMS}>
                  <PrintLabels {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ItemJournal"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.ITEM_JOURNAL}>
                  <ItemJournal {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SearchPage"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.ITEMS}>
                  <SearchPage {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Purchases"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.PURCHASES}>
                  <Purchases {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PurchaseCreation"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.PURCHASES}>
                  <PurchaseCreation {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Suppliers"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.SUPPLIERS}>
                  <Suppliers {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Payments"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.PAYMENTS}>
                  <Payments {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BankAccounts"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.BANK_ACCOUNT_MANAGEMENT}>
                  <BankAccounts {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Loans"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.LOAN_REGISTRATION}>
                  <Loans {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LoanRepayments"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.LOAN_REPAYMENT}>
                  <LoanRepayments {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Prepayments"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.PREPAYMENTS}>
                  <Prepayments {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BankAccountLedger"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.BANK_ACCOUNT_LEDGER_ENTRIES}>
                  <BankAccountLedger {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Financials"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.FINANCIAL_REPORTS}>
                  <Financials {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UserManagement"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.USER_MANAGEMENT}>
                  <UserManagement {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PrinterConfig"
              component={(props: any) => (
                <ProtectedScreen pageName={PAGE_NAMES.PROFILE_SETTINGS}>
                  <PrinterConfig {...props} />
                </ProtectedScreen>
              )}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
      <Toast />
    </>
  );
};

function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NetworkProvider>
          <TenantProvider>
            <CartProvider>
              <SearchModeProvider>
                <NavigationContainer ref={navigationRef}>
                  <AppNavigator />
                </NavigationContainer>
              </SearchModeProvider>
            </CartProvider>
          </TenantProvider>
        </NetworkProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

export default App;
