import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// import { Video } from 'expo-av';
import { useTheme } from '../ThemeContext';
import { useTranslation } from 'react-i18next';

const FlightLoadingAnimation = () => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const styles = getStyles(colors);

    return (
        <View style={styles.container}>
            {/* <Video
                source={require('../../assets/video.mp4')}
                style={styles.video}
                isLooping
                shouldPlay
                resizeMode="cover"
            /> */}
            <Text style={styles.text}>{t('flights.loading', 'Шукаємо найкращі рейси...')}</Text>
        </View>
    );
};

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 50,
    },
    video: {
        width: 150,
        height: 150,
        borderRadius: 20,
    },
    text: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.secondaryText,
        textAlign: 'center',
        marginTop: 10,
    },
});

export default FlightLoadingAnimation;