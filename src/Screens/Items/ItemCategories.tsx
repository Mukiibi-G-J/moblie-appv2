import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { COLORS, FONTS, SIZES } from '../../constants/theme';
import icons from '../../constants/icons';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../../context/ThemeContext';
import { safeGoBack } from '../../hooks/NavigationService';
import { PAGE_NAMES } from '../../constants/pageNames';
import {
  getItemCategories,
  deleteItemCategory,
  ItemCategory,
} from '../../services/app.services';
import { QuickIconPressable } from '../../Components';
import ItemCategoryFormModal from './ItemCategoryFormModal';

const getCategoryInitials = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return 'CA';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export type ItemCategoriesRouteParams = {
  pickerMode?: boolean;
  returnScreen?: string;
  returnMode?: 'create' | 'edit';
  itemDraft?: Record<string, any> | null;
  initialSelectedCodes?: string[];
};

const ItemCategories = () => {
  const navigation = useNavigation();
  const route = useRoute < any > ();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const pickerMode = Boolean(route.params?.pickerMode);
  const returnScreen = route.params?.returnScreen || 'AllItems';
  const returnMode = route.params?.returnMode;
  const itemDraft = route.params?.itemDraft;
  const { canRead, canCreate, canEdit, canDelete } = usePermissions();
  const PAGE_NAME = PAGE_NAMES.ITEM_CATEGORIES;

  const [categories, setCategories] = useState < ItemCategory[] > ([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState < ItemCategory | null > (
    null,
  );
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState < Set < string >> (new Set());

  const listTheme = useMemo(
    () => ({
      page: { backgroundColor: colors.background },
      topHeader: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      },
      headerCircleBtn: { backgroundColor: colors.backButtonBg },
      headerCircleIcon: { tintColor: colors.textPrimary },
      headerTitle: { color: colors.textPrimary },
      createRow: { backgroundColor: colors.surface },
      createRowPlus: { tintColor: colors.textPrimary },
      createRowLabel: { color: colors.textPrimary },
      rowDivider: { backgroundColor: colors.border },
      row: { backgroundColor: colors.surface },
      thumb: { backgroundColor: colors.screenMuted },
      thumbText: { color: colors.textSecondary },
      rowTitle: { color: colors.textPrimary },
      rowSubtitle: { color: colors.textSecondary },
      deleteIcon: { tintColor: colors.iconMuted },
      emptyIconContainer: { backgroundColor: colors.screenMuted },
      emptyIconImage: { tintColor: colors.textSecondary },
      emptyText: { color: colors.textPrimary },
      emptySubtext: { color: colors.textSecondary },
      loadingText: { color: colors.textSecondary },
      accessDeniedMessage: { color: colors.textSecondary },
      footerPill: { backgroundColor: colors.backButtonBg },
      footerPillText: { color: colors.textSecondary },
      spinner: colors.primary,
    }),
    [colors],
  );

  const subcategoryCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of categories) {
      const p = c.parent_id;
      if (p) {
        map[p] = (map[p] || 0) + 1;
      }
    }
    return map;
  }, [categories]);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getItemCategories({});
      setCategories(data);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      setCategories([]);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.detail || 'Failed to load categories',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!pickerMode) {
      return;
    }
    const initial = route.params?.initialSelectedCodes;
    if (Array.isArray(initial) && initial.length > 0) {
      setSelectedCodes(new Set(initial.filter(Boolean)));
    } else {
      setSelectedCodes(new Set());
    }
  }, [pickerMode, route.params?.initialSelectedCodes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCategories();
  }, [loadCategories]);

  const handleCreate = () => {
    setSelectedCategory(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (category: ItemCategory) => {
    setSelectedCategory(category);
    setIsFormModalVisible(true);
  };

  const handleDelete = async (category: ItemCategory) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete category "${category.code}"?${category.description ? `\n(${category.description})` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItemCategory(category.code);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Category deleted successfully',
              });
              setSelectedCodes(prev => {
                const next = new Set(prev);
                next.delete(category.code);
                return next;
              });
              loadCategories();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail ||
                  error?.response?.data?.code?.[0] ||
                  'Failed to delete category',
              });
            }
          },
        },
      ],
    );
  };

  const handleFormSave = () => {
    setIsFormModalVisible(false);
    setSelectedCategory(null);
    loadCategories();
  };

  const toggleSelected = (code: string) => {
    setSelectedCodes(prev => {
      if (pickerMode) {
        if (prev.has(code)) {
          return new Set();
        }
        return new Set([code]);
      }
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const returnToItemFlow = (code?: string | null) => {
    if (!pickerMode) {
      safeGoBack(navigation, 'Items');
      return;
    }

    (navigation as any).navigate({
      name: returnScreen,
      params: {
        reopenItemModal: returnMode,
        itemDraft,
        ...(code !== undefined ? { categoryPick: { code } } : {}),
      },
      merge: true,
    });
  };

  const handleHeaderClose = () => {
    returnToItemFlow(undefined);
  };

  const handleHeaderDone = () => {
    if (pickerMode) {
      const codes = Array.from(selectedCodes);
      const code = codes.length > 0 ? codes[0] : null;
      returnToItemFlow(code);
      return;
    }
    safeGoBack(navigation, 'Items');
  };

  const displayName = (item: ItemCategory) =>
    (item.description && item.description.trim()) || item.code;

  const renderCategoryItem = ({ item }: { item: ItemCategory }) => {
    const name = displayName(item);
    const initials = getCategoryInitials(name);
    const subs = subcategoryCount[item.code] ?? 0;
    const subLabel =
      subs === 1 ? '1 subcategory' : `${subs} subcategories`;
    const checked = selectedCodes.has(item.code);
    const indent = (item.level || 0) * 10;

    return (
      <View>
        <View style={[styles.row, listTheme.row, { paddingLeft: SIZES.padding + indent }]}>
          <TouchableOpacity
            style={styles.checkboxHit}
            onPress={() => toggleSelected(item.code)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}>
            <Image
              source={checked ? icons.check_on : icons.check_off}
              style={styles.checkboxImg}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowMain}
            onPress={() =>
              pickerMode ? toggleSelected(item.code) : handleEdit(item)
            }
            activeOpacity={0.65}>
            <View style={[styles.thumb, listTheme.thumb]}>
              <Text style={[styles.thumbText, listTheme.thumbText]}>{initials}</Text>
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, listTheme.rowTitle]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.rowSubtitle, listTheme.rowSubtitle]}>{subLabel}</Text>
            </View>
          </TouchableOpacity>

          {!pickerMode ? (
            <View style={styles.rowActions}>
              {canEdit(PAGE_NAME) ? (
                <TouchableOpacity
                  onPress={() => handleEdit(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              {canDelete(PAGE_NAME) ? (
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}>
                  <Image
                    source={icons.delete_icon}
                    style={[styles.deleteIcon, listTheme.deleteIcon]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.rowActionsSpacer} />
          )}
        </View>
        <View style={[styles.rowDivider, listTheme.rowDivider]} />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, listTheme.emptyIconContainer]}>
        <Image
          source={icons.product}
          style={[styles.emptyIconImage, listTheme.emptyIconImage]}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.emptyText, listTheme.emptyText]}>No categories found</Text>
      <Text style={[styles.emptySubtext, listTheme.emptySubtext]}>
        {canCreate(PAGE_NAME)
          ? 'Create your first category to get started.'
          : 'No categories available.'}
      </Text>
      {canCreate(PAGE_NAME) ? (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create category</Text>
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
            You don't have permission to view item categories.
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
          {
            paddingTop: Math.max(insets.top + 8, 18),
          },
        ]}>
        <QuickIconPressable
          style={[styles.headerCircleBtn, listTheme.headerCircleBtn]}
          onPress={handleHeaderClose}
          accessibilityLabel="Close">
          <Image
            source={icons.cross}
            style={[styles.headerCircleIcon, listTheme.headerCircleIcon]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.headerTitle, listTheme.headerTitle]}>Categories</Text>
        <TouchableOpacity
          style={styles.donePill}
          onPress={handleHeaderDone}
          activeOpacity={0.7}>
          <Text style={styles.donePillText}>Done</Text>
        </TouchableOpacity>
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
            <Text style={[styles.createRowLabel, listTheme.createRowLabel]}>Create category</Text>
          </TouchableOpacity>
          <View style={[styles.rowDivider, listTheme.rowDivider]} />
        </>
      ) : null}

      {loading && categories.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={listTheme.spinner} />
          <Text style={[styles.loadingText, listTheme.loadingText]}>Loading categories…</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={categories}
          keyExtractor={item => item.code}
          renderItem={renderCategoryItem}
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
            categories.length === 0
              ? styles.emptyListContainer
              : styles.listContentContainer
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <View
        style={[
          styles.footerPill,
          listTheme.footerPill,
          { bottom: Math.max(insets.bottom, 12) + 8 },
        ]}
        pointerEvents="none">
        <Text style={[styles.footerPillText, listTheme.footerPillText]}>
          Categories selected: {selectedCodes.size}
        </Text>
      </View>

      <ItemCategoryFormModal
        visible={isFormModalVisible}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedCategory(null);
        }}
        category={selectedCategory}
        onSave={handleFormSave}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        categories={categories}
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
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.white,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCircleIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.black,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.2,
  },
  donePill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    minWidth: 72,
    alignItems: 'center',
  },
  donePillText: {
    ...FONTS.body4,
    fontWeight: '600',
    color: COLORS.white,
    fontSize: 15,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  createRowPlus: {
    width: 22,
    height: 22,
    tintColor: COLORS.black,
    marginRight: 12,
  },
  createRowLabel: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.lightGray1,
    marginLeft: SIZES.padding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: SIZES.padding,
    backgroundColor: COLORS.white,
    minHeight: 64,
  },
  checkboxHit: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxImg: {
    width: 22,
    height: 22,
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
    borderRadius: 8,
    backgroundColor: '#ECECEC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbText: {
    ...FONTS.body4,
    fontWeight: '700',
    color: COLORS.gray2,
    fontSize: 13,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  rowSubtitle: {
    ...FONTS.body4,
    fontSize: 13,
    color: COLORS.gray2,
    marginTop: 4,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowActionsSpacer: {
    width: 8,
  },
  editLink: {
    ...FONTS.body4,
    fontWeight: '600',
    color: COLORS.primary2,
    fontSize: 14,
  },
  deleteIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray3,
  },
  list: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  footerPill: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#E8EAED',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
  },
  footerPillText: {
    ...FONTS.body4,
    fontWeight: '600',
    color: COLORS.gray2,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SIZES.base,
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  emptyIconContainer: {
    marginBottom: SIZES.base * 1.5,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIconImage: {
    width: 32,
    height: 32,
    tintColor: COLORS.gray2,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base * 0.5,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body4,
    color: COLORS.gray2,
    textAlign: 'center',
    marginBottom: SIZES.base * 1.5,
  },
  emptyButton: {
    backgroundColor: COLORS.primary2,
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.25,
    borderRadius: 999,
  },
  emptyButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
  },
});

export default ItemCategories;
