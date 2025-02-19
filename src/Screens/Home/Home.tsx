import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {FONTS, SIZES, COLORS, icons, dummyData} from '../../constants';
import Options from './Options';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScrollView} from 'react-native-gesture-handler';

const Section = ({title, onPress, children}) => {
  return (
    <View>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: SIZES.padding,
          marginTop: 30,
          marginBottom: 20,
        }}>
        <Text style={{flex: 1, ...FONTS.h3}}>{title}</Text>

        <TouchableOpacity onPress={onPress}>
          <Text style={{color: COLORS.primary, ...FONTS.body3}}>Show All</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {children}
    </View>
  );
};

export default function Home({selectedTab}) {
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(1);
  const [selectedMenuType, setSelectedMenuType] = React.useState(1);
  const [popular, setPopular] = React.useState([]);
  const [recommends, setRecommends] = React.useState([]);
  const [menuList, setMenuList] = React.useState([]);

  const [showFilterModal, setShowFilterModal] = React.useState(false);

  const navigation = useNavigation();

  React.useEffect(() => {
    handleChangeCategory(selectedCategoryId, selectedMenuType);
  }, []);

  React.useEffect(() => {
    if (selectedTab == 'Home') {
    }
  }, [selectedTab]);

  // Handler

  function handleChangeCategory(categoryId, menuTypeId) {
    // Retrieve the popular menu
    let selectedPopular = dummyData.menu.find(a => a.name == 'Popular');

    // Retrieve the recommended menu
    let selectedRecommend = dummyData.menu.find(a => a.name == 'Recommended');

    // Find the menu based on the menuTypeId
    let selectedMenu = dummyData.menu.find(a => a.id == menuTypeId);

    // Set the popular menu based on the categoryId
    setPopular(
      selectedPopular?.list.filter(a => a.categories.includes(categoryId)),
    );

    // Set the recommended menu based on the categoryId
    setRecommends(
      selectedRecommend?.list.filter(a => a.categories.includes(categoryId)),
    );

    // Set the menu based on the categoryId
    setMenuList(
      selectedMenu?.list.filter(a => a.categories.includes(categoryId)),
    );
  }

  // Render

  function renderSearch() {
    return (
      <View
        style={{
          flexDirection: 'row',
          height: 40,
          alignItems: 'center',
          marginHorizontal: SIZES.padding,
          marginVertical: SIZES.base,
          paddingHorizontal: SIZES.radius,
          borderRadius: SIZES.radius,
          backgroundColor: COLORS.lightGray2,
        }}>
        {/* Icon */}
        <Image
          source={icons.search}
          style={{
            height: 20,
            width: 20,
            tintColor: COLORS.black,
          }}
        />

        {/* Text Input */}
        <TextInput
          style={{
            flex: 1,
            marginLeft: SIZES.radius,
            ...FONTS.body3,
          }}
          placeholder="search food..."
        />

        {/* Filter Button */}
        <TouchableOpacity onPress={() => setShowFilterModal(true)}>
          <Image
            source={icons.filter}
            style={{
              height: 20,
              width: 20,
              tintColor: COLORS.black,
            }}
          />
        </TouchableOpacity>
      </View>
    );
  }

  function renderMenuTypes() {
    return (
      <FlatList
        horizontal
        data={dummyData.menu}
        keyExtractor={item => `${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          marginTop: 30,
          marginBottom: 20,
        }}
        renderItem={({item, index}) => (
          <TouchableOpacity
            style={{
              marginLeft: SIZES.padding,
              marginRight:
                index == dummyData.menu.length - 1 ? SIZES.padding : 0,
            }}
            onPress={() => {
              setSelectedMenuType(item.id);
              handleChangeCategory(selectedCategoryId, item.id);
            }}>
            <Text
              style={{
                color:
                  selectedMenuType == item.id ? COLORS.primary : COLORS.black,
                ...FONTS.h3,
              }}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    );
  }
  const renderHeader = () => {
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return (
      <View style={styles.headerSection}>
        <View style={styles.headerCard}>
          <View style={styles.headerMain}>
            {/* Left side - Welcome message */}
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.nameText}>Daurice</Text>
              <View style={styles.roleContainer}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>Store Manager</Text>
                </View>
              </View>
            </View>

            {/* Right side - Quick Info */}
            <View style={styles.quickInfo}>
              <Text style={styles.timeText}>{currentTime}</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Store Open</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderQuickStats = () => {
    const todaySales = 1234000;
    const salesChange = +15.8;
    const totalProducts = 156;
    const productsSold = 45; // Number of products sold today
    const lowStockCount = 12;

    return (
      <View style={styles.statsSection}>
        {/* Main Sales Card - Make it prominent */}
        <View style={styles.mainStatsCard}>
          <View style={styles.salesHeader}>
            <View>
              <Text style={styles.salesLabel}>Today's Revenue</Text>
              <Text style={styles.salesAmount}>
                {formatCurrency(todaySales)}
              </Text>
            </View>
            <View
              style={[
                styles.trendBadge,
                salesChange >= 0 ? styles.positiveTrend : styles.negativeTrend,
              ]}>
              <Image
                source={salesChange >= 0 ? icons.trendUp : icons.trendDown}
                style={styles.trendIcon}
              />
              <Text
                style={[
                  styles.trendText,
                  salesChange >= 0 ? styles.positiveText : styles.negativeText,
                ]}>
                {Math.abs(salesChange)}%
              </Text>
            </View>
          </View>
          <Text style={styles.comparedText}>Compared to yesterday</Text>
        </View>

        {/* Secondary Stats Row */}
        <View style={styles.secondaryStatsContainer}>
          {/* Products Sold Today */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Image
                source={icons.sales}
                style={[styles.statIcon, {tintColor: COLORS.primary}]}
              />
              <Text style={styles.statValue}>{productsSold}</Text>
            </View>
            <Text style={styles.statLabel}>Products Sold Today</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {width: `${(productsSold / totalProducts) * 100}%`},
                ]}
              />
            </View>
          </View>

          {/* Inventory Status */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Image
                source={icons.products}
                style={[styles.statIcon, {tintColor: COLORS.success}]}
              />
              <Text style={styles.statValue}>{totalProducts}</Text>
            </View>
            <Text style={styles.statLabel}>Total Products</Text>
            {lowStockCount > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertText}>{lowStockCount} Low Stock</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    // <View
    //   style={{
    //     flex: 1,
    //     // backgroundColor: '#F5F5F5', // Light background color
    //   }}>
    //   {/* Search */}
    //   {/* {renderSearch()} */}
    //   <Options />
    // </View>
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {renderHeader()}
        {/* {renderQuickStats()} */}

        <View style={styles.mainContent}>
          <Options />
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {/* Add your recent transactions list here */}
          <View style={styles.recentTransactions}>
            {/* Placeholder for recent transactions */}
            <Text style={styles.placeholderText}>No recent transactions</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
  },

  greetingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  waveIcon: {
    width: 22,
    height: 22,
    marginRight: 8,
  },

  profileIcon: {
    width: 24,
    height: 24,
    tintColor: COLORS.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.padding,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    marginHorizontal: 4,
    padding: SIZES.base,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statAmount: {
    ...FONTS.h3,
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
  mainContent: {
    flex: 1,
    marginTop: 12,
  },
  recentSection: {
    marginTop: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
  },
  recentTransactions: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SIZES.padding,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...FONTS.body4,
    color: COLORS.darkgray,
  },
  headerSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SIZES.padding,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    ...FONTS.body3,
    color: COLORS.darkgray,
    letterSpacing: 0.5,
    fontSize: 16,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif-medium',
  },
  nameText: {
    ...FONTS.h2,
    fontSize: 28,
    color: COLORS.black,
    marginBottom: 8,
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif',
    fontWeight: '600',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif-medium',
    letterSpacing: 0.3,
  },
  quickInfo: {
    alignItems: 'flex-end',
  },
  timeText: {
    ...FONTS.h4,
    color: COLORS.darkgray,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusText: {
    ...FONTS.body4,
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif-medium',
  },
  statsSection: {
    padding: 16,
    gap: 16,
  },
  mainStatsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  salesLabel: {
    fontSize: 14,
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  salesAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  comparedText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
  },
  secondaryStatsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statIcon: {
    width: 24,
    height: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  positiveTrend: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  negativeTrend: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  trendIcon: {
    width: 12,
    height: 12,
    tintColor: COLORS.success,
  },
  positiveText: {
    color: COLORS.success,
    fontWeight: '600',
    fontSize: 12,
  },
  negativeText: {
    color: COLORS.error,
    fontWeight: '600',
    fontSize: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  alertBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  alertText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '500',
  },
});
