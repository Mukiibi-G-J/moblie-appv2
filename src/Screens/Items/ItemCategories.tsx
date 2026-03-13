import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {
  getItemCategories,
  createItemCategory,
  updateItemCategory,
  deleteItemCategory,
  ItemCategory,
} from '../../services/app.services';
import ItemCategoryFormModal from './ItemCategoryFormModal';
import Header from '../../Components/Header';

const ItemCategories = () => {
  const navigation = useNavigation();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.ITEM_CATEGORIES;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view item categories.
          </Text>
        </View>
      </View>
    );
  }

  // State management
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(
    null,
  );
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const data = await getItemCategories(params);
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
      setSearchLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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
      `Are you sure you want to delete category "${category.code}"?${
        category.description ? `\n(${category.description})` : ''
      }`,
      [
        {text: 'Cancel', style: 'cancel'},
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

  const renderCategoryItem = ({item}: {item: ItemCategory}) => {
    const indentLevel = item.level || 0;
    const indentWidth = indentLevel * 12;

    return (
      <View style={styles.categoryItem}>
        <View style={styles.categoryContent}>
          <View style={[styles.indentSpace, {width: indentWidth}]} />
          <View style={styles.iconWrapper}>
            <Image
              source={icons.product}
              style={styles.categoryIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryCode} numberOfLines={1}>
              {item.code}
            </Text>
            {item.description && item.description !== item.code && (
              <Text style={styles.categoryDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
            {item.parent_id && (
              <Text style={styles.categoryParent} numberOfLines={1}>
                Parent: {item.parent_id}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.categoryActions}>
          {canEdit(PAGE_NAME) && (
            <TouchableOpacity
              style={[styles.actionChip, styles.editChip]}
              onPress={() => handleEdit(item)}
              activeOpacity={0.7}>
              <Text style={styles.actionChipText}>Edit</Text>
            </TouchableOpacity>
          )}
          {canDelete(PAGE_NAME) && (
            <TouchableOpacity
              style={[styles.actionChip, styles.deleteChip]}
              onPress={() => handleDelete(item)}
              activeOpacity={0.7}>
              <Text style={styles.actionChipText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Image
          source={icons.product}
          style={styles.emptyIconImage}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.emptyText}>No categories found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery.trim()
          ? 'Try adjusting your search query.'
          : canCreate(PAGE_NAME)
          ? 'Create your first category to get started.'
          : 'No categories available.'}
      </Text>
      {canCreate(PAGE_NAME) && !searchQuery.trim() && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create Category</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setSearchLoading(true);
    // Debounce search
    setTimeout(() => {
      setSearchLoading(false);
    }, 500);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        title="Item Categories"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <View style={styles.searchIconContainer}>
            <Image
              source={icons.search}
              style={styles.searchIcon}
              resizeMode="contain"
            />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor={COLORS.gray3}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading && (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          )}
        </View>
      </View>

      {loading && categories.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
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
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
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

      {canCreate(PAGE_NAME) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreate}
          activeOpacity={0.8}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Form Modal */}
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
    backgroundColor: COLORS.lightGray2,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  accessDeniedTitle: {
    fontSize: SIZES.h2,
    fontFamily: FONTS.bold,
    color: COLORS.error,
    marginBottom: SIZES.base,
  },
  accessDeniedMessage: {
    fontSize: SIZES.body3,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.5,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.5,
    height: 44,
  },
  searchIconContainer: {
    marginRight: SIZES.base * 0.75,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.gray2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.black,
    paddingVertical: 0,
  },
  searchLoadingContainer: {
    marginLeft: SIZES.base * 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SIZES.base,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  list: {
    flex: 1,
  },
  listContentContainer: {
    paddingVertical: SIZES.base,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  categoryItem: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.base * 2,
    marginVertical: SIZES.base * 0.5,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indentSpace: {
    // Used for hierarchical indentation
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base * 0.75,
  },
  categoryIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryCode: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.black,
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.gray2,
    marginBottom: 1,
  },
  categoryParent: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.gray3,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: SIZES.base * 0.5,
  },
  actionChip: {
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 0.5,
    borderRadius: SIZES.radius,
    minWidth: 55,
    alignItems: 'center',
  },
  editChip: {
    backgroundColor: COLORS.primary2 + '15',
  },
  deleteChip: {
    backgroundColor: COLORS.error + '15',
  },
  actionChipText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    fontWeight: '600',
    color: COLORS.black,
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
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.black,
    marginBottom: SIZES.base * 0.5,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.gray2,
    textAlign: 'center',
    marginBottom: SIZES.base * 1.5,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 0.75,
    borderRadius: SIZES.radius,
  },
  emptyButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
  fab: {
    position: 'absolute',
    right: SIZES.base * 2,
    bottom: SIZES.base * 2,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: COLORS.white,
    lineHeight: 28,
  },
});

export default ItemCategories;
