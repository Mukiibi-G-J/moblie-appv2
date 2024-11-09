import React from 'react';
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field';
import { COLORS, SIZES } from '../constants';
import { StyleSheet, Text, View } from 'react-native';

interface CustomOTPInputProps {
    pinCount: number;
    onCodeFilled: (code: string) => void;
    onCodeChanged: (code: string) => void;
}

const CustomOTPInput: React.FC<CustomOTPInputProps> = ({ pinCount, onCodeFilled, onCodeChanged }) => {
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
                style={[styles.cellContainer, isFocused && styles.focusCell]}
                onLayout={getCellOnLayoutHandler(index)}>
                <Text style={styles.cellText}>
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
        width: 45,
        height: 45,
        borderWidth: 1.5,
        borderColor: COLORS.gray,
        borderRadius: SIZES.radius,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    cellText: {
        fontSize: 20,
        color: COLORS.black,
    },
    focusCell: {
        borderColor: COLORS.primary2,
        backgroundColor: COLORS.lightGray,
    },
});

export default CustomOTPInput;
