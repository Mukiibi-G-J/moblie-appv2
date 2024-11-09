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
                    label="Complete Order"
                    onPress={onPress}
                    disabled={isLoading}
                />
            </View>
        </View>
    )
}

export default FooterTotal;