import React, { useState, useEffect, useRef, memo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Modal, Pressable, TextInput, ActivityIndicator
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ITEM_HEIGHT = 64;
const DEBOUNCE_MS = 200;
const STORAGE_KEY = '@recent_airports';
const MAX_RECENT_ITEMS = 5;

function countryCodeToEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🏳️';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

function sortResults(results, query) {
    const q = query.trim().toUpperCase();
    return [...results].sort((a, b) => {
        const aIataMatch = a.iata_code?.toUpperCase() === q ? 0 : 1;
        const bIataMatch = b.iata_code?.toUpperCase() === q ? 0 : 1;
        if (aIataMatch !== bIataMatch) return aIataMatch - bIataMatch;

        const aStartsWith = (a.city || '').toUpperCase().startsWith(q) ? 0 : 1;
        const bStartsWith = (b.city || '').toUpperCase().startsWith(q) ? 0 : 1;
        return aStartsWith - bStartsWith;
    });
}

const AirportItem = memo(({ item, onSelect, styles }) => {
    const displayName = item.name_uk || item.city || item.name;
    const subDisplayName = item.name_uk
        ? `${item.city}${item.country_code ? `, ${item.country_code}` : ''}`
        : item.name;

    return (
        <TouchableOpacity
            style={styles.modalItem}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
        >
            <Text style={styles.flagText}>{countryCodeToEmoji(item.country_code)}</Text>
            <View style={styles.cityInfo}>
                <Text style={styles.cityName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.airportName} numberOfLines={1}>{subDisplayName}</Text>
            </View>
            <View style={styles.iataContainer}>
                <Text style={styles.iataCode}>{item.iata_code}</Text>
            </View>
        </TouchableOpacity>
    );
});

const AirportSearchModal = ({ visible, onClose, onSelect, title }) => {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [recentAirports, setRecentAirports] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef(null);
    const abortRef = useRef(false);

    // Завантаження історії пошуку при відкритті модалки
    useEffect(() => {
        if (visible) {
            loadRecentAirports();
        }
    }, [visible]);

    // Основний ефект пошуку з дебаунсом
    useEffect(() => {
        const q = searchQuery.trim();

        if (q.length < 2) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        abortRef.current = false;
        setIsLoading(true);

        const handler = setTimeout(async () => {
            if (abortRef.current) return;

            try {
                const searchTerm = `${q}%`; 

                const { data, error } = await supabase
                    .from('airports')
                    .select('iata_code, name, name_uk, city, country_code')
                    .or(
                        `iata_code.ilike.${searchTerm},` +
                        `city.ilike.${searchTerm},` +
                        `name.ilike.${searchTerm},` +
                        `name_uk.ilike.${searchTerm}`
                    )
                    .limit(40);

                if (abortRef.current) return;

                if (error) {
                    console.error('Airport search error:', error.message);
                    setResults([]);
                } else {
                    setResults(sortResults(data || [], q));
                }
            } catch (err) {
                if (!abortRef.current) {
                    console.error(err);
                    setResults([]);
                }
            } finally {
                if (!abortRef.current) {
                    setIsLoading(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            abortRef.current = true;
            clearTimeout(handler);
        };
    }, [searchQuery]);

    // Логіка роботи з локальним сховищем (AsyncStorage)
    const loadRecentAirports = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                setRecentAirports(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load recent airports', e);
        }
    };

    const saveRecentAirport = async (airport) => {
        try {
            // Фільтруємо копії: видаляємо елемент, якщо він вже був у списку
            const filtered = recentAirports.filter(item => item.iata_code !== airport.iata_code);
            // Додаємо новий елемент на початок масиву та обмежуємо ліміт
            const updated = [airport, ...filtered].slice(0, MAX_RECENT_ITEMS);
            
            setRecentAirports(updated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save recent airport', e);
        }
    };

    const clearRecentAirports = async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setRecentAirports([]);
        } catch (e) {
            console.error('Failed to clear recent airports', e);
        }
    };

    const handleClose = () => {
        setSearchQuery('');
        setResults([]);
        setIsLoading(false);
        onClose();
    };

    const handleSelect = async (airport) => {
        setSearchQuery('');
        setResults([]);
        await saveRecentAirport(airport);
        onSelect(airport);
    };

    const renderItem = ({ item }) => (
        <AirportItem
            item={item}
            onSelect={handleSelect}
            styles={styles}
        />
    );

    const showEmptyState = !isLoading && results.length === 0 && searchQuery.trim().length > 1;
    const showPrompt = !isLoading && searchQuery.trim().length < 2;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}
        >
            <Pressable style={styles.modalOverlay} onPress={handleClose}>
                <Pressable style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                    <View style={styles.handleBar} />
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>

                    <View style={[styles.searchContainer, isLoading && styles.searchContainerActive]}>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} style={styles.searchIcon} />
                        ) : (
                            <Ionicons name="search" size={20} color={colors.secondaryText} style={styles.searchIcon} />
                        )}
                        <TextInput
                            ref={inputRef}
                            style={styles.searchInput}
                            placeholder={t('flights.searchAirport', 'Місто, назва або код (напр. KBP, Київ)')}
                            placeholderTextColor={colors.secondaryText}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus={true}
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                                <Ionicons name="close-circle" size={18} color={colors.secondaryText} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {results.length > 0 && (
                        <Text style={styles.resultsCount}>
                            {t('flights.airportsFound', { count: results.length, defaultValue: `Знайдено: ${results.length}` })}
                        </Text>
                    )}

                    {showPrompt ? (
                        recentAirports.length > 0 ? (
                            // Показуємо історію пошуку замість порожнього екрана, якщо вона є
                            <View style={{ flex: 1 }}>
                                <View style={styles.recentHeader}>
                                    <Text style={styles.recentTitle}>{t('flights.recentSearches', 'Останні пошуки')}</Text>
                                    <TouchableOpacity onPress={clearRecentAirports}>
                                        <Text style={styles.clearRecentText}>{t('flights.clearHistory', 'Очистити')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <FlatList
                                    data={recentAirports}
                                    keyExtractor={(item) => `recent-${item.iata_code}`}
                                    renderItem={renderItem}
                                    keyboardShouldPersistTaps="handled"
                                />
                            </View>
                        ) : (
                            <View style={styles.promptContainer}>
                                <Ionicons name="airplane-outline" size={40} color={colors.border} />
                                <Text style={styles.promptText}>
                                    {t('flights.typeToSearch', 'Введіть мінімум 2 символи для пошуку')}
                                </Text>
                            </View>
                        )
                    ) : showEmptyState ? (
                        <View style={styles.promptContainer}>
                            <Ionicons name="search-outline" size={40} color={colors.border} />
                            <Text style={styles.noResultsText}>
                                {t('flights.noAirportsFound', 'Аеропортів не знайдено')}
                            </Text>
                            <Text style={styles.noResultsHint}>
                                {t('flights.tryDifferentSearch', 'Спробуйте інший запит або код IATA')}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={(item) => item.iata_code}
                            renderItem={renderItem}
                            getItemLayout={(_, index) => ({
                                length: ITEM_HEIGHT,
                                offset: ITEM_HEIGHT * index,
                                index,
                            })}
                            keyboardShouldPersistTaps="handled"
                            initialNumToRender={15}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            removeClippedSubviews={true}
                        />
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const getStyles = (colors) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalContainer: {
        height: '88%',
        borderTopRightRadius: 28,
        borderTopLeftRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    handleBar: {
        width: 40, height: 5,
        backgroundColor: colors.border,
        borderRadius: 3,
        alignSelf: 'center',
        marginVertical: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 14,
        textAlign: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 14,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    searchContainerActive: {
        borderColor: colors.primary,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
        flex: 1,
        height: 50,
        color: colors.text,
        fontSize: 16,
    },
    clearButton: {
        padding: 4,
        marginLeft: 4,
    },
    resultsCount: {
        fontSize: 12,
        color: colors.secondaryText,
        marginBottom: 8,
        marginLeft: 4,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        height: ITEM_HEIGHT,
    },
    flagText: { fontSize: 26, marginRight: 12, minWidth: 34 },
    cityInfo: { flex: 1, justifyContent: 'center' },
    cityName: { fontSize: 16, fontWeight: '600', color: colors.text },
    airportName: { fontSize: 13, color: colors.secondaryText, marginTop: 1 },
    iataContainer: {
        backgroundColor: colors.primary + '18',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: colors.primary + '35',
    },
    iataCode: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.primary,
        letterSpacing: 0.5,
    },
    promptContainer: {
        alignItems: 'center',
        marginTop: 48,
        gap: 10,
    },
    promptText: {
        textAlign: 'center',
        color: colors.secondaryText,
        fontSize: 14,
        marginTop: 8,
    },
    noResultsText: {
        textAlign: 'center',
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8,
    },
    noResultsHint: {
        textAlign: 'center',
        color: colors.secondaryText,
        fontSize: 13,
    },
    // Стилі для блоку історії
    recentHeader: {
        flexDirection: 'row',
        justifyContent: 'between',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    recentTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    clearRecentText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '500',
    }
});

export default memo(AirportSearchModal);