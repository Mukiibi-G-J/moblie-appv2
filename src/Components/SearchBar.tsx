import React, {useEffect, useRef} from 'react';
import {
  View,
  TextInput,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../constants';
import {useSearchMode} from '../context/SearchModeStore';

interface SearchBarProps {
  searchQuery: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onRealtimeSearch?: (query: string) => void; // New prop for real-time search
  isLoading: boolean;
  isSearching?: boolean; // New prop for real-time search loading
  inputRef: React.RefObject<TextInput>;
  onPress?: () => void; // New prop for navigation to search page
  onFocus?: () => void; // New prop for handling focus
  onScanPress?: () => void;
  showScanButton?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const SearchBar = ({
  searchQuery,
  onChangeText,
  onSubmit,
  onRealtimeSearch,
  isLoading,
  isSearching = false,
  inputRef,
  onPress,
  onFocus,
  onScanPress,
  showScanButton = false,
  containerStyle,
}: SearchBarProps) => {
  const {state} = useSearchMode();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle text change with debouncing for real-time search
  const handleTextChange = (text: string) => {
    onChangeText(text);

    if (state.searchMode === 'realtime' && onRealtimeSearch) {
      // Clear previous timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set new timeout for debounced search
      debounceTimeoutRef.current = setTimeout(() => {
        if (text.trim().length > 0) {
          onRealtimeSearch(text);
        }
      }, 500); // 500ms debounce
    }

    // Ensure focus stays on input after text change
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const isRealtimeMode = state.searchMode === 'realtime';
  const placeholder = isRealtimeMode ? 'Search items...' : 'Scan barcode...';

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Image source={icons.search} style={styles.searchIcon} />

      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray}
        value={searchQuery}
        onChangeText={handleTextChange}
        onSubmitEditing={isRealtimeMode ? undefined : onSubmit}
        editable={!isLoading && !isSearching}
        returnKeyType={isRealtimeMode ? 'done' : 'search'}
        pointerEvents={onPress ? 'none' : 'auto'} // Disable text input if onPress is provided
        onFocus={onFocus} // Handle focus event
      />

      {/* Show submit button only in barcode mode */}
      {!isRealtimeMode && !onPress && (
        <TouchableOpacity onPress={onSubmit} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary2} />
          ) : (
            <Text style={styles.submitText}>Submit</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Show search indicator in real-time mode */}
      {isRealtimeMode && isSearching && !onPress && (
        <ActivityIndicator size="small" color={COLORS.primary2} />
      )}

      {/* Show navigation arrow if onPress is provided */}
      {onPress && (
        <Image source={icons.down_arrow} style={styles.navigationIcon} />
      )}

      {showScanButton && (
        <TouchableOpacity
          onPress={event => {
            event.stopPropagation();
            onScanPress?.();
          }}
          style={styles.scanButton}>
          <Image source={icons.focus} style={styles.scanIcon} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'center',
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.base,
    paddingHorizontal: SIZES.radius,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    height: 20,
    width: 20,
    tintColor: COLORS.black,
  },
  input: {
    flex: 1,
    marginLeft: SIZES.radius,
    color: COLORS.black,
    ...FONTS.body3,
  },
  submitText: {
    color: COLORS.primary2,
    ...FONTS.h3,
    paddingHorizontal: SIZES.base,
  },
  navigationIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray,
  },
  scanButton: {
    marginLeft: SIZES.base,
    padding: 4,
  },
  scanIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.primary2,
  },
});

export default SearchBar;
