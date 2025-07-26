import React from 'react';
import {
  View,
  TextInput,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../constants';

interface SearchBarProps {
  searchQuery: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  inputRef: React.RefObject<TextInput>;
}

const SearchBar = ({
  searchQuery,
  onChangeText,
  onSubmit,
  isLoading,
  inputRef,
}: SearchBarProps) => {
  return (
    <View style={styles.container}>
      <Image source={icons.search} style={styles.searchIcon} />

      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Scan barcode..."
        placeholderTextColor={COLORS.gray}
        value={searchQuery}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        editable={!isLoading}
        returnKeyType="search"
      />

      <TouchableOpacity onPress={onSubmit} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary2} />
        ) : (
          <Text style={styles.submitText}>Submit</Text>
        )}
      </TouchableOpacity>
    </View>
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
});

export default SearchBar;
