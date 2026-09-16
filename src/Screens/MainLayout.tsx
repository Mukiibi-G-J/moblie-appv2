import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {useTheme} from '../context/ThemeContext';
import {constants} from '../constants';
import {PAGE_NAMES} from '../constants/pageNames';
import {usePermissions} from '../hooks/usePermissions';
import {useTabContext} from '../context/Store';
import MainBottomTabBar from '../Components/MainBottomTabBar';
import {CatalogSyncModal} from '../Components/CatalogSyncModal';
import {useOfflineBootstrap} from '../hooks/useOfflineBootstrap';
import Home from './Home/Home';
import Cart from './Cart/Cart';
import MoreMenu from './More/MoreMenu';

type MainLayoutProps = {
  navigation: StackNavigationProp<any>;
};

const MemoHome = React.memo(Home);
const MemoCart = Cart;
const MemoMoreMenu = React.memo(MoreMenu);

const MainLayout: React.FC<MainLayoutProps> = ({navigation}) => {
  const {colors} = useTheme();
  const {syncModalVisible, syncMessage, syncProgress} = useOfflineBootstrap();
  const {selectedTab, setSelectedTab} = useTabContext();
  const {isModuleVisible, canAccessMobileNav} = usePermissions();
  const showMakeSaleTab =
    isModuleVisible('sales') &&
    canAccessMobileNav('makeSale', PAGE_NAMES.SALES);

  const bottomTabs = useMemo(() => {
    if (showMakeSaleTab) {
      return constants.bottom_tabs;
    }
    return constants.bottom_tabs.filter(
      t => t.label !== constants.screens.makeSale,
    );
  }, [showMakeSaleTab]);

  const [mountedTabs, setMountedTabs] = useState<Record<string, boolean>>({
    [selectedTab]: true,
  });

  useEffect(() => {
    if (!showMakeSaleTab && selectedTab === constants.screens.makeSale) {
      setSelectedTab(constants.screens.home);
    }
  }, [showMakeSaleTab, selectedTab, setSelectedTab]);

  useEffect(() => {
    setMountedTabs(prev =>
      prev[selectedTab] ? prev : {...prev, [selectedTab]: true},
    );
  }, [selectedTab]);

  const renderTabScreen = useCallback(
    (tabLabel: string) => {
      switch (tabLabel) {
        case constants.screens.home:
          return <MemoHome />;
        case constants.screens.makeSale:
          return <MemoCart navigation={navigation} isTabMode />;
        case constants.screens.more:
          return <MemoMoreMenu />;
        default:
          return null;
      }
    },
    [navigation],
  );

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <CatalogSyncModal
        visible={syncModalVisible}
        message={syncMessage}
        progress={syncProgress}
      />
      <View style={styles.content}>
        {bottomTabs.map(item => (
          <View
            key={item.id}
            pointerEvents={selectedTab === item.label ? 'auto' : 'none'}
            style={[
              styles.tabPane,
              selectedTab === item.label
                ? styles.tabPaneVisible
                : styles.tabPaneHidden,
            ]}>
            {mountedTabs[item.label] ? renderTabScreen(item.label) : null}
          </View>
        ))}
      </View>

      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={setSelectedTab}
        tabs={bottomTabs}
      />
    </View>
  );
};

export default MainLayout;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 1000,
  },
  content: {
    flex: 1,
  },
  tabPane: {
    ...StyleSheet.absoluteFillObject,
  },
  tabPaneVisible: {
    opacity: 1,
  },
  tabPaneHidden: {
    opacity: 0,
  },
});
