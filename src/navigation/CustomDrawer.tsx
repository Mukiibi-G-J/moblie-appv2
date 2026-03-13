// src/navigation/CustomDrawer.tsx
import React from 'react';
import {View, Text, Image, TouchableOpacity, ScrollView} from 'react-native';

import {COLORS, FONTS, SIZES, constants, icons, dummyData} from '../constants';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import MainLayout from '../Screens/MainLayout';
import {useAppContext, useAuth} from '../context/Store';
import {usePermissions} from '../hooks/usePermissions';
import {useState} from 'react';
import {useNavigation} from '@react-navigation/native';

const Drawer = createDrawerNavigator();
const CustomDrawerItem = ({
  label,
  icon,
  isFocused,
  onPress,
}: {
  label: string;
  icon: any;
  isFocused: boolean;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        height: 40,
        marginBottom: SIZES.base,
        alignItems: 'center',
        paddingLeft: SIZES.radius,
        borderRadius: SIZES.base,
        backgroundColor: isFocused ? COLORS.transparentBlack1 : undefined,
      }}
      onPress={onPress}>
      <Image
        source={icon}
        style={{
          width: 20,
          height: 20,
          tintColor: COLORS.white,
        }}
      />

      <Text
        style={{
          marginLeft: 15,
          color: COLORS.white,
          ...FONTS.h3,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};
const CustomDrawerContent = ({
  navigation,
  selectedTab,
  setSelectedTab,
}: {
  navigation: any;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}) => {
  const {
    auth: {username},
  } = useAuth();
  const {logout} = useAppContext();
  const {isModuleVisible} = usePermissions();

  // Quick Access - Links to bottom tabs (with indicator)
  const quickAccessItems = [
    {
      key: 'home',
      label: constants.screens.home,
      icon: icons.home,
      moduleCode: undefined,
      action: () => {
        setSelectedTab(constants.screens.home);
        navigation.navigate('MainLayout');
      },
      isFocused: selectedTab === constants.screens.home,
      isBottomTab: true,
    },
    {
      key: 'sales',
      label: constants.screens.sales,
      icon: icons.cart,
      moduleCode: 'sales',
      action: () => {
        setSelectedTab(constants.screens.sales);
        navigation.navigate('MainLayout');
      },
      isFocused: selectedTab === constants.screens.sales,
      isBottomTab: true,
    },
    {
      key: 'items',
      label: constants.screens.items,
      icon: icons.product,
      moduleCode: 'items',
      action: () => {
        setSelectedTab(constants.screens.items);
        navigation.navigate('MainLayout');
      },
      isFocused: selectedTab === constants.screens.items,
      isBottomTab: true,
    },
    {
      key: 'customers',
      label: constants.screens.customers,
      icon: icons.profile,
      moduleCode: 'customers',
      action: () => {
        setSelectedTab(constants.screens.customers);
        navigation.navigate('MainLayout');
      },
      isFocused: selectedTab === constants.screens.customers,
      isBottomTab: true,
    },
    {
      key: 'reports',
      label: constants.screens.reports,
      icon: icons.reports,
      moduleCode: 'reports',
      action: () => {
        setSelectedTab(constants.screens.reports);
        navigation.navigate('MainLayout');
      },
      isFocused: selectedTab === constants.screens.reports,
      isBottomTab: true,
    },
  ];

  // Operations Section
  const operationsItems = [
    {
      key: 'purchases',
      label: constants.screens.purchases,
      icon: icons.cart, // Reuse cart icon or add new
      moduleCode: 'purchases',
      action: () => {
        navigation.navigate('Purchases');
      },
      isFocused: false,
    },
    {
      key: 'suppliers',
      label: constants.screens.suppliers,
      icon: icons.product, // Reuse product icon or add truck icon
      moduleCode: 'purchases', // Suppliers share purchases module
      action: () => {
        navigation.navigate('Suppliers');
      },
      isFocused: false,
    },
    {
      key: 'itemCategories',
      label: constants.screens.itemCategories,
      icon: icons.product, // Reuse product icon
      moduleCode: 'items',
      action: () => {
        navigation.navigate('ItemCategories');
      },
      isFocused: false,
    },
    {
      key: 'itemJournal',
      label: constants.screens.itemJournal,
      icon: icons.itemJournal,
      moduleCode: 'inventory',
      action: () => {
        navigation.navigate('ItemJournal');
      },
      isFocused: selectedTab === constants.screens.itemJournal,
    },
  ];

  // Financial Section
  const financialItems = [
    {
      key: 'payments',
      label: constants.screens.payments,
      icon: icons.wallet,
      moduleCode: 'payments',
      action: () => {
        navigation.navigate('Payments');
      },
      isFocused: false,
    },
    {
      key: 'bankAccounts',
      label: constants.screens.bankAccounts,
      icon: icons.wallet,
      moduleCode: 'payments',
      action: () => {
        navigation.navigate('BankAccounts');
      },
      isFocused: false,
    },
    {
      key: 'loans',
      label: constants.screens.loans,
      icon: icons.wallet,
      moduleCode: 'payments',
      action: () => {
        navigation.navigate('Loans');
      },
      isFocused: false,
    },
    {
      key: 'loanRepayments',
      label: constants.screens.loanRepayments,
      icon: icons.wallet,
      moduleCode: 'payments',
      action: () => {
        navigation.navigate('LoanRepayments');
      },
      isFocused: false,
    },
    {
      key: 'expenses',
      label: constants.screens.expenses,
      icon: icons.coupon,
      moduleCode: 'expenses',
      action: () => {
        navigation.navigate('Expenses');
      },
      isFocused: selectedTab === constants.screens.expenses,
    },
    {
      key: 'expenseHistory',
      label: constants.screens.expenseHistory,
      icon: icons.coupon,
      moduleCode: 'expenses',
      action: () => {
        navigation.navigate('ExpenseHistory');
      },
      isFocused: false,
    },
    {
      key: 'prepayments',
      label: constants.screens.prepayments,
      icon: icons.coupon,
      moduleCode: 'payments',
      action: () => {
        navigation.navigate('Prepayments');
      },
      isFocused: false,
    },
    {
      key: 'bankAccountLedger',
      label: constants.screens.bankAccountLedger,
      icon: icons.reports,
      moduleCode: 'payments',
      action: () => {
        navigation.navigate('BankAccountLedger');
      },
      isFocused: false,
    },
    {
      key: 'wallet',
      label: constants.screens.my_wallet,
      icon: icons.wallet,
      moduleCode: 'payments',
      action: () => {
        navigation.navigate('MyWallet');
      },
      isFocused: selectedTab === constants.screens.my_wallet,
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: icons.logout,
      moduleCode: undefined,
      action: () => {
        navigation.closeDrawer();
        logout();
      },
      isFocused: false,
    },
  ];

  // Management Section
  const managementItems = [
    {
      key: 'userManagement',
      label: constants.screens.userManagement,
      icon: icons.profile,
      moduleCode: 'userManagement',
      action: () => {
        navigation.navigate('UserManagement');
      },
      isFocused: false,
    },
  ];

  // Settings & Support Section
  const settingsItems = [
    {
      key: 'settings',
      label: constants.screens.settings,
      icon: icons.setting,
      moduleCode: undefined,
      action: () => {
        navigation.navigate('Settings');
      },
      isFocused: selectedTab === constants.screens.settings,
    },
    {
      key: 'helpSupport',
      label: constants.screens.helpSupport,
      icon: icons.help,
      moduleCode: undefined,
      action: () => {
        // TODO: Navigate to help screen
        navigation.navigate('Settings'); // Temporary
      },
      isFocused: false,
    },
  ];
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.primary2,
      }}>
      {/* Fixed Header Section */}
      <View
        style={{
          paddingHorizontal: SIZES.radius,
          paddingTop: SIZES.radius,
        }}>
        {/* Close */}
        <View
          style={{
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}>
          <TouchableOpacity
            style={{
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => navigation.closeDrawer()}>
            <Image
              source={icons.cross}
              style={{
                height: 35,
                width: 35,
                tintColor: COLORS.white,
              }}
            />
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            marginTop: SIZES.radius,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate('MyAccount');
          }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              borderWidth: 2,
              borderColor: COLORS.white,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.transparentBlack1,
            }}>
            <Image
              source={icons.profile}
              style={{
                width: 30,
                height: 30,
                tintColor: COLORS.white,
              }}
            />
          </View>

          <View
            style={{
              marginLeft: SIZES.radius,
            }}>
            <Text style={{color: COLORS.white, ...FONTS.h3}}>{username}</Text>
            <Text style={{color: COLORS.white, ...FONTS.body4}}>
              View your profile
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Scrollable Drawer Items Section */}
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{
          paddingHorizontal: SIZES.radius,
          paddingBottom: SIZES.height > 800 ? SIZES.padding : SIZES.radius,
        }}
        showsVerticalScrollIndicator={false}>
        <View
          style={{
            marginTop: SIZES.height > 800 ? SIZES.padding : SIZES.radius,
          }}>
          {/* Quick Access Section */}
          <Text
            style={{
              color: COLORS.lightGray1,
              ...FONTS.body5,
              marginLeft: SIZES.radius,
              marginBottom: SIZES.base,
              opacity: 0.7,
            }}>
            QUICK ACCESS
          </Text>
          {quickAccessItems
            .filter(item => {
              if (!item.moduleCode) return true;
              return isModuleVisible(item.moduleCode);
            })
            .map(item => (
              <CustomDrawerItem
                key={item.key}
                label={item.label}
                icon={item.icon}
                isFocused={item.isFocused}
                onPress={() => {
                  navigation.closeDrawer();
                  item.action();
                }}
              />
            ))}

          {/* Operations Section */}
          {operationsItems.filter(item => {
            if (!item.moduleCode) return true;
            return isModuleVisible(item.moduleCode);
          }).length > 0 && (
            <>
              <View
                style={{
                  height: 2,
                  marginVertical:
                    SIZES.height > 800 ? SIZES.radius : SIZES.base,
                  marginLeft: SIZES.radius,
                  backgroundColor: COLORS.lightGray1,
                }}
              />
              <Text
                style={{
                  color: COLORS.lightGray1,
                  ...FONTS.body5,
                  marginLeft: SIZES.radius,
                  marginBottom: SIZES.base,
                  marginTop: SIZES.base,
                  opacity: 0.7,
                }}>
                OPERATIONS
              </Text>
              {operationsItems
                .filter(item => {
                  if (!item.moduleCode) return true;
                  return isModuleVisible(item.moduleCode);
                })
                .map(item => (
                  <CustomDrawerItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    isFocused={item.isFocused}
                    onPress={() => {
                      navigation.closeDrawer();
                      item.action();
                    }}
                  />
                ))}
            </>
          )}

          {/* Financial Section */}
          {financialItems.filter(item => {
            if (!item.moduleCode) return true;
            return isModuleVisible(item.moduleCode);
          }).length > 0 && (
            <>
              <View
                style={{
                  height: 2,
                  marginVertical:
                    SIZES.height > 800 ? SIZES.radius : SIZES.base,
                  marginLeft: SIZES.radius,
                  backgroundColor: COLORS.lightGray1,
                }}
              />
              <Text
                style={{
                  color: COLORS.lightGray1,
                  ...FONTS.body5,
                  marginLeft: SIZES.radius,
                  marginBottom: SIZES.base,
                  marginTop: SIZES.base,
                  opacity: 0.7,
                }}>
                FINANCIAL
              </Text>
              {financialItems
                .filter(item => {
                  if (!item.moduleCode) return true;
                  return isModuleVisible(item.moduleCode);
                })
                .map(item => (
                  <CustomDrawerItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    isFocused={item.isFocused}
                    onPress={() => {
                      navigation.closeDrawer();
                      item.action();
                    }}
                  />
                ))}
            </>
          )}

          {/* Management Section */}
          {managementItems.filter(item => {
            if (!item.moduleCode) return true;
            return isModuleVisible(item.moduleCode);
          }).length > 0 && (
            <>
              <View
                style={{
                  height: 2,
                  marginVertical:
                    SIZES.height > 800 ? SIZES.radius : SIZES.base,
                  marginLeft: SIZES.radius,
                  backgroundColor: COLORS.lightGray1,
                }}
              />
              <Text
                style={{
                  color: COLORS.lightGray1,
                  ...FONTS.body5,
                  marginLeft: SIZES.radius,
                  marginBottom: SIZES.base,
                  marginTop: SIZES.base,
                  opacity: 0.7,
                }}>
                MANAGEMENT
              </Text>
              {managementItems
                .filter(item => {
                  if (!item.moduleCode) return true;
                  return isModuleVisible(item.moduleCode);
                })
                .map(item => (
                  <CustomDrawerItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    isFocused={item.isFocused}
                    onPress={() => {
                      navigation.closeDrawer();
                      item.action();
                    }}
                  />
                ))}
            </>
          )}

          {/* Settings & Support Section */}
          <View
            style={{
              height: 2,
              marginVertical: SIZES.height > 800 ? SIZES.radius : SIZES.base,
              marginLeft: SIZES.radius,
              backgroundColor: COLORS.lightGray1,
            }}
          />
          <Text
            style={{
              color: COLORS.lightGray1,
              ...FONTS.body5,
              marginLeft: SIZES.radius,
              marginBottom: SIZES.base,
              marginTop: SIZES.base,
              opacity: 0.7,
            }}>
            SETTINGS & SUPPORT
          </Text>
          {settingsItems.map(item => (
            <CustomDrawerItem
              key={item.key}
              label={item.label}
              icon={item.icon}
              isFocused={item.isFocused}
              onPress={() => {
                navigation.closeDrawer();
                item.action();
              }}
            />
          ))}
        </View>
      </ScrollView>
      </View>
  );
};

const CustomDrawer = () => {
  const [selectedTab, setSelectedTab] = useState(constants.screens.home);
  const navigation = useNavigation();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.primary2,
        flexDirection: 'row',
      }}>
      <Drawer.Navigator
        screenOptions={{
          headerShown: false,
          overlayColor: 'transparent',
          drawerStyle: {
            flex: 1,
            width: '65%',
            backgroundColor: 'transparent',
          },
          drawerType: 'slide',
        }}
        initialRouteName="MainLayout"
        drawerContent={props => {
          return (
            <CustomDrawerContent
              navigation={props.navigation}
              selectedTab={selectedTab}
              setSelectedTab={setSelectedTab}
            />
          );
        }}>
        <Drawer.Screen name="MainLayout">
          {props => (
            <MainLayout
              {...props}
              selectedTab={selectedTab}
              setSelectedTab={setSelectedTab}
            />
          )}
        </Drawer.Screen>
      </Drawer.Navigator>
    </View>
  );
};

export default CustomDrawer;
