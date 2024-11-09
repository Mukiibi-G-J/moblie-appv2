import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from './src/Screens/SplashScreen/SplashScreen';
import OnBoarding from './src/OnBoarding/OnBoarding';
import SignIn from './src/Screens/Authentication/SignIn';
import { AppProvider, useAuth } from './src/context/Store';
import CustomDrawer from './src/navigation/CustomDrawer';
import Cart from './src/Screens/Cart/Cart';
import { CartProvider } from './src/context/CartStore';
import { navigationRef } from './src/hooks/NavigationService';
import Sales from './src/Screens/Sales/Sales';
import Settings from './src/Screens/Settings/Settings';
import Expenses from './src/Screens/Expenses/Expenses';
import MyWallet from './src/Screens/MyWallet/MyWallet';
import Reports from './src/Screens/Reports/Reports';
import Products from './src/Screens/Products/Products';
import PrintLabels from './src/Screens/PrintLabels/PrintLabels';
import SignUp from './src/Screens/Authentication/SignUp';
import Otp from './src/Screens/Otp/Otp';
import ItemJournal from './src/Screens/ItemJournal/ItemJournal';
import NetworkManager from './src/utils/networkManager';
import Toast from 'react-native-toast-message';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('OnBoarding');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check onboarding status
        const onboardingComplete = await AsyncStorage.getItem('@onboarding_complete');
        if (onboardingComplete === 'true') {
          setInitialRoute('SignIn');
        }

        // Simulate any other initialization process
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error during app initialization:', error);
      } finally {
        setIsLoading(false);
      }
    };
    NetworkManager.getInstance();

    initializeApp();
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>

      <Stack.Navigator initialRouteName={initialRoute}>
        {accessToken ? (
          <>
            <Stack.Screen
              name="Home"
              component={CustomDrawer}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Sales"
              component={Sales}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="Cart"
              component={Cart}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={Settings}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Expenses"
              component={Expenses}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MyWallet"
              component={MyWallet}
              options={{ headerShown: false }}

            />
            <Stack.Screen
              name="Reports"
              component={Reports}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Products"
              component={Products}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PrintLabels"
              component={PrintLabels}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ItemJournal"
              component={ItemJournal}
              options={{ headerShown: false }}
            />
             <Stack.Screen
              name="SignIn"
              component={SignIn}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name='OnBoarding'
              component={OnBoarding}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Otp"
              component={Otp}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignIn"
              component={SignIn}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUp}
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
    <AppProvider>
      <CartProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
      </CartProvider>
    </AppProvider>
  );
}

export default App;
