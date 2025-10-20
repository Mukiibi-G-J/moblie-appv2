import React, {useState, useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {NetworkStatusCard} from './src/Components/NetworkStatusCard';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {View, Text} from 'react-native';
import SplashScreen from './src/Screens/SplashScreen/SplashScreen';
import OnBoarding from './src/OnBoarding/OnBoarding';
import SignIn from './src/Screens/Authentication/SignIn';
import {AppProvider, useAuth} from './src/context/Store';
import {TenantProvider} from './src/context/TenantContext';
import {NetworkProvider} from './src/context/NetworkContext';
import CustomDrawer from './src/navigation/CustomDrawer';
import Cart from './src/Screens/Cart/Cart';
import {CartProvider} from './src/context/CartStore';
import {SearchModeProvider} from './src/context/SearchModeStore';
import {navigationRef} from './src/hooks/NavigationService';
import Sales from './src/Screens/Sales/Sales';
import Settings from './src/Screens/Settings/Settings';
import Expenses from './src/Screens/Expenses/Expenses';
import MyWallet from './src/Screens/MyWallet/MyWallet';
import Reports from './src/Screens/Reports/Reports';
import Items from './src/Screens/Items/Items';
import PrintLabels from './src/Screens/PrintLabels/PrintLabels';
import SignUp from './src/Screens/Authentication/SignUp';
import Otp from './src/Screens/Otp/Otp';
import ItemJournal from './src/Screens/ItemJournal/ItemJournal';
import SearchPage from './src/Screens/Search/SearchPage';
import NetworkManager from './src/utils/networkManager';
import Toast from 'react-native-toast-message';
import Login from './src/Screens/Authentication/Login';
import AuthGuard from './src/Components/AuthGuard';
// PrinterTestButton import removed - keeping test code in PrintService

const Stack = createStackNavigator();

const AppNavigator = () => {
  const {accessToken} = useAuth();
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
      <NetworkStatusCard />
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
              options={{headerShown: false}}
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
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Otp"
              component={(props: any) => (
                <AuthGuard requireAuth={false}>
                  <Otp {...props} />
                </AuthGuard>
              )}
              options={{headerShown: false}}
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
              name="Sales"
              component={Sales}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Cart"
              component={Cart}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Settings"
              component={Settings}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Expenses"
              component={Expenses}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="MyWallet"
              component={MyWallet}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Reports"
              component={Reports}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Items"
              component={Items}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="PrintLabels"
              component={PrintLabels}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ItemJournal"
              component={ItemJournal}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="SearchPage"
              component={SearchPage}
              options={{headerShown: false}}
            />
            {/* PrinterTest screen removed - keeping test code in PrintService */}
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
