import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {safeGoBack} from '../../hooks/NavigationService';
import Toast from 'react-native-toast-message';
import AppToastHost from '../../Components/AppToastHost';

import {FONTS, SIZES, COLORS, icons} from '../../constants';
import {Header, QuickIconPressable} from '../../Components';
import {useSearchMode} from '../../context/SearchModeStore';
import {useTheme} from '../../context/ThemeContext';
import {
  globalSearch,
  type GlobalSearchHit,
  type GlobalSearchSection,
} from '../../services/app.services';
import {usePermissions} from '../../hooks/usePermissions';
import {enginePagesForSearch} from '../../utils/roleCentreNav';

function resolveSearchScreen(
  sectionTitle: string,
  hit: GlobalSearchHit,
): string {
  const page = hit.pageName || '';
  switch (page) {
    case 'ItemCard':
      return 'AllItems';
    case 'SalesInvoice':
      return 'SalesHistory';
    case 'CustomerCard':
      return 'Customers';
    case 'PurchaseInvoice':
      return 'Purchases';
    case 'VendorCard':
      return 'Suppliers';
    case 'GLAccountCard':
      return 'Reports';
    case 'PaymentJournalCard':
      return 'Payments';
    case 'ItemJournalCard':
      return 'ItemJournal';
    default:
      break;
  }

  switch (sectionTitle) {
    case 'Sales':
      return 'SalesHistory';
    case 'Customers':
      return 'Customers';
    case 'Purchases':
      return 'Purchases';
    case 'Vendors':
      return 'Suppliers';
    case 'Financials':
      return 'Reports';
    case 'Payments':
      return 'Payments';
    case 'Item Journals':
      return 'ItemJournal';
    case 'Inventory':
    default:
      return 'AllItems';
  }
}

const SearchPage = () => {
  const navigation = useNavigation<any>();
  const {colors} = useTheme();
  const {state: searchMode} = useSearchMode();
  const {canAccessMobileScreen} = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [sections, setSections] = useState<GlobalSearchSection[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const isRealtimeMode = searchMode.searchMode === 'realtime';

  const searchInputRef = useRef<TextInput>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSections([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await globalSearch(query.trim());
      const allowed = results
        .map(section => ({
          ...section,
          data: (section.data || []).filter(hit =>
            canAccessMobileScreen(
              enginePagesForSearch(section.title, hit.pageName),
            ),
          ),
        }))
        .filter(section => (section.data?.length || 0) > 0);
      setSections(allowed);
    } catch (error) {
      console.error('Search error:', error);
      setSections([]);
      Toast.show({
        type: 'error',
        text1: 'Search Error',
        text2: 'Could not search the system. Please try again.',
      });
    } finally {
      setIsSearching(false);
    }
  }, [canAccessMobileScreen]);

  const openResult = useCallback(
    (sectionTitle: string, hit: GlobalSearchHit) => {
      const screen = resolveSearchScreen(sectionTitle, hit);
      navigation.navigate(screen, {
        initialSearch: hit.title || searchQuery.trim(),
        ...(screen === 'SalesHistory' ? {dateFilter: 'alltime'} : {}),
        ...(screen === 'Purchases' ? {statusFilter: 'all'} : {}),
      });
    },
    [navigation, searchQuery],
  );

  const openBarcodeScanner = () => {
    if (!searchMode.barcodeScannerEnabled) {
      Toast.show({
        type: 'info',
        text1: 'Scanner Disabled',
        text2: 'Enable barcode scanner in Settings to use camera scan.',
      });
      return;
    }

    navigation.navigate('BarcodeScanner' as never, {
      onScan: (scannedCode: string) => {
        setSearchQuery(scannedCode);
        handleSearch(scannedCode);
      },
    } as never);
  };

  const resultCount = sections.reduce(
    (sum, section) => sum + (section.data?.length || 0),
    0,
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            Searching...
          </Text>
        </View>
      );
    }

    if (hasSearched && resultCount === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Image source={icons.search} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            No results for "{searchQuery}"
          </Text>
          <Text style={[styles.emptySubtext, {color: colors.textTertiary}]}>
            Try a customer, invoice, item, vendor, or payment
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Image source={icons.search} style={styles.emptyIcon} />
        <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
          Search the system
        </Text>
        <Text style={[styles.emptySubtext, {color: colors.textTertiary}]}>
          Items, customers, sales, purchases, vendors, and more
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header
          title="Search"
          showBack={true}
          onBackPress={() => safeGoBack(navigation, 'Home')}
          containerStyle={styles.header}
        />

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}>
          <View
            style={[
              styles.searchInputContainer,
              {backgroundColor: colors.inputBackground, borderColor: colors.border},
            ]}>
            <Image
              source={icons.search}
              style={[styles.searchIcon, {tintColor: colors.iconMuted}]}
            />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, {color: colors.textPrimary}]}
              placeholder="Search items, customers, invoices..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={text => {
                setSearchQuery(text);
                if (isRealtimeMode) {
                  if (debounceTimeoutRef.current) {
                    clearTimeout(debounceTimeoutRef.current);
                  }

                  if (text.trim()) {
                    debounceTimeoutRef.current = setTimeout(() => {
                      handleSearch(text);
                    }, 300);
                  } else {
                    setSections([]);
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
              <QuickIconPressable
                style={styles.clearButton}
                onPress={() => {
                  setSearchQuery('');
                  setSections([]);
                  setHasSearched(false);
                }}
                accessibilityLabel="Clear search">
                <Image
                  source={icons.cross}
                  style={[styles.clearIcon, {tintColor: colors.iconMuted}]}
                />
              </QuickIconPressable>
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

          {searchMode.barcodeScannerEnabled && (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={openBarcodeScanner}
              disabled={isSearching}>
              <Image source={icons.focus} style={styles.scanIcon} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.resultsContainer}>
          {resultCount > 0 ? (
            <SectionList
              sections={sections}
              keyExtractor={(item, index) =>
                `${item.pageName || item.category || 'row'}-${item.systemId || item.title}-${index}`
              }
              renderSectionHeader={({section}) => (
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: colors.textSecondary,
                      backgroundColor: colors.background,
                    },
                  ]}>
                  {section.title}
                </Text>
              )}
              renderItem={({item, section}) => (
                <TouchableOpacity
                  style={[
                    styles.resultRow,
                    {backgroundColor: colors.card, borderColor: colors.border},
                  ]}
                  onPress={() => openResult(section.title, item)}
                  activeOpacity={0.75}>
                  <View style={styles.resultTextWrap}>
                    <Text
                      style={[styles.resultTitle, {color: colors.textPrimary}]}
                      numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text
                        style={[
                          styles.resultDescription,
                          {color: colors.textSecondary},
                        ]}
                        numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.openHint, {color: COLORS.primary}]}>
                    Open
                  </Text>
                </TouchableOpacity>
              )}
              stickySectionHeadersEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            renderEmptyState()
          )}
        </View>
      </KeyboardAvoidingView>

      <AppToastHost />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SIZES.radius,
    borderWidth: 1,
    paddingHorizontal: SIZES.radius,
    marginRight: SIZES.base,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    height: 45,
    ...FONTS.body3,
  },
  clearButton: {
    padding: SIZES.base,
  },
  clearIcon: {
    width: 16,
    height: 16,
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
  scanButton: {
    marginLeft: SIZES.base,
    backgroundColor: COLORS.primary2,
    paddingHorizontal: SIZES.base + 2,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.white,
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
    paddingBottom: SIZES.padding,
  },
  sectionTitle: {
    ...FONTS.h4,
    fontWeight: '700',
    paddingTop: SIZES.base,
    paddingBottom: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SIZES.radius,
    borderWidth: 1,
    padding: SIZES.padding - 4,
    marginBottom: SIZES.base,
  },
  resultTextWrap: {
    flex: 1,
    marginRight: SIZES.base,
  },
  resultTitle: {
    ...FONTS.h4,
    marginBottom: 2,
  },
  resultDescription: {
    ...FONTS.body5,
  },
  openHint: {
    ...FONTS.body5,
    fontWeight: '600',
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
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  emptySubtext: {
    ...FONTS.body4,
    textAlign: 'center',
    opacity: 0.85,
  },
});

export default SearchPage;
