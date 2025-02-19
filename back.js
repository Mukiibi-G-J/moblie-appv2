const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  const renderQuickStats = () => {
    const todaySales = 1234000; // Example amount in UGX
    const salesChange = +15.8; // Percentage change from yesterday
  
    return (
      <View style={styles.statsSection}>
        {/* Main Stats */}
        <View style={styles.statsContainer}>
          {/* Sales Card */}
          <View style={[styles.statCard, styles.salesCard]}>
            <View style={styles.statHeader}>
              <Image 
                source={icons.sales}
                style={[styles.statIcon, { tintColor: COLORS.primary }]} 
              />
              <View style={[styles.trendBadge, salesChange >= 0 ? styles.positiveTrend : styles.negativeTrend]}>
                <Image 
                  source={salesChange >= 0 ? icons.trendUp : icons.trendDown}
                  style={styles.trendIcon}
                />
                <Text style={[styles.trendText, salesChange >= 0 ? styles.positiveText : styles.negativeText]}>
                  {Math.abs(salesChange)}%
                </Text>
              </View>
            </View>
            <Text style={styles.statAmount}>{formatCurrency(todaySales)}</Text>
            <Text style={styles.statLabel}>Today's Sales</Text>
          </View>
  
          {/* Orders Card */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Image 
                source={icons.orders}
                style={[styles.statIcon, { tintColor: COLORS.secondary }]} 
              />
            </View>
            <Text style={styles.statAmount}>28</Text>
            <Text style={styles.statLabel}>Orders Today</Text>
            <Text style={styles.subText}>18 Completed</Text>
          </View>
  
          {/* Products Card */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Image 
                source={icons.products}
                style={[styles.statIcon, { tintColor: COLORS.success }]} 
              />
            </View>
            <Text style={styles.statAmount}>156</Text>
            <Text style={styles.statLabel}>Products</Text>
            <Text style={styles.subText}>12 Low Stock</Text>
          </View>
        </View>
      </View>
    );
  };
  
  // Add these styles to your StyleSheet
  const styles = StyleSheet.create({
    statsSection: {
      paddingHorizontal: SIZES.padding,
      marginTop: SIZES.padding,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    statCard: {
      flex: 1,
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
    salesCard: {
      flex: 1.2, // Make sales card slightly wider
    },
    statHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    statIcon: {
      width: 24,
      height: 24,
    },
    trendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    positiveTrend: {
      backgroundColor: COLORS.success + '15',
    },
    negativeTrend: {
      backgroundColor: COLORS.error + '15',
    },
    trendIcon: {
      width: 12,
      height: 12,
    },
    trendText: {
      ...FONTS.body5,
      fontSize: 12,
      fontWeight: '600',
    },
    positiveText: {
      color: COLORS.success,
    },
    negativeText: {
      color: COLORS.error,
    },
    statAmount: {
      ...FONTS.h2,
      color: COLORS.black,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
      fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif',
    },
    statLabel: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      marginBottom: 4,
      fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif-medium',
    },
    subText: {
      ...FONTS.body5,
      color: COLORS.secondary,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif',
    },
    statsSection: {
        paddingHorizontal: SIZES.padding,
        marginTop: SIZES.padding,
      },
      statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
      },
      statCard: {
        flex: 1,
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
      salesCard: {
        flex: 1.2, // Make sales card slightly wider
      },
      statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      },
      statIcon: {
        width: 24,
        height: 24,
      },
      trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
      },
      positiveTrend: {
        backgroundColor: COLORS.success + '15',
      },
      negativeTrend: {
        backgroundColor: COLORS.error + '15',
      },
      trendIcon: {
        width: 12,
        height: 12,
      },
      trendText: {
        ...FONTS.body5,
        fontSize: 12,
        fontWeight: '600',
      },
      positiveText: {
        color: COLORS.success,
      },
      negativeText: {
        color: COLORS.error,
      },
      statAmount: {
        ...FONTS.h2,
        color: COLORS.black,
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
        fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif',
      },
      statLabel: {
        ...FONTS.body4,
        color: COLORS.darkgray,
        marginBottom: 4,
        fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif-medium',
      },
      subText: {
        ...FONTS.body5,
        color: COLORS.secondary,
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif',
      },
  });