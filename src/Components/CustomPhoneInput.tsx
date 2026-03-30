import React, { forwardRef, useImperativeHandle, useEffect } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { COLORS, FONTS, SIZES } from "../constants";

/** Uganda — passed to APIs; shown as fixed prefix (+256), not editable (matches web PhoneNumberPicker). */
export const UGANDA_DIAL_CODE = "+256";

/** National mobile digits after +256 (e.g. 750440865). Aligned with web E.164 max length +256 + 9 digits. */
const MAX_NATIONAL_DIGITS = 9;

function normalizeUgandaNationalInput(raw: string): string {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("256")) {
        d = d.slice(3);
    }
    d = d.replace(/^0+/, "");
    if (d.length > MAX_NATIONAL_DIGITS) {
        d = d.slice(0, MAX_NATIONAL_DIGITS);
    }
    return d;
}

interface CustomPhoneInputProps {
    value: string;
    onChangeText: (text: string) => void;
    containerStyle?: object;
    textInputStyle?: object;
    onValidationChange: (isValid: boolean) => void;
}

const CustomPhoneInput = forwardRef((props: CustomPhoneInputProps, ref) => {
    useEffect(() => {
        const isValid = props.value.length >= MAX_NATIONAL_DIGITS;
        props.onValidationChange(isValid);
    }, [props.value]);

    useImperativeHandle(ref, () => ({
        isValidNumber: () => props.value.length >= MAX_NATIONAL_DIGITS,
    }));

    const handleChangeText = (text: string) => {
        props.onChangeText(normalizeUgandaNationalInput(text));
    };

    return (
        <View style={[styles.container, props.containerStyle]}>
            <View style={styles.prefix}>
                <Text style={styles.prefixText}>{UGANDA_DIAL_CODE}</Text>
            </View>
            <TextInput
                style={[styles.input, props.textInputStyle]}
                value={props.value}
                onChangeText={handleChangeText}
                keyboardType="phone-pad"
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.gray}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        height: SIZES.height > 800 ? 55 : 45,
        backgroundColor: COLORS.lightGray2,
        borderRadius: SIZES.radius,
        overflow: "hidden",
    },
    prefix: {
        height: "100%",
        justifyContent: "center",
        paddingHorizontal: 12,
        backgroundColor: COLORS.lightGray1,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: COLORS.gray,
    },
    prefixText: {
        ...FONTS.body3,
        color: COLORS.black,
        fontWeight: "600",
    },
    input: {
        flex: 1,
        height: "100%",
        ...FONTS.body3,
        color: COLORS.black,
        paddingHorizontal: SIZES.padding,
    },
});

export default CustomPhoneInput;
