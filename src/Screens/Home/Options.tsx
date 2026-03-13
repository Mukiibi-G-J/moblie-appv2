import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {COLORS, icons, constants} from '../../constants';
import {usePermissions} from '../../hooks/usePermissions';
import {useAppContext} from '../../context/Store';

const Options = () => {
  const navigation = useNavigation();
  const {setSelectedTab} = useAppContext();
  const {isModuleVisible, hasAnyPageAccess, canCreate, canRead} = usePermissions();

  // Define all possible options with permission checks
  const allOptions = [
    {
      icon: icons.cart,
      iconColor: COLORS.primary,
      title: 'Sale History',
      subtitle: 'View past sales',
      link: constants.screens.sales,
      color: 'rgba(76, 175, 80, 0.1)',
      borderColor: 'rgba(76, 175, 80, 0.3)',
      // Permission check: sales module + sales page access
      hasPermission: () =>
        isModuleVisible('sales') && hasAnyPageAccess('Sales'),
    },
    {
      icon: icons.product,
      iconColor: COLORS.secondary,
      title: 'Items',
      subtitle: 'Inventory & stock',
      link: constants.screens.items,
      color: 'rgba(33, 150, 243, 0.1)',
      borderColor: 'rgba(33, 150, 243, 0.3)',
      // Permission check: items module + items page access
      hasPermission: () =>
        isModuleVisible('items') && hasAnyPageAccess('Items'),
    },
    {
      icon: icons.printer,
      iconColor: COLORS.warning,
      title: 'Print Labels',
      subtitle: 'Generate labels',
      link: 'PrintLabels',
      color: 'rgba(255, 152, 0, 0.1)',
      borderColor: 'rgba(255, 152, 0, 0.3)',
      // Permission check: items module + read permission
      hasPermission: () => isModuleVisible('items') && canRead('Items'),
    },
    {
      icon: icons.cart,
      iconColor: COLORS.error,
      title: 'Make Sale',
      subtitle: 'Create new sale',
      link: 'Cart',
      color: 'rgba(244, 67, 54, 0.1)',
      borderColor: 'rgba(244, 67, 54, 0.3)',
      // Permission check: sales module + create permission
      hasPermission: () => isModuleVisible('sales') && canCreate('Sales'),
    },
  ];

  // Filter options based on permissions
  const options = allOptions.filter(option => option.hasPermission());

  const renderOption = ({item}) => {
    const handlePress = () => {
      // Map tab names to screen names for navigation
      const screenMap: {[key: string]: string} = {
        [constants.screens.sales]: 'SalesHistory',
        [constants.screens.items]: 'Items',
      };
      
      // If it has a screen route, navigate to it (like Cart)
      if (screenMap[item.link]) {
        navigation.navigate(screenMap[item.link] as never);
      } else if (item.link === 'Cart' || item.link === 'PrintLabels') {
        // For other screens, use navigation directly
        navigation.navigate(item.link as never);
      } else {
        // Fallback: try to switch tabs for other bottom tabs
        console.log('Switching to tab:', item.link);
        setSelectedTab(item.link);
      }
    };

    return (
      <TouchableOpacity
        style={styles.optionButton}
        onPress={handlePress}
        activeOpacity={0.7}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: item.color,
            borderColor: item.borderColor,
          },
        ]}>
        <Image
          source={item.icon}
          style={[styles.icon, {tintColor: item.iconColor}]}
          resizeMode="contain"
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </TouchableOpacity>
    );
  };

  // Don't render if no options available
  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Quick Actions</Text>
      </View>
      <View style={styles.gridContainer}>
        <FlatList
          data={options}
          renderItem={renderOption}
          keyExtractor={item => item.title}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  gridContainer: {
    marginTop: 8,
  },
  optionButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  icon: {
    width: 24,
    height: 24,
  },
  textContainer: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
});

export default Options;
