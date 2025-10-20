import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import {FONTS, SIZES, COLORS, icons} from '../../constants';
import {Header, IconButton} from '../../Components';
import {useCart} from '../../context/CartStore';
import {useSearchMode} from '../../context/SearchModeStore';
import {searchItems} from '../../services/app.services';
import {CartItem} from '../../@types/types.dto';

const SearchPage = () => {
  const navigation = useNavigation();
  const {state, dispatch} = useCart();
  const {state: searchMode} = useSearchMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const isRealtimeMode = searchMode.searchMode === 'realtime';

  const searchInputRef = useRef<TextInput>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when page loads
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await searchItems(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      Toast.show({
        type: 'error',
        text1: 'Search Error',
        text2: 'Failed to search items. Please try again.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const addToCart = (item: CartItem) => {
    const existItem = state.cartItems.find(
      (x: CartItem) => x.system_id === item.system_id,
    );
    const quantity = existItem ? (Number(existItem.quantity) || 0) + 1 : 1;

    if (quantity > item.inventory) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Sorry, only ${item.inventory} items available in stock.`,
      });
      return;
    }

    // Add current date as date_sold
    const currentDate = new Date().toISOString();

    dispatch({
      type: 'CART_ADD_ITEM',
      payload: {
        ...item,
        quantity,
        date_sold: currentDate,
      },
    });

    Toast.show({
      type: 'success',
      text1: 'Item Added',
      text2: `${item.item_name} has been added to your cart.`,
    });

    // Clear search and go back to cart
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    navigation.goBack();
  };

  const renderSearchItem = ({item}: {item: CartItem}) => (
    <TouchableOpacity style={styles.searchItem} onPress={() => addToCart(item)}>
      <View style={styles.itemImageContainer}>
        <Image
          source={
            item.item_images && item.item_images[0]?.url
              ? {uri: item.item_images[0].url}
              : icons.product2
          }
          style={styles.itemImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.item_name}
        </Text>
        <View style={styles.itemInfo}>
          <Text style={styles.stockText}>Stock: {item.inventory}</Text>
          <Text style={styles.priceText}>
            UGX {item.unit_price?.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (hasSearched && searchResults.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Image source={icons.search} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>
            No items found for "{searchQuery}"
          </Text>
          <Text style={styles.emptySubtext}>
            Try searching with different keywords
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Image source={icons.search} style={styles.emptyIcon} />
        <Text style={styles.emptyText}>Search for items</Text>
        <Text style={styles.emptySubtext}>
          Enter item name, barcode, or description
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header
          title="Search Items"
          showBack={true}
          onBackPress={() => navigation.goBack()}
          containerStyle={styles.header}
        />

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Image source={icons.search} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search items..."
              placeholderTextColor={COLORS.gray}
              value={searchQuery}
              onChangeText={text => {
                setSearchQuery(text);
                if (isRealtimeMode) {
                  // Clear previous timeout
                  if (debounceTimeoutRef.current) {
                    clearTimeout(debounceTimeoutRef.current);
                  }

                  if (text.trim()) {
                    // Set new timeout for debounced search
                    debounceTimeoutRef.current = setTimeout(() => {
                      handleSearch(text);
                    }, 300); // 300ms debounce
                  } else {
                    setSearchResults([]);
                    setHasSearched(false);
                  }
                }
              }}
              onSubmitEditing={() =>
                !isRealtimeMode && handleSearch(searchQuery)
              }
              returnKeyType={isRealtimeMode ? 'done' : 'search'}
              autoFocus={true}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setHasSearched(false);
                }}>
                <Image source={icons.cross} style={styles.clearIcon} />
              </TouchableOpacity>
            )}
          </View>

          {!isRealtimeMode && (
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => handleSearch(searchQuery)}
              disabled={!searchQuery.trim() || isSearching}>
              {isSearching ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        <View style={styles.resultsContainer}>
          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderSearchItem}
              keyExtractor={item => item.system_id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            renderEmptyState()
          )}
        </View>
      </KeyboardAvoidingView>

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.radius,
    marginRight: SIZES.base,
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray,
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    height: 45,
    color: COLORS.black,
    ...FONTS.body3,
  },
  clearButton: {
    padding: SIZES.base,
  },
  clearIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: COLORS.white,
    ...FONTS.h4,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base,
    marginBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGray2,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    marginLeft: SIZES.base,
  },
  itemName: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockText: {
    ...FONTS.body5,
    color: COLORS.gray,
  },
  priceText: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SIZES.base,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    tintColor: COLORS.gray,
    opacity: 0.5,
    marginBottom: SIZES.padding,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  emptySubtext: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default SearchPage;
