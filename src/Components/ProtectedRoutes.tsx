import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/Store'

const ProtectedRoute = ({ children }) => {
    const { accessToken } = useAuth();
    const navigation = useNavigation();

    React.useEffect(() => {
        if (!accessToken) {
            navigation.navigate('SignIn');
        }
    }, [accessToken, navigation]);

    return (
        <View>
            {accessToken ? children : <Text>Loading...</Text>}
        </View>
    );
};

export default ProtectedRoute;
