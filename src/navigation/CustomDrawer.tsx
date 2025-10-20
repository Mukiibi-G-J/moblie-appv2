// src/navigation/CustomDrawer.tsx
import React from 'react';
import {View, Text, Image, TouchableOpacity} from 'react-native';

import {COLORS, FONTS, SIZES, constants, icons, dummyData} from '../constants';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import MainLayout from '../Screens/MainLayout';
import {useAppContext, useAuth} from '../context/Store';
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
        backgroundColor: isFocused ? COLORS.transparentBlack1 : null,
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
  return (
    <DrawerContentScrollView
      scrollEnabled={true}
      contentContainerStyle={{
        flex: 1,
        backgroundColor: COLORS.primary2,
      }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: SIZES.radius,
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
          }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate('MyAccount');
          }}>
          <Image
            source={icons.profile}
            style={{
              width: 50,
              height: 50,
              borderRadius: 50,
              // backgroundColor: COLORS.white,
              borderWidth: 2,
              borderColor: COLORS.primary2,
              tintColor: COLORS.white,
              marginLeft: 2,
            }}
          />

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

        {/* Drawer Items */}
        <View
          style={{
            flex: 1,
            marginTop: SIZES.height > 800 ? SIZES.padding : SIZES.radius,
          }}>
          <CustomDrawerItem
            label={constants.screens.home}
            icon={icons.home}
            isFocused={selectedTab == constants.screens.home}
            onPress={() => {
              setSelectedTab(constants.screens.home);
              navigation.navigate('MainLayout');
            }}
          />

          <CustomDrawerItem
            label={constants.screens.my_wallet}
            isFocused={selectedTab == constants.screens.my_wallet}
            onPress={() => {
              navigation.closeDrawer();
              navigation.navigate('MyWallet');
            }}
            icon={icons.wallet}
          />
          <CustomDrawerItem
            label="Reports"
            icon={icons.reports}
            isFocused={selectedTab == constants.screens.reports}
            onPress={() => {
              navigation.closeDrawer();
              navigation.navigate('Reports');
            }}
          />
          <CustomDrawerItem
            label={constants.screens.itemJournal}
            icon={icons.itemJournal}
            isFocused={selectedTab == constants.screens.itemJournal}
            onPress={() => {
              navigation.closeDrawer();
              navigation.navigate('ItemJournal');
            }}
          />

          {/* <CustomDrawerItem
                        label={constants.screens.notification}
                        icon={icons.notification}
                        isFocused={selectedTab == constants.screens.notification}
                        onPress={() => {
                            setSelectedTab(constants.screens.notification)
                            navigation.navigate("MainLayout")
                        }}
                    />

                    <CustomDrawerItem
                        label={constants.screens.favourite}
                        icon={icons.favourite}
                        isFocused={selectedTab == constants.screens.favourite}
                        onPress={() => {
                            setSelectedTab(constants.screens.favourite)
                            navigation.navigate("MainLayout")
                        }}
                    /> */}

          {/* Line Divider */}
          <View
            style={{
              height: 2,
              marginVertical: SIZES.height > 800 ? SIZES.radius : SIZES.base,
              marginLeft: SIZES.radius,
              backgroundColor: COLORS.lightGray1,
            }}
          />

          {/* <CustomDrawerItem
                        label="Track Your Order"
                        icon={icons.location}
                        onPress={() => {
                            navigation.closeDrawer()
                            navigation.navigate("Map")
                        }}
                    /> */}

          {/*I <CustomDrawertem
                        label="My Orders"
                        icon={icons.location}
                        onPress={() => {
                            navigation.closeDrawer()
                            navigation.navigate("Order")
                        }}
                    /> */}

          <CustomDrawerItem
            label="Expenses"
            icon={icons.coupon}
            isFocused={selectedTab == constants.screens.expenses}
            onPress={() => {
              navigation.closeDrawer();
              navigation.navigate('Expenses');
            }}
          />

          <CustomDrawerItem
            label="Settings"
            icon={icons.setting}
            isFocused={selectedTab == constants.screens.settings}
            onPress={() => {
              navigation.closeDrawer();
              navigation.navigate('Settings');
            }}
          />

          {/* <CustomDrawerItem
                        label="Help Center"
                        icon={icons.help}
                    /> */}
        </View>

        <View
          style={{
            marginBottom: SIZES.height > 800 ? SIZES.padding : 0,
          }}>
          <CustomDrawerItem
            label="Logout"
            icon={icons.logout}
            isFocused={false}
            onPress={() => {
              navigation.closeDrawer();
              logout();
              // Don't navigate manually - let App.tsx handle it based on auth state
            }}
          />
        </View>
      </View>
    </DrawerContentScrollView>
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
          sceneContainerStyle: {
            backgroundColor: 'transparent',
          },
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
