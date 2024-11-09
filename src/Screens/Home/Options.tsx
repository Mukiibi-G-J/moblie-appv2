import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, icons } from '../../constants'; // Adjust the import path as necessary

const Options = () => {
    const navigation = useNavigation();

    // Combined options array
    const options = [
        {
            icons: icons.cart,
            iconsColor: "blue",
            title: "Sales",
            link: "Sales",
            color: "rgba(76, 175, 80, 0.2)", // Light transparent green
        },
        {
            icons: icons.product,
            iconsColor: '',
            title: "Products",
            link: "Products",
            color: "rgba(33, 150, 243, 0.2)", // Light transparent blue
        },
        {
            icons: icons.product,
            iconsColor: '',
            title: "Print Labels",
            link: "PrintLabels",
            color: "rgba(255, 152, 0, 0.2)", // Light transparent orange
        },
        {
            icons: icons.cart,
            iconsColor: '',
            title: "Cart",
            link: "Cart",
            color: "rgba(244, 67, 54, 0.2)", // Light transparent red
        }
    ];

    const renderOption = ({ item }) => {
        return (
            <TouchableOpacity
                style={styles.optionButton} // Apply card styles
                onPress={() => navigation.navigate(item.link)} // Navigate to the respective link
            >
                <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
                    <Image
                        source={item.icons}
                        style={[styles.icon, { tintColor: item.iconsColor }]} // Apply iconsColor here
                        resizeMode="contain"
                    />
                </View>
                <View style={styles.optionContent}>
                    <Text style={styles.title}>{item.title}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={options}
                renderItem={renderOption}
                keyExtractor={(item) => item.title}
                numColumns={2} // Display two items per row
                columnWrapperStyle={styles.columnWrapper} // Space between columns
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16, // Padding to match the phone's margin
        marginVertical: 20,
        alignItems: 'center', // Center the options section
    },
    optionButton: {
        flexDirection: "row",
        padding: 6,
        alignItems: 'center',
        justifyContent: 'flex-start', // Align items to the start
        width: '48%', // Adjust width to fit two items in a row
        marginBottom: 16, // Space between rows
        backgroundColor: 'white', // Card background color
        borderRadius: 12,
        elevation: 4, // Shadow effect for Android
        shadowColor: '#000', // Shadow color for iOS
        shadowOffset: { width: 0, height: 2 }, // Shadow offset for iOS
        shadowOpacity: 0.1, // Shadow opacity for iOS
        shadowRadius: 4, // Shadow radius for iOS
    },
    iconContainer: {

        width: 50, // Adjust size as needed
        height: 50, // Adjust size as needed
        borderRadius: 30, // Make it circular
        alignItems: 'center',
        flexDirection: "row",
        justifyContent: 'center',
        // position: 'absolute', // Position it in the center of the card
    },
    icon: {
        width: 28,
        height: 28,
    },
    optionContent: {
        flexDirection: 'row', // Align icon and text side by side
        alignItems: 'center',
        marginTop: 10, // Space between icon and text
    },
    title: {
        marginLeft: 8, // Space between icon and text
        fontSize: 14, // Adjust font size as needed
        color: 'black', // Adjust text color as needed
        textAlign: 'left', // Align text to the left
    },
    columnWrapper: {
        justifyContent: 'space-between', // Space between columns
    },
});

export default Options;