import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants'; // Adjust the import path as needed

// Expanded list of country codes with flags (emoji)
const countryCodes = [
  { code: '+256', country: 'Uganda', flag: '🇺🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  // Add more country codes as needed
];

interface CustomPhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  containerStyle?: any;
  textInputStyle?: any;
  onValidationChange: (isValid: boolean) => void;
}

const CustomPhoneInput = forwardRef((props: CustomPhoneInputProps, ref) => {
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState(countryCodes);

  useEffect(() => {
    if (searchQuery) {
      const filtered = countryCodes.filter(
        country => 
          country.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
          country.code.includes(searchQuery)
      );
      setFilteredCountries(filtered);
    } else {
      setFilteredCountries(countryCodes);
    }
  }, [searchQuery]);

  useEffect(() => {
    const isValid = props.value.length >= 9;
    props.onValidationChange(isValid);
  }, [props.value]);

  useImperativeHandle(ref, () => ({
    isValidNumber: () => props.value.length >= 9,
  }));

  const handleChangeText = (text: string) => {
    // Remove any non-digit characters
    const numericText = text.replace(/[^\d]/g, '');
    props.onChangeText(numericText);
  };

  const renderCountryCode = ({ item }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item);
        setModalVisible(false);
      }}
    >
      <Text style={styles.flagText}>{item.flag}</Text>
      <Text style={styles.countryItemText}>{item.country} ({item.code})</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, props.containerStyle]}>
      <TouchableOpacity 
        style={styles.countryCodeContainer}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.flagText}>{selectedCountry.flag}</Text>
        <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
      </TouchableOpacity>
      <TextInput
        style={[styles.input, props.textInputStyle]}
        value={props.value}
        onChangeText={handleChangeText}
        keyboardType="phone-pad"
        placeholder="Enter phone number"
        placeholderTextColor={COLORS.gray}
      />
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Country Code</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search country or code"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              data={filteredCountries}
              renderItem={renderCountryCode}
              keyExtractor={(item) => item.code}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SIZES.height > 800 ? 55 : 45,
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    height: '100%',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.gray,
  },
  flagText: {
    fontSize: 20,
    marginRight: 5,
  },
  countryCodeText: {
    ...FONTS.body3,
    color: COLORS.black,
  },
  input: {
    flex: 1,
    height: '100%',
    ...FONTS.body3,
    color: COLORS.black,
    paddingHorizontal: SIZES.padding,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    width: '80%',
    maxHeight: '80%',
  },
  modalTitle: {
    ...FONTS.h2,
    marginBottom: SIZES.padding,
    textAlign: 'center',
  },
  searchInput: {
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    marginBottom: SIZES.padding,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  countryItemText: {
    ...FONTS.body3,
    color: COLORS.black,
    marginLeft: SIZES.base,
  },
  closeButton: {
    marginTop: SIZES.padding,
    alignItems: 'center',
  },
  closeButtonText: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
});

export default CustomPhoneInput;
