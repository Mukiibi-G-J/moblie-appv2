import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants';

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

const CustomAlert = ({ visible, title, message, onClose }: CustomAlertProps) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalBackground}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.titleText}>{title}</Text>
                    </View>
                    
                    <View style={styles.messageContainer}>
                        <Text style={styles.messageText}>{message}</Text>
                    </View>
                    
                    <TouchableOpacity
                        style={styles.button}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>OK</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '80%',
        backgroundColor: COLORS.white,
        borderRadius: SIZES.radius,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    header: {
        padding: SIZES.padding,
        backgroundColor: COLORS.primary2,
    },
    titleText: {
        ...FONTS.h3,
        color: COLORS.white,
        textAlign: 'center',
    },
    messageContainer: {
        padding: SIZES.padding,
    },
    messageText: {
        ...FONTS.body3,
        color: COLORS.darkGray,
        textAlign: 'center',
    },
    button: {
        padding: SIZES.padding,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray1,
        alignItems: 'center',
    },
    buttonText: {
        ...FONTS.h3,
        color: COLORS.primary2,
    },
});

export default CustomAlert;