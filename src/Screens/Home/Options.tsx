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
import {COLORS, icons} from '../../constants';

const Options = () => {
  const navigation = useNavigation();

  const options = [
    {
      icon: icons.cart,
      iconColor: COLORS.primary,
      title: 'Sales',
      subtitle: 'Manage sales',
      link: 'Sales',
      color: 'rgba(76, 175, 80, 0.1)',
      borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    {
      icon: icons.product,
      iconColor: COLORS.secondary,
      title: 'Items',
      subtitle: 'Inventory & stock',
      link: 'Items',
      color: 'rgba(33, 150, 243, 0.1)',
      borderColor: 'rgba(33, 150, 243, 0.3)',
    },
    {
      icon: icons.printer, // Assuming you have a label icon
      iconColor: COLORS.warning,
      title: 'Print Labels',
      subtitle: 'Generate labels',
      link: 'PrintLabels',
      color: 'rgba(255, 152, 0, 0.1)',
      borderColor: 'rgba(255, 152, 0, 0.3)',
    },
    {
      icon: icons.cart,
      iconColor: COLORS.error,
      title: 'Cart',
      subtitle: 'Quick checkout',
      link: 'Cart',
      color: 'rgba(244, 67, 54, 0.1)',
      borderColor: 'rgba(244, 67, 54, 0.3)',
    },
  ];

  const renderOption = ({item}) => (
    <TouchableOpacity
      style={styles.optionButton}
      onPress={() => navigation.navigate(item.link)}
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Quick Actions</Text>
        <TouchableOpacity>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
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
