import { View, Text, StyleSheet } from 'react-native'
import React from 'react'

const PrintLabels = () => {
    return (
        <View>
            <Text style={styles.title}>PrintLabeles</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    }
})

export default PrintLabels 