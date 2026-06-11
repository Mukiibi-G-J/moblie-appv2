import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import {usePermissions} from '../../hooks/usePermissions';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {PAGE_NAMES} from '../../constants/pageNames';
import {
  deleteUnitOfMeasure,
  fetchUnitsOfMeasure,
  UnitOfMeasure,
} from '../../services/app.services';
import {QuickIconPressable} from '../../Components';
import UnitOfMeasureFormModal from './UnitOfMeasureFormModal';

const UnitsOfMeasure = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.ITEMS;

  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasure | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);

  const listTheme = useMemo(
    () => ({
      page: {backgroundColor: colors.background},
      topHeader: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      },
      headerCircleBtn: {backgroundColor: colors.backButtonBg},
      headerCircleIcon: {tintColor: colors.textPrimary},
      headerTitle: {color: colors.textPrimary},
      createRow: {backgroundColor: colors.surface},
      createRowPlus: {tintColor: colors.textPrimary},
      createRowLabel: {color: colors.textPrimary},
      rowDivider: {backgroundColor: colors.border},
      row: {backgroundColor: colors.surface},
      thumb: {backgroundColor: colors.screenMuted},
      thumbText: {color: colors.textSecondary},
      rowTitle: {color: colors.textPrimary},
      rowSubtitle: {color: colors.textSecondary},
      deleteIcon: {tintColor: colors.iconMuted},
      emptyIconContainer: {backgroundColor: colors.screenMuted},
      emptyIconImage: {tintColor: colors.textSecondary},
      emptyText: {color: colors.textPrimary},
      emptySubtext: {color: colors.textSecondary},
      loadingText: {color: colors.textSecondary},
      accessDeniedMessage: {color: colors.textSecondary},
      searchWrap: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      },
      searchInput: {
        backgroundColor: colors.inputBackground,
        color: colors.textPrimary,
        borderColor: colors.border,
      },
      searchIcon: {tintColor: colors.iconMuted},
      spinner: COLORS.primary,
    }),
    [colors],
  );

  const loadUnits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchUnitsOfMeasure();
      setUnits(data);
    } catch (error: any) {
      console.error('Error loading units:', error);
      setUnits([]);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.detail || 'Failed to load units',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUnits();
  }, [loadUnits]);

  const filteredUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return units;
    }
    return units.filter(
      u =>
        u.code.toLowerCase().includes(q) ||
        (u.description || '').toLowerCase().includes(q),
    );
  }, [units, searchQuery]);

  const handleCreate = () => {
    setSelectedUnit(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (unit: UnitOfMeasure) => {
    setSelectedUnit(unit);
    setIsFormModalVisible(true);
  };

  const handleDelete = (unit: UnitOfMeasure) => {
    Alert.alert(
      'Delete unit',
      `Delete "${unit.code}"${unit.description ? ` (${unit.description})` : ''}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUnitOfMeasure(unit.code);
              Toast.show({
                type: 'success',
                text1: 'Unit deleted',
              });
              loadUnits();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Delete failed',
                text2:
                  error?.response?.data?.detail ||
                  error?.response?.data?.error ||
                  'This unit may be in use on items.',
              });
            }
          },
        },
      ],
    );
  };

  const renderUnitItem = ({item}: {item: UnitOfMeasure}) => (
    <View>
      <View style={[styles.row, listTheme.row]}>
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => handleEdit(item)}
          activeOpacity={0.65}>
          <View style={[styles.thumb, listTheme.thumb]}>
            <Text style={[styles.thumbText, listTheme.thumbText]}>
              {item.code.slice(0, 2)}
            </Text>
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, listTheme.rowTitle]} numberOfLines={1}>
              {item.code}
            </Text>
            <Text style={[styles.rowSubtitle, listTheme.rowSubtitle]} numberOfLines={1}>
              {item.description || 'No description'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rowActions}>
          {canEdit(PAGE_NAME) ? (
            <TouchableOpacity
              onPress={() => handleEdit(item)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              activeOpacity={0.7}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {canDelete(PAGE_NAME) ? (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              activeOpacity={0.7}>
              <Image
                source={icons.delete_icon}
                style={[styles.deleteIcon, listTheme.deleteIcon]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={[styles.rowDivider, listTheme.rowDivider]} />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, listTheme.emptyIconContainer]}>
        <Image
          source={icons.product}
          style={[styles.emptyIconImage, listTheme.emptyIconImage]}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.emptyText, listTheme.emptyText]}>No units found</Text>
      <Text style={[styles.emptySubtext, listTheme.emptySubtext]}>
        {canCreate(PAGE_NAME)
          ? 'Create units like PCS or BOX to use on items.'
          : 'No units available.'}
      </Text>
      {canCreate(PAGE_NAME) ? (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create unit</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={[styles.container, listTheme.page]}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={[styles.accessDeniedMessage, listTheme.accessDeniedMessage]}>
            You don't have permission to view units of measure.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, listTheme.page]}>
      <View
        style={[
          styles.topHeader,
          listTheme.topHeader,
          {paddingTop: Math.max(insets.top + 8, 18)},
        ]}>
        <QuickIconPressable
          style={[styles.headerCircleBtn, listTheme.headerCircleBtn]}
          onPress={() => safeGoBack(navigation, 'Items')}
          accessibilityLabel="Close">
          <Image
            source={icons.cross}
            style={[styles.headerCircleIcon, listTheme.headerCircleIcon]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.headerTitle, listTheme.headerTitle]}>Units</Text>
        <TouchableOpacity
          style={styles.donePill}
          onPress={() => safeGoBack(navigation, 'Items')}
          activeOpacity={0.7}>
          <Text style={styles.donePillText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchWrap, listTheme.searchWrap]}>
        <View style={[styles.searchInputWrap, listTheme.searchInput]}>
          <Image
            source={icons.search}
            style={[styles.searchIcon, listTheme.searchIcon]}
            resizeMode="contain"
          />
          <TextInput
            style={[styles.searchInput, {color: colors.textPrimary}]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search units…"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {canCreate(PAGE_NAME) ? (
        <>
          <TouchableOpacity
            style={[styles.createRow, listTheme.createRow]}
            onPress={handleCreate}
            activeOpacity={0.65}>
            <Image
              source={icons.plus}
              style={[styles.createRowPlus, listTheme.createRowPlus]}
              resizeMode="contain"
            />
            <Text style={[styles.createRowLabel, listTheme.createRowLabel]}>
              Create unit
            </Text>
          </TouchableOpacity>
          <View style={[styles.rowDivider, listTheme.rowDivider]} />
        </>
      ) : null}

      {loading && units.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={listTheme.spinner} />
          <Text style={[styles.loadingText, listTheme.loadingText]}>
            Loading units…
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredUnits}
          keyExtractor={item => item.code}
          renderItem={renderUnitItem}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[listTheme.spinner]}
              tintColor={listTheme.spinner}
            />
          }
          contentContainerStyle={
            filteredUnits.length === 0
              ? styles.emptyListContainer
              : styles.listContentContainer
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <UnitOfMeasureFormModal
        visible={isFormModalVisible}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedUnit(null);
        }}
        unit={selectedUnit}
        onSave={loadUnits}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCircleIcon: {
    width: 14,
    height: 14,
  },
  headerTitle: {
    ...FONTS.h3,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  donePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.transparentPrimary,
  },
  donePillText: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  searchWrap: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body4,
    paddingVertical: 10,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: SIZES.padding,
    gap: 12,
  },
  createRowPlus: {
    width: 18,
    height: 18,
  },
  createRowLabel: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SIZES.padding,
  },
  list: {flex: 1},
  listContentContainer: {
    paddingBottom: 24,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SIZES.padding,
    minHeight: 72,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbText: {
    ...FONTS.body4,
    fontWeight: '700',
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  rowSubtitle: {
    ...FONTS.body5,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 8,
  },
  editLink: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  deleteIcon: {
    width: 20,
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...FONTS.body4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconImage: {
    width: 32,
    height: 32,
  },
  emptyText: {
    ...FONTS.h3,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body4,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: COLORS.primary2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    marginBottom: 8,
  },
  accessDeniedMessage: {
    ...FONTS.body4,
    textAlign: 'center',
  },
});

export default UnitsOfMeasure;
