import React, {useMemo, useState} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {COLORS, FONTS, SIZES} from '../constants';
import type {CurrencyOption} from '../utils/currency';

type Props = {
  visible: boolean;
  options: CurrencyOption[];
  loading?: boolean;
  selectedCode?: string;
  onClose: () => void;
  onSelect: (code: string) => void;
  colors: {
    background: string;
    card: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
  };
};

export const CurrencyPickerModal: React.FC<Props> = ({
  visible,
  options,
  loading,
  selectedCode,
  onClose,
  onSelect,
  colors,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(
      opt =>
        opt.value.toLowerCase().includes(q) ||
        opt.label.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, {backgroundColor: colors.background}]}>
        <View style={[styles.header, {borderBottomColor: colors.border}]}>
          <Text style={[styles.title, {color: colors.textPrimary}]}>
            Local currency
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.close, {color: COLORS.primary}]}>Done</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[
            styles.search,
            {
              color: colors.textPrimary,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search currency code or name"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator
            style={styles.loader}
            size="large"
            color={COLORS.primary}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({item}) => {
              const selected = item.value === selectedCode;
              return (
                <TouchableOpacity
                  style={[
                    styles.row,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: selected
                        ? `${COLORS.primary}14`
                        : colors.card,
                    },
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}>
                  <Text style={[styles.rowText, {color: colors.textPrimary}]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, paddingTop: SIZES.padding},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {...FONTS.h3, fontSize: 18, fontWeight: '700'},
  close: {...FONTS.body4, fontWeight: '600'},
  search: {
    margin: SIZES.padding,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...FONTS.body4,
  },
  loader: {marginTop: 40},
  row: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {...FONTS.body4},
});
