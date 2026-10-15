import React from 'react';
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field';
import { SIZES } from '../constants';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radii } from '../design-system/theme';

/** Match Login / Sign-up primary CTA */
const BRAND_FOCUS = '#005151';

interface CustomOTPInputProps {
    pinCount: number;
    onCodeFilled: (code: string) => void;
    onCodeChanged: (code: string) => void;
    /** When false, digits cannot be edited (e.g. while submitting). */
    editable?: boolean;
}

const CustomOTPInput: React.FC<CustomOTPInputProps> = ({
    pinCount,
    onCodeFilled,
    onCodeChanged,
    editable = true,
}) => {
    const { colors } = useTheme();
    const [value, setValue] = React.useState('');
    const ref = useBlurOnFulfill({ value, cellCount: pinCount });
    const [props, getCellOnLayoutHandler] = useClearByFocusCell({
        value,
        setValue,
    });

    const handleChange = (code) => {
        setValue(code);
        onCodeChanged(code);
        if (code.length === pinCount) {
            onCodeFilled(code);
        }
    };

    const renderCell = ({ index, symbol, isFocused }) => {
        return (
            <View
                key={index}
                style={[
                    styles.cellContainer,
                    {
                        borderColor: colors.border,
                        backgroundColor: colors.inputBackground,
                    },
                    isFocused && {
                        borderColor: BRAND_FOCUS,
                        borderWidth: 2,
                        backgroundColor: colors.surface,
                    },
                    symbol &&
                        !isFocused && {
                            borderColor: colors.borderStrong,
                        },
                ]}
                onLayout={getCellOnLayoutHandler(index)}>
                <Text style={[styles.cellText, { color: colors.textPrimary }]}>
                    {symbol || (isFocused ? <Cursor /> : null)}
                </Text>
            </View>
        );
    };

    return (
        <CodeField
            ref={ref}
            {...props}
            value={value}
            onChangeText={handleChange}
            cellCount={pinCount}
            rootStyle={styles.codeFieldRoot}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            editable={editable}
            renderCell={renderCell}
        />
    );
};

const styles = StyleSheet.create({
    codeFieldRoot: {
        marginTop: SIZES.padding,
        width: '100%',
        justifyContent: 'center',
    },
    cellContainer: {
        width: 42,
        height: 50,
        borderWidth: 1.5,
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    cellText: {
        fontSize: 20,
        fontVariant: ['tabular-nums'],
        fontWeight: '600',
    },
});

export default CustomOTPInput;
