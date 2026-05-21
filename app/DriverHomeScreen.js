import React, { useState, useCallback, useEffect, memo, useMemo, useRef } from 'react';
import { View, Text, SafeAreaView, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from './ThemeContext';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/uk';
import 'moment/locale/ro';
import 'moment/locale/en-gb';
import IndividualTransferIcon from '../assets/induvidual.svg'; 
import GroupTransferIcon from '../assets/group.svg';
import { useAuth } from '../provider/AuthContext';
import { MotiView } from 'moti';
import Logo from '../assets/icon.svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

const shadowStyle = { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 };

const getStyles = (colors, theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    headerSide: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerCenter: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    profilePic: { width: 40, height: 40, borderRadius: 20 },
    profilePlaceholder: { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, width: 40, height: 40, borderRadius: 20 },
    roleSwitcher: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 20, padding: 4, ...shadowStyle, position: 'relative' },
    roleOption: { padding: 8, borderRadius: 16, zIndex: 1, width: 40, alignItems: 'center', justifyContent: 'center' },
    rolePill: { position: 'absolute', top: 4, bottom: 4, left: -4, width: 40, backgroundColor: colors.primary, borderRadius: 16 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 50 },
    text: { fontSize: 18, color: colors.secondaryText, textAlign: 'center', marginTop: 16 },
    statusBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8, marginTop: 16 },
    newRequestBanner: { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
    noNewRequestBanner: { backgroundColor: '#28a74520', borderColor: '#28a745' },
    statusText: { marginLeft: 10, color: colors.text, fontSize: 15, fontWeight: '600' },
    itemContainer: { marginBottom: 16 },
    postedTimeText: { color: colors.secondaryText, fontSize: 12, textAlign: 'center', marginBottom: 8 },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: theme === 'light' ? 0.08 : 0.15, shadowRadius: 12, elevation: 5 },
    expiringCard: { backgroundColor: theme === 'dark' ? colors.background : '#ffffffff' },
    pastCard: { 
        backgroundColor: theme === 'dark' ? colors.background : '#ffffffff',
        opacity: 1,
        borderWidth: 0.9,
        borderColor: "#ff2525ff"
    }, 
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 64, height: 64, borderRadius: 32, marginRight: 16, backgroundColor: colors.background },
    infoContainer: { flex: 1 },
    nameAndTypeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    passengerName: { fontSize: 18, fontWeight: 'bold', color: colors.text, flex: 1, marginRight: 8 },
    transferIconContainer: { alignItems: 'center', justifyContent: 'center' },
    detailsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    detailItem: { alignItems: 'center', flex: 1 },
    detailLabel: { fontSize: 12, color: colors.secondaryText, marginBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, justifyContent: 'center' },
    dividerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    routeContainer: {},
    locationRow: { flexDirection: 'row', alignItems: 'center' },
    locationText: { color: colors.text, fontSize: 16, marginLeft: 12, fontWeight: '500', flex: 1 },
    routeDottedLine: { height: 20, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', marginLeft: 11, marginVertical: 4 },
    commentContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.border },
    commentIcon: { marginRight: 8 },
    commentText: { color: colors.secondaryText, fontSize: 14, fontStyle: 'italic', flex: 1 },
});

const RoleSwitcher = ({ role, onSwitch, isSwitching }) => {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const isDriver = role === 'driver';
    const switchValue = useSharedValue(isDriver ? 1 : 0);

    useEffect(() => {
        switchValue.value = withSpring(isDriver ? 1 : 0, { damping: 15, stiffness: 120 });
    }, [isDriver]);

    const pillStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: switchValue.value * 48 }],
    }));

    const passengerIconStyle = useAnimatedStyle(() => ({
        color: interpolateColor(switchValue.value, [0, 1], ['#FFFFFF', colors.secondaryText]),
    }));

    const driverIconStyle = useAnimatedStyle(() => ({
        color: interpolateColor(switchValue.value, [0, 1], [colors.secondaryText, '#FFFFFF']),
    }));

    if (isSwitching) {
        return (
            <View style={[styles.roleSwitcher, { paddingHorizontal: 28, paddingVertical: 12 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.roleSwitcher}>
            <Animated.View style={[styles.rolePill, pillStyle]} />
            <TouchableOpacity style={styles.roleOption} onPress={() => onSwitch(false)} disabled={!isDriver}>
                <AnimatedIonicons name="person-outline" size={20} style={passengerIconStyle} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roleOption} onPress={() => onSwitch(true)} disabled={isDriver}>
                <AnimatedIonicons name="car-sport-outline" size={20} style={driverIconStyle} />
            </TouchableOpacity>
        </View>
    );
};

const AnimatedBlock = ({ children, delay }) => (
    <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 500, delay }}>
        {children}
    </MotiView>
);

const TransferRequestCard = memo(({ item, onPress, isExpiring, isPast }) => {
    const { colors, theme } = useTheme();
    const { t } = useTranslation();
    const styles = getStyles(colors, theme);

    const getShortName = (name) => {
        if (!name) return '';
        const parts = name.split(' ');
        return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : name;
    };

    const avatarSource = item.passenger_avatar_url ? { uri: item.passenger_avatar_url } : require('../assets/default-avatar.png');
    const airportIcon = <Ionicons name="airplane-outline" size={24} color={colors.secondaryText} />;
    const locationIcon = <Ionicons name="business-outline" size={24} color={colors.secondaryText} />;
    const startIcon = item.direction === 'from_airport' ? airportIcon : locationIcon;
    const endIcon = item.direction === 'to_airport' ? airportIcon : locationIcon;
    const truncatedComment = item.passenger_comment && item.passenger_comment.length > 20 ? `${item.passenger_comment.substring(0, 20)}...` : item.passenger_comment;

    const onItemPress = useCallback(() => {
        onPress(item);
    }, [onPress, item]);

    return (
        <TouchableOpacity 
            style={[styles.card, isExpiring && styles.expiringCard, isPast && styles.pastCard]} 
            onPress={onItemPress}
        >
            <View style={styles.cardTop}>
                <Image source={avatarSource} style={styles.avatar} contentFit="cover" transition={300} cachePolicy="disk"/>
                <View style={styles.infoContainer}>
                    <View style={styles.nameAndTypeContainer}>
                        <Text style={styles.passengerName} numberOfLines={1}>{getShortName(item.passenger_name)}</Text>
                        <View style={styles.transferIconContainer}>
                            {item.transfer_type === 'individual' && <IndividualTransferIcon width={48} height={48} />}
                            {item.transfer_type === 'group' && <GroupTransferIcon width={48} height={48} />}
                        </View>
                    </View>
                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}><Text style={styles.detailLabel}><Ionicons name="calendar-outline" size={14} /> {t('driverHome.date')}</Text><Text style={styles.detailValue}>{moment(item.transfer_datetime).format('DD.MM')}</Text></View>
                        <View style={styles.detailItem}><Text style={styles.detailLabel}><Ionicons name="time-outline" size={14} /> {t('driverHome.time')}</Text><Text style={styles.detailValue}>{moment(item.transfer_datetime).format('HH:mm')}</Text></View>
                        <View style={styles.detailItem}><Text style={styles.detailLabel}><Ionicons name="people-outline" size={14} /> {t('driverHome.people')}</Text><Text style={styles.detailValue}>{item.total_passengers}</Text></View>
                    </View>
                </View>
            </View>
            <View style={styles.dividerContainer}><View style={styles.dividerDot} /><View style={[styles.dividerLine, { borderColor: colors.border }]} /><View style={styles.dividerDot} /></View>
            <View style={styles.routeContainer}>
                <View style={styles.locationRow}>{startIcon}<Text style={styles.locationText} numberOfLines={1}>{item.from_location}</Text></View>
                <View style={[styles.routeDottedLine, { borderColor: colors.secondaryText }]} />
                <View style={styles.locationRow}>{endIcon}<Text style={styles.locationText} numberOfLines={1}>{item.to_location}</Text></View>
            </View>
            {item.passenger_comment && (
                <View style={styles.commentContainer}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.secondaryText} style={styles.commentIcon} />
                    <Text style={styles.commentText} numberOfLines={1}>"{truncatedComment}"</Text>
                </View>
            )}
        </TouchableOpacity>
    );
});

const keyExtractor = (item) => item.id;

const DriverHomeScreen = () => {
    const { colors, theme } = useTheme();
    const { t, i18n } = useTranslation();
    const navigation = useNavigation();
    const { profile, switchRole } = useAuth();
    const styles = getStyles(colors, theme);

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [newRequestsCount, setNewRequestsCount] = useState(0);
    const [isSwitchingRole, setIsSwitchingRole] = useState(false);

    const isInitialLoad = useRef(true);

    const fetchDriverData = useCallback(async (showLoading = false) => {
        const CACHE_KEY_REQUESTS = `DRIVER_FEED_REQUESTS`;
        const CACHE_KEY_COUNT = `DRIVER_FEED_COUNT`;

        if (showLoading) {
            try {
                const cachedReq = await AsyncStorage.getItem(CACHE_KEY_REQUESTS);
                const cachedCount = await AsyncStorage.getItem(CACHE_KEY_COUNT);
                if (cachedReq) {
                    setRequests(JSON.parse(cachedReq));
                    if (cachedCount) setNewRequestsCount(JSON.parse(cachedCount));
                    setLoading(false);
                } else {
                    setLoading(true);
                }
            } catch (e) {
                setLoading(true);
            }
        }

        try {
            const [requestsPromise, countPromise] = await Promise.all([
                supabase.rpc('get_driver_feed_transfers'), 
                supabase.rpc('get_new_transfers_count') 
            ]);

            if (requestsPromise.error) throw requestsPromise.error;
            if (countPromise.error) throw countPromise.error;

            const freshRequests = requestsPromise.data || [];
            const freshCount = countPromise.data || 0;

            setRequests(freshRequests);
            setNewRequestsCount(freshCount);

            await AsyncStorage.setItem(CACHE_KEY_REQUESTS, JSON.stringify(freshRequests));
            await AsyncStorage.setItem(CACHE_KEY_COUNT, JSON.stringify(freshCount));
        } catch (error) {
            console.error("Error fetching driver data:", error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (isInitialLoad.current) {
                fetchDriverData(true);
                isInitialLoad.current = false;
            } else {
                fetchDriverData(false);
            }

            const channel = supabase
                .channel('driver-home-screen')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, () => fetchDriverData(false))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_views' }, () => fetchDriverData(false))
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }, [fetchDriverData])
    );

    useEffect(() => {
        const locale = i18n.language === 'en' ? 'en-gb' : i18n.language;
        moment.locale(locale);
    }, [i18n.language]);

    useEffect(() => {
        setIsSwitchingRole(false);
    }, [profile?.role]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchDriverData(false);
        setRefreshing(false);
    }, [fetchDriverData]);

    const handleCardPress = useCallback((item) => {
        if (!requests.find(r => r.id === item.id)?.is_viewed) {
            setNewRequestsCount(prev => (prev > 0 ? prev - 1 : 0));
        }
        supabase.rpc('mark_transfer_as_viewed', { p_transfer_id: item.id }).then(({ error }) => {
            if (error) console.error('Failed to mark as viewed:', error);
        });
        navigation.navigate('DriverRequest', { transferId: item.id });
    }, [navigation, requests]);

    const handleRoleSwitch = useCallback(async (isDriver) => {
        const newRole = isDriver ? 'driver' : 'client';
        if (newRole === profile?.role) return;
        setIsSwitchingRole(true);
        const { success, error } = await switchRole(newRole);
        if (!success) {
            Alert.alert(t('common.error'), error);
        }
    }, [switchRole, profile, t]);

    const handleProfilePress = useCallback(() => {
        navigation.navigate('DriverProfileTab');
    }, [navigation]);

    const renderItem = useCallback(({ item, index }) => {
        const now = moment();
        const transferTime = moment(item.transfer_datetime);
        const isPast = transferTime.isBefore(now);
        const isExpiring = !isPast && transferTime.isBefore(now.clone().add(24, 'hours'));

        return (
            <MotiView 
                from={{ opacity: 0, translateY: 50 }} 
                animate={{ opacity: 1, translateY: 0 }} 
                transition={{ type: 'timing', duration: 500, delay: 100 + index * 50 }} 
            >
                <View style={styles.itemContainer}>
                    {!isPast && (
                        <Text style={styles.postedTimeText}>
                            {t('driverHome.posted')} {moment(item.created_at).fromNow()}
                        </Text>
                    )}
                    <TransferRequestCard 
                        item={item} 
                        onPress={handleCardPress} 
                        isExpiring={isExpiring}
                        isPast={isPast}
                    />
                </View>
            </MotiView>
        );
    }, [handleCardPress, t]);

    const listHeader = useMemo(() => (
        <AnimatedBlock delay={100}>
            <View style={[styles.statusBanner, newRequestsCount > 0 ? styles.newRequestBanner : styles.noNewRequestBanner]}>
                <Ionicons name={newRequestsCount > 0 ? "notifications-circle" : "checkmark-done-circle-outline"} size={24} color={newRequestsCount > 0 ? colors.primary : '#28a745'} />
                <Text style={styles.statusText}>{newRequestsCount > 0 ? t('driverHome.newRequests', { count: newRequestsCount }) : t('driverHome.noNewRequests')}</Text>
            </View>
        </AnimatedBlock>
    ), [newRequestsCount, colors.primary, styles, t]);

    const listEmpty = useMemo(() => (
        <View style={styles.content}>
            <Ionicons name="file-tray-outline" size={64} color={colors.secondaryText} />
            <Text style={styles.text}>{t('driverHome.noRequests')}</Text>
        </View>
    ), [styles.content, styles.text, colors.secondaryText, t]);

    return (
        <SafeAreaView style={styles.container}>
            <AnimatedBlock delay={0}>
                <View style={styles.header}>
                    <View style={styles.headerSide}>
                        <Logo width={60} height={60} />
                    </View>
                    <View style={styles.headerCenter}>
                        {profile?.is_driver && (
                            <RoleSwitcher
                                role={profile.role}
                                onSwitch={handleRoleSwitch}
                                isSwitching={isSwitchingRole}
                            />
                        )}
                    </View>
                    <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
                        <TouchableOpacity onPress={handleProfilePress}>
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={styles.profilePic} cachePolicy="disk" />
                            ) : (
                                <View style={[styles.profilePic, styles.profilePlaceholder]}>
                                    <Ionicons name="person-outline" size={22} color={colors.secondaryText} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </AnimatedBlock>

            {loading ? (
                <View style={styles.content}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <FlatList
                    ListHeaderComponent={listHeader}
                    data={requests}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
                    ListEmptyComponent={listEmpty}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    initialNumToRender={10}
                    maxToRenderPerBatch={5}
                    windowSize={11}
                />
            )}
        </SafeAreaView>
    );
};

export default memo(DriverHomeScreen);