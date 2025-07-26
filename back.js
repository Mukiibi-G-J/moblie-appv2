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



  import React from 'react';
import {
    View,
    Text,
    Platform
} from 'react-native';
import LinearGradient from "react-native-linear-gradient";


import { FONTS, SIZES, COLORS, icons, images, dummyData } from "../constants"
import TextButton from './TextButton';
import LineDivider from './LineDivider';
import CustomSwitch from './CustomSwitch';

interface FooterTotalProps {
    subTotal: number;
    totalQuantity: number;
    total: number;
    isLoading: boolean;
    onPress: () => void;
    printReceipt: boolean;
    setPrintReceipt: (value: boolean) => void;
}

const FooterTotal: React.FC<FooterTotalProps> = ({ subTotal, totalQuantity, total, isLoading, onPress, printReceipt, setPrintReceipt }) => {
    return (
        <View>
            {/* Shadow */}
            <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                colors={[COLORS.transparent, COLORS.lightGray1]}
                style={{
                    position: 'absolute',
                    top: -15,
                    left: 0,
                    right: 0,
                    height: Platform.OS === 'ios' ? 200 : 50,
                    borderTopLeftRadius: 15,
                    borderTopRightRadius: 15
                }}
            />

            {/* Order Details */}
            <View
                style={{
                    padding: SIZES.padding,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    backgroundColor: COLORS.white
                }}
            >
                {/* Subtotal */}
                <View
                    style={{
                        flexDirection: 'row'
                    }}
                >
                    <Text style={{ flex: 1, ...FONTS.body3, color: COLORS.gray }}>Subtotal</Text>
                    <Text style={{ ...FONTS.h3, color: COLORS.gray }}>UGX{' '}{subTotal?.toLocaleString()}</Text>
                </View>

                {/* Shipping Fee */}
                <View
                    style={{
                        flexDirection: 'row',
                        marginTop: SIZES.base,
                        marginBottom: SIZES.padding
                    }}
                >
                    <Text style={{ flex: 1, ...FONTS.body3, color: COLORS.gray }}>Quantity</Text>
                    <Text style={{ ...FONTS.h3, color: COLORS.gray }}>{totalQuantity}</Text>
                </View>

                <LineDivider />

                {/* Subtotal */}
                <View
                    style={{
                        flexDirection: 'row',
                        marginTop: SIZES.padding,
                        marginBottom: SIZES.base
                    }}
                >
                    <Text style={{ flex: 1, ...FONTS.h2, color: COLORS.gray }}>Total:</Text>
                    <Text style={{ ...FONTS.h2, color: COLORS.gray }}>UGX{' '}{subTotal?.toLocaleString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <CustomSwitch
                        label="Print Receipt"
                        value={printReceipt}
                        onChange={(value: boolean) => setPrintReceipt(value)}
                    />
                </View>

                {/* Order */}
                <TextButton
                    labelStyle={{ color: COLORS.white }}
                    buttonContainerStyle={{
                        height: 60,
                        marginTop: SIZES.padding,
                        borderRadius: SIZES.radius,
                        backgroundColor: COLORS.primary2
                    }}
                    label="Complete Sale"
                    onPress={onPress}
                    disabled={isLoading}
                />
            </View>
        </View>
    )
}

export default FooterTotal;