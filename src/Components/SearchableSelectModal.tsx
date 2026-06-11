import React, {useMemo, useState, useEffect} from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import {COLORS} from '../constants/theme';
import icons from '../constants/icons';
import {useTheme} from '../context/ThemeContext';

export type SearchableSelectOption = {
  id: number | string;
  label: string;
  subtitle?: string;
};

type SearchableSelectModalProps = {
  visible: boolean;
  title: string;
  options: SearchableSelectOption[];
  selectedId?: number | string | null;
  onSelect: (id: number | string | null) => void;
  onClose: () => void;
  searchPlaceholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
};

export function SearchableSelectModal({
  visible,
  title,
  options,
  selectedId = null,
  onSelect,
  onClose,
  searchPlaceholder = 'Search…',
  allowClear = false,
  clearLabel = 'Clear selection',
}: SearchableSelectModalProps) {
  const {colors} = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
    }
  }, [visible]);

  const theme = useMemo(
    () => ({
      content: {backgroundColor: colors.surface},
      header: {borderBottomColor: colors.border},
      title: {color: colors.textPrimary},
      searchContainer: {borderBottomColor: colors.border},
      searchInputContainer: {backgroundColor: colors.inputBackground},
      searchIcon: {tintColor: colors.iconMuted},
      searchInput: {color: colors.textPrimary},
      item: {borderBottomColor: colors.border},
      itemSelected: {backgroundColor: colors.screenMuted},
      itemText: {color: colors.textPrimary},
      itemSubtitle: {color: colors.textSecondary},
      emptyText: {color: colors.textSecondary},
      closeIcon: {tintColor: colors.textPrimary},
    }),
    [colors],
  );

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(option => {
      const label = option.label.toLowerCase();
      const subtitle = option.subtitle?.toLowerCase() ?? '';
      return label.includes(q) || subtitle.includes(q);
    });
  }, [options, searchQuery]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const handleSelect = (id: number | string | null) => {
    onSelect(id);
    setSearchQuery('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, theme.content]}>
          <View style={[styles.header, theme.header]}>
            <Text style={[styles.title, theme.title]}>{title}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <Image
                source={icons.cross}
                style={[styles.closeIcon, theme.closeIcon]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, theme.searchContainer]}>
            <View
              style={[
                styles.searchInputContainer,
                theme.searchInputContainer,
              ]}>
              <Image
                source={icons.search}
                style={[styles.searchIcon, theme.searchIcon]}
                resizeMode="contain"
              />
              <TextInput
                style={[styles.searchInput, theme.searchInput]}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>

          <FlatList
            data={filteredOptions}
            keyExtractor={item => String(item.id)}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allowClear ? (
                <TouchableOpacity
                  style={[styles.item, theme.item]}
                  onPress={() => handleSelect(null)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.itemText,
                      theme.itemText,
                      selectedId == null && styles.itemTextSelected,
                    ]}>
                    {clearLabel}
                  </Text>
                  {selectedId == null ? (
                    <Image
                      source={icons.correct}
                      style={styles.checkIcon}
                      resizeMode="contain"
                    />
                  ) : null}
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, theme.emptyText]}>
                  No matches found
                </Text>
              </View>
            }
            renderItem={({item}) => {
              const isSelected = selectedId === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.item,
                    theme.item,
                    isSelected && theme.itemSelected,
                  ]}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}>
                  <View style={styles.itemTextWrap}>
                    <Text
                      style={[
                        styles.itemText,
                        theme.itemText,
                        isSelected && styles.itemTextSelected,
                      ]}>
                      {item.label}
                    </Text>
                    {item.subtitle ? (
                      <Text style={[styles.itemSubtitle, theme.itemSubtitle]}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Image
                      source={icons.correct}
                      style={styles.checkIcon}
                      resizeMode="contain"
                    />
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    flex: 1,
    paddingRight: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary3,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.transparentPrimary,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.gray2,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.black,
    paddingVertical: 0,
  },
  list: {
    maxHeight: 400,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  itemText: {
    fontSize: 15,
    color: COLORS.black,
  },
  itemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  itemTextSelected: {
    fontWeight: '600',
    color: COLORS.primary2,
  },
  checkIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary2,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray2,
  },
});
