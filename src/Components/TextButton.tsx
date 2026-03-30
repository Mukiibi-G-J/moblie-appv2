import React from 'react';
import {
    TouchableOpacity,
    Text
} from 'react-native';
import { FONTS, COLORS } from "../constants";
interface TextButtonProps {
    buttonContainerStyle: object;
    disabled: boolean;
    label: string;
    labelStyle: object;
    label2?: string;
    label2Style?: object;
    onPress: () => void;
}

const TextButton: React.FC<TextButtonProps> = ({
    buttonContainerStyle,
    disabled,
    label,
    labelStyle,
    label2 = "",
    label2Style,
    onPress
}) => {
    return (
        <TouchableOpacity
            style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.primary,
                opacity: disabled ? 0.5 : 1,
                ...buttonContainerStyle
            }}
            disabled={disabled}
            onPress={onPress}
        >
            <Text style={{ color: COLORS.white, ...FONTS.h3, ...labelStyle }}>
                {label}
            </Text>

            {label2 != "" &&
                <Text
                    style={{
                        flex: 1,
                        textAlign: 'right',
                        color: COLORS.white,
                        ...FONTS.h3,
                        ...label2Style
                    }}
                >
                    {label2}
                </Text>
            }
        </TouchableOpacity>
    )
}

export default TextButton;