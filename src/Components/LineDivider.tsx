import React from 'react';
import {
    View
} from 'react-native';
import { COLORS } from '../constants';

interface LineDividerProps {
    lineStyle?: any;
}

const LineDivider: React.FC<LineDividerProps> = ({ lineStyle }) => {
    return (
        <View
            style={{
                height: 2,
                width: "100%",
                backgroundColor: COLORS.lightGray2,
                ...lineStyle
            }}
        />
    )
}

export default LineDivider;