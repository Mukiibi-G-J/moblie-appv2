import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useNetworkGet} from '../hooks/useNetwork';
import {COLORS, FONTS} from '../constants';

interface Item {
  id: number;
  name: string;
  price: number;
}

export const NetworkAwareComponent = () => {
  const {
    data: items,
    isLoading,
    error,
    isConnected,
    retry,
  } = useNetworkGet<Item[]>('/api/items/', {
    cacheKey: 'items-list',
    retryCount: 3,
    onOffline: () => console.log('Device went offline'),
    onOnline: () => console.log('Device is back online'),
    onError: error => console.error('Failed to fetch items:', error),
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.text}>Loading items...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.offlineText}>You are currently offline</Text>
        {items && (
          <Text style={styles.cacheText}>
            Showing cached data from last sync
          </Text>
        )}
        <View style={styles.itemsContainer}>
          {items?.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>
                UGX {item.price.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.itemsContainer}>
        {items?.map(item => (
          <View key={item.id} style={styles.itemCard}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>
              UGX {item.price.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.white,
  },
  text: {
    ...FONTS.body3,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryText: {
    ...FONTS.body3,
    color: COLORS.white,
  },
  offlineText: {
    ...FONTS.h3,
    color: COLORS.darkgray,
    textAlign: 'center',
    marginBottom: 8,
  },
  cacheText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 16,
  },
  itemsContainer: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: COLORS.lightGray2,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    ...FONTS.body3,
  },
  itemPrice: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
});
