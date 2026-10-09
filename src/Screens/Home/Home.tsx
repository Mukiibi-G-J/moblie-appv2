import React, {useState, useEffect} from 'react';
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
import SalesByCategory from './SalesByCategory';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScrollView} from 'react-native-gesture-handler';
import {MenuItem, MenuCategory} from '../../@types/types.dto';
import {jwtDecode} from 'jwt-decode';
import {useAuth} from '../../context/Store';
import {getRoleDisplayName} from '../../utils/utils';

export default function Home() {
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number>(1);
  const [selectedMenuType, setSelectedMenuType] = React.useState<number>(1);
  const [popular, setPopular] = React.useState<MenuItem[]>([]);
  const [recommends, setRecommends] = React.useState<MenuItem[]>([]);
  const [menuList, setMenuList] = React.useState<MenuItem[]>([]);
  const {auth, accessToken} = useAuth();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const navigation = useNavigation();

  // Debug auth state and handle loading
  React.useEffect(() => {
    console.log('Home component auth state:', auth);
    console.log('Home component accessToken:', accessToken);

    // Set loading to false after auth data is available
    if (auth.username && auth.user_id) {
      setIsAuthLoading(false);
    } else if (!accessToken) {
      // If no access token, we're not logged in, so stop loading
      setIsAuthLoading(false);
    }
  }, [auth, accessToken]);

  // Timeout to prevent infinite loading
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (isAuthLoading) {
        console.log('Auth loading timeout, forcing stop');
        setIsAuthLoading(false);
      }
    }, 3000); // 3 second timeout

    return () => clearTimeout(timeout);
  }, [isAuthLoading]);

  // Prevent going back to login page
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      // Prevent going back to login page
      if (
        e.target &&
        (e.target.includes('SignIn') || e.target.includes('OnBoarding'))
      ) {
        e.preventDefault();
      }
    });

    return unsubscribe;
  }, [navigation]);

  React.useEffect(() => {
    handleChangeCategory(selectedCategoryId, selectedMenuType);
  }, []);

  // Add useEffect for the timer
  useEffect(() => {
    // Update date at midnight
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 86400000); // 24 hours in milliseconds

    // Cleanup on component unmount
    return () => clearInterval(timer);
  }, []);

  function handleChangeCategory(categoryId: number, menuTypeId: number) {
    // Type the menu finds
    const selectedPopular = (dummyData.menu as MenuCategory[]).find(
      a => a.name === 'Popular',
    );
    const selectedRecommend = (dummyData.menu as MenuCategory[]).find(
      a => a.name === 'Recommended',
    );
    const selectedMenu = (dummyData.menu as MenuCategory[]).find(
      a => a.id === menuTypeId,
    );

    // Set the popular menu based on the categoryId
    setPopular(
      selectedPopular?.list.filter(a => a.categories.includes(categoryId)) ||
        [],
    );

    // Set the recommended menu based on the categoryId
    setRecommends(
      selectedRecommend?.list.filter(a => a.categories.includes(categoryId)) ||
        [],
    );

    // Set the menu based on the categoryId
    setMenuList(
      selectedMenu?.list.filter(a => a.categories.includes(categoryId)) || [],
    );
  }

  function renderMenuTypes() {
    return (
      <FlatList
        horizontal
        data={dummyData.menu as MenuCategory[]}
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
    const formattedDate = currentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    return (
      <View style={styles.headerSection}>
        <View style={styles.headerCard}>
          <View style={styles.headerMain}>
            {/* Left side - Welcome message */}
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.nameText}>
                {isAuthLoading ? 'Loading...' : auth.username || 'User'}
              </Text>
              <View style={styles.roleContainer}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {isAuthLoading
                      ? 'Loading...'
                      : getRoleDisplayName(auth.authority || [])}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right side - Quick Info */}
            <View style={styles.quickInfo}>
              <Text style={styles.dateText}>{formattedDate}</Text>
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

  // const renderQuickStats = () => {
  //   const todaySales = 1234000;
  //   const salesChange = +15.8;
  //   const totalProducts = 156;
  //   const productsSold = 45; // Number of products sold today
  //   const lowStockCount = 12;

  //   return (
  //     <View style={styles.statsSection}>
  //       {/* Main Sales Card - Make it prominent */}
  //       <View style={styles.mainStatsCard}>
  //         <View style={styles.salesHeader}>
  //           <View>
  //             <Text style={styles.salesLabel}>Today's Revenue</Text>
  //             <Text style={styles.salesAmount}>
  //               {formatCurrency(todaySales)}
  //             </Text>
  //           </View>
  //           <View
  //             style={[
  //               styles.trendBadge,
  //               salesChange >= 0 ? styles.positiveTrend : styles.negativeTrend,
  //             ]}>
  //             <Image
  //               source={salesChange >= 0 ? icons.trendUp : icons.trendDown}
  //               style={styles.trendIcon}
  //             />
  //             <Text
  //               style={[
  //                 styles.trendText,
  //                 salesChange >= 0 ? styles.positiveText : styles.negativeText,
  //               ]}>
  //               {Math.abs(salesChange)}%
  //             </Text>
  //           </View>
  //         </View>
  //         <Text style={styles.comparedText}>Compared to yesterday</Text>
  //       </View>

  //       {/* Secondary Stats Row */}
  //       <View style={styles.secondaryStatsContainer}>
  //         {/* Products Sold Today */}
  //         <View style={styles.statCard}>
  //           <View style={styles.statHeader}>
  //             <Image
  //               source={icons.sales}
  //               style={[styles.statIcon, {tintColor: COLORS.primary}]}
  //             />
  //             <Text style={styles.statValue}>{productsSold}</Text>
  //           </View>
  //           <Text style={styles.statItemLabel}>Products Sold Today</Text>
  //           <View style={styles.progressBar}>
  //             <View
  //               style={[
  //                 styles.progressFill,
  //                 {width: `${(productsSold / totalProducts) * 100}%`},
  //               ]}
  //             />
  //           </View>
  //         </View>

  //         {/* Inventory Status */}
  //         <View style={styles.statCard}>
  //           <View style={styles.statHeader}>
  //             <Image
  //               source={icons.products}
  //               style={[styles.statIcon, {tintColor: COLORS.success}]}
  //             />
  //             <Text style={styles.statValue}>{totalProducts}</Text>
  //           </View>
  //           <Text style={styles.statItemLabel}>Total Products</Text>
  //           {lowStockCount > 0 && (
  //             <View style={styles.alertBadge}>
  //               <Text style={styles.alertText}>{lowStockCount} Low Stock</Text>
  //             </View>
  //           )}
  //         </View>
  //       </View>
  //     </View>
  //   );
  // };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {renderHeader()}
        {/* {renderQuickStats()} */}

        <SalesByCategory />

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
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: 4,
  },
  nameText: {
    ...FONTS.h2,
    color: COLORS.darkGray,
    marginBottom: 8,
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
  },
  quickInfo: {
    alignItems: 'flex-end',
  },
  dateText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: 8,
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
  },
  mainContent: {
    padding: 16,
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
  statItemLabel: {
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
  recentSection: {
    padding: 16,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.darkGray,
    marginBottom: 16,
  },
  recentTransactions: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  placeholderText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
