import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
  Platform, KeyboardAvoidingView, Modal, Pressable
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import polyline from '@mapbox/polyline';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../provider/AuthContext';
import Logo from '../../assets/icon.svg';
import { MotiView } from 'moti';

const CURRENCIES = ['UAH', 'USD', 'EUR'];
const HEADER_HEIGHT = Platform.select({ ios: 85, android: 100 });
const MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const InfoRow = memo(({ icon, label, value, colors, valueStyle }) => {
  const styles = getStyles(colors);
  if (!value && value !== 0) return null;
  return (
    <View style={styles.infoRowContainer}>
      <Ionicons name={icon} size={24} color={colors.secondaryText} style={styles.infoRowIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        {React.isValidElement(value)
          ? value
          : <Text style={[styles.infoRowValue, valueStyle]}>{value}</Text>}
      </View>
    </View>
  );
});

const DetailItem = memo(({ icon, value, label, colors }) => {
  const styles = getStyles(colors);
  if (!value) return null;
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={24} color={colors.secondaryText} />
      <Text style={styles.detailValue}>{value}</Text>
      {label && <Text style={styles.detailLabel}>{label}</Text>}
    </View>
  );
});

const OtherDriverOffer = memo(({ offer, isChosen, onPress }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const displayPrice = `${offer.price} ${offer.currency || 'UAH'}`;

  const handlePress = useCallback(() => {
    onPress(offer.driver_id);
  }, [onPress, offer.driver_id]);

  return (
    <TouchableOpacity
      style={[styles.otherOfferRow, isChosen && styles.chosenOffer]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Image
        source={
          offer.driver_avatar_url
            ? { uri: offer.driver_avatar_url }
            : require('../../assets/default-avatar.png')
        }
        style={styles.otherOfferAvatar}
        contentFit="cover"
        transition={300}
        cachePolicy="disk"
      />
      <Text style={[styles.otherOfferName, isChosen && styles.chosenOfferText]} numberOfLines={1}>
        {offer.driver_name}
      </Text>
      <Text style={[styles.otherOfferPrice, isChosen && styles.chosenOfferText]}>
        {displayPrice}
      </Text>
      {isChosen && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} style={{ marginLeft: 8 }} />
      )}
    </TouchableOpacity>
  );
});

const SubmitOfferModal = memo(({ visible, onClose, onSubmit, isSubmitting }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { t } = useTranslation();
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [currency, setCurrency] = useState('UAH');

  useEffect(() => {
    if (visible) {
      setPrice('');
      setComment('');
      setCurrency('UAH');
    }
  }, [visible]);

  const handlePressSubmit = useCallback(() => {
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      Alert.alert(t('common.error'), t('driverOffer.priceRequired'));
      return;
    }
    onSubmit({ price: parseFloat(price), comment, currency });
  }, [price, comment, currency, onSubmit, t]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('driverOffer.yourOffer')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                <Ionicons name="close-circle" size={28} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <View style={styles.priceInputContainer}>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor={colors.secondaryText}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>

            <View style={styles.currencySelector}>
              {CURRENCIES.map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[
                    styles.currencyButton,
                    { backgroundColor: currency === curr ? colors.primary : colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => setCurrency(curr)}
                >
                  <Text style={[styles.currencyButtonText, { color: currency === curr ? '#fff' : colors.text }]}>
                    {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.commentInput}
              placeholder={t('driverOffer.commentPlaceholder')}
              placeholderTextColor={colors.secondaryText}
              value={comment}
              onChangeText={setComment}
              multiline
            />

            <TouchableOpacity style={styles.submitButton} onPress={handlePressSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.submitButtonText}>{t('driverOffer.submitButton')}</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const RouteMap = memo(({ routeCoordinates, fromLabel, toLabel, strokeColor }) => {
  const mapRef = useRef(null);

  const handleMapReady = useCallback(() => {
    if (mapRef.current && routeCoordinates.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoordinates, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: false,
        });
      }, 300);
    }
  }, [routeCoordinates]);

  if (!routeCoordinates.length) return null;

  const origin = routeCoordinates[0];
  const destination = routeCoordinates[routeCoordinates.length - 1];

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      onMapReady={handleMapReady}
      initialRegion={{
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      }}
      moveOnMarkerPress={false}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      <Marker coordinate={origin} title={fromLabel} pinColor="green" />
      <Marker coordinate={destination} title={toLabel} pinColor="red" />
      <Polyline
        coordinates={routeCoordinates}
        strokeColor={strokeColor}
        strokeWidth={5}
      />
    </MapView>
  );
});

export default function DriverRequestDetailScreen({ navigation, route }) {
  const transferId = route.params?.transferId || route.params?.id;
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { t, i18n } = useTranslation();
  const { session } = useAuth();

  const [transferData, setTransferData] = useState(null);
  const [allOffers, setAllOffers] = useState([]);
  const [hasAlreadyOffered, setHasAlreadyOffered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [routeError, setRouteError] = useState(false);

  const fetchRoute = useCallback(async (origin, destination) => {
    try {
      setRouteError(false);
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${MAPS_API_KEY}&language=${i18n.language}`;
      const response = await fetch(url);
      const json = await response.json();

      if (json.routes?.length > 0) {
        const r = json.routes[0];
        const points = polyline.decode(r.overview_polyline.points);
        setRouteCoordinates(points.map(([lat, lng]) => ({ latitude: lat, longitude: lng })));
        if (r.legs?.length > 0) {
          setRouteInfo({
            distance: r.legs[0].distance.text,
            duration: r.legs[0].duration.text,
          });
        }
      } else {
        setRouteError(true);
      }
    } catch (error) {
      setRouteError(true);
    }
  }, [i18n.language]);

  const fetchData = useCallback(async () => {
    if (!session?.user || !transferId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .rpc('get_driver_request_details', { p_transfer_id: transferId })
        .single();
      if (error) throw error;

      if (data) {
        setTransferData(data);
        const offers = data.all_offers || [];
        setAllOffers(offers);
        setHasAlreadyOffered(offers.some((o) => o.driver_id === session.user.id));
        fetchRoute(data.from_location, data.to_location);
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  }, [transferId, session, t, fetchRoute]);

  useEffect(() => {
    if (transferId) {
      supabase.rpc('mark_transfer_as_viewed', { p_transfer_id: transferId })
        .then(({ error }) => { if (error) console.error(error.message); });
    }
  }, [transferId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmitOffer = useCallback(async ({ price, comment, currency }) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('submit-offer-and-notify', {
        body: { transfer_id: transferId, price, driver_comment: comment, currency },
      });
      if (error) throw error;

      setIsModalVisible(false);
      Alert.alert(t('common.success'), t('driverOffer.offerSent'));
      fetchData();
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [transferId, t, fetchData]);

  const handleOtherDriverPress = useCallback((driverId) => {
    navigation.navigate('PublicDriverProfile', { driverId });
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-circle" size={40} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('driverOffer.requestDetails')}</Text>
          <Logo width={40} height={40} />
        </View>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!transferData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-circle" size={40} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('driverOffer.requestDetails')}</Text>
          <Logo width={40} height={40} />
        </View>
        <View style={styles.centeredContainer}>
          <Text style={styles.sectionTitle}>{t('transferDetail.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRequestClosed =
    transferData?.status === 'accepted' ||
    transferData?.status === 'completed' ||
    transferData?.status === 'cancelled';

  const isOldAndAccepted =
    transferData?.status === 'accepted' &&
    moment(transferData.transfer_datetime).isBefore(moment().subtract(2, 'days'));

  return (
    <SafeAreaView style={styles.container}>
      <SubmitOfferModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSubmit={handleSubmitOffer}
        isSubmitting={isSubmitting}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-circle" size={40} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('driverOffer.requestDetails')}</Text>
        <Logo width={40} height={40} />
      </View>

      {(transferData?.status === 'completed' || transferData?.status === 'cancelled') && (
        <View style={[
          styles.statusBanner,
          transferData.status === 'completed' ? styles.completedBanner : styles.cancelledBanner,
        ]}>
          <Ionicons
            name={transferData.status === 'completed' ? 'checkmark-circle-outline' : 'close-circle-outline'}
            size={24}
            color={transferData.status === 'completed' ? '#2E7D32' : '#D32F2F'}
          />
          <Text style={[
            styles.statusBannerText,
            transferData.status === 'completed' ? styles.completedBannerText : styles.cancelledBannerText,
          ]}>
            {t(`transferDetail.${transferData.status}`)}
          </Text>
        </View>
      )}

      {isOldAndAccepted && (
        <View style={[styles.statusBanner, styles.completedBanner]}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#2E7D32" />
          <Text style={[styles.statusBannerText, styles.completedBannerText]}>
            {t('transferDetail.completed')}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={HEADER_HEIGHT}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
          >
            <View style={styles.userInfoSection}>
              <Image
                source={
                  transferData?.passenger_avatar_url
                    ? { uri: transferData.passenger_avatar_url }
                    : require('../../assets/default-avatar.png')
                }
                style={styles.userAvatar}
                contentFit="cover"
                transition={300}
                cachePolicy="disk"
              />
              <Text style={styles.userName}>{transferData?.passenger_name || '...'}</Text>
              <Text style={styles.memberSince}>
                {t('driverHome.memberSince', {
                  date: moment(transferData?.passenger_created_at).format('ll'),
                })}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <InfoRow
                icon={transferData?.direction === 'from_airport' ? 'airplane-outline' : 'location-outline'}
                label={t('transferDetail.from')}
                value={transferData?.from_location}
                colors={colors}
              />
              <View style={styles.dottedLine} />
              <InfoRow
                icon={transferData?.direction === 'to_airport' ? 'airplane-outline' : 'location-outline'}
                label={t('transferDetail.to')}
                value={transferData?.to_location}
                colors={colors}
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>{t('transferDetail.detailsTitle')}</Text>
              <View style={styles.detailsGrid}>
                <DetailItem icon="calendar-outline" value={moment(transferData?.transfer_datetime).format('D MMM')} colors={colors} />
                <DetailItem icon="time-outline" value={moment(transferData?.transfer_datetime).format('HH:mm')} colors={colors} />
                <DetailItem icon="barcode-outline" value={transferData?.flight_number} label={t('transferDetail.flightNumber')} colors={colors} />
              </View>
              <View style={styles.divider} />
              <View style={styles.passengerDetailsContainer}>
                {transferData.adults_count > 0 && (
                  <View style={styles.passengerDetailItem}>
                    <Ionicons name="people-outline" size={20} color={colors.text} />
                    <Text style={styles.passengerDetailText}>{transferData.adults_count} {t('transferData.adults_count')}</Text>
                  </View>
                )}
                {transferData.children_count > 0 && (
                  <View style={styles.passengerDetailItem}>
                    <Ionicons name="person-outline" size={20} color={colors.text} />
                    <Text style={styles.passengerDetailText}>{transferData.children_count} {t('transferData.children_count')}</Text>
                  </View>
                )}
                {transferData.infants_count > 0 && (
                  <View style={styles.passengerDetailItem}>
                    <Ionicons name="happy-outline" size={20} color={colors.text} />
                    <Text style={styles.passengerDetailText}>{transferData.infants_count} {t('transferData.infants_count')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.divider} />
              <View style={styles.detailsGrid}>
                <DetailItem icon="briefcase-outline" value={transferData?.luggage_info} label={t('transferDetail.luggage')} colors={colors} />
                <DetailItem icon="paw-outline" value={transferData?.with_pet ? t('common.yes') : null} label={t('transferDetail.withPet')} colors={colors} />
                <DetailItem icon="person-add-outline" value={transferData?.meet_with_sign ? t('common.yes') : null} label={t('home.meetWithSign')} colors={colors} />
                <DetailItem
                  icon="car-sport-outline"
                  value={transferData?.transfer_type === 'individual' ? t('transfersScreen.individual') : t('transfersScreen.group')}
                  label={t('transferDetail.transferType')}
                  colors={colors}
                />
              </View>
            </View>

            {transferData?.passenger_comment && (
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>{t('transferDetail.clientComment')}</Text>
                <Text style={styles.commentText}>"{transferData.passenger_comment}"</Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>{t('transferDetail.route')}</Text>
              <View style={styles.mapContainer}>
                {routeError ? (
                  <View style={styles.mapLoadingContainer}>
                    <Text style={{ color: colors.secondaryText }}>{t('common.error')}</Text>
                  </View>
                ) : routeCoordinates.length > 1 ? (
                  <RouteMap
                    routeCoordinates={routeCoordinates}
                    fromLabel={t('transferDetail.from')}
                    toLabel={t('transferDetail.to')}
                    strokeColor={colors.primary}
                  />
                ) : (
                  <View style={styles.mapLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </View>

              {routeInfo && (
                <View style={styles.routeInfoContainer}>
                  <View style={styles.routeInfoItem}>
                    <Ionicons name="speedometer-outline" size={24} color={colors.secondaryText} />
                    <Text style={styles.routeInfoText}>{routeInfo.distance}</Text>
                  </View>
                  <View style={styles.routeInfoItem}>
                    <Ionicons
                      name={transferData?.direction === 'from_airport' ? 'airplane-outline' : 'business-outline'}
                      size={24}
                      color={colors.secondaryText}
                    />
                    <Text style={styles.routeInfoText}>
                      {transferData?.direction === 'from_airport'
                        ? t('transferDetail.fromAirport')
                        : t('transferDetail.toAirport')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {allOffers.length > 0 && (
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>{t('driverOffer.otherOffersTitle')}</Text>
                {allOffers.map((offer) => (
                  <OtherDriverOffer
                    key={offer.driver_id}
                    offer={offer}
                    isChosen={offer.driver_id === transferData?.accepted_driver_id}
                    onPress={handleOtherDriverPress}
                  />
                ))}
              </View>
            )}

            {!isRequestClosed && !isOldAndAccepted && (
              <View style={styles.offerSection}>
                <Text style={styles.sectionTitle}>
                  {hasAlreadyOffered ? t('driverOffer.alreadyOffered') : t('driverOffer.yourOffer')}
                </Text>
                {hasAlreadyOffered ? (
                  <View style={styles.alreadyOfferedContainer}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    <Text style={styles.alreadyOfferedText}>{t('driverOffer.passengerNotified')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.submitButton} onPress={() => setIsModalVisible(true)}>
                    <Text style={styles.submitButtonText}>{t('driverOffer.makeOfferButton')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  scrollContent: { paddingBottom: 40 },
  userInfoSection: { alignItems: 'center', paddingTop: 16 },
  userAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  userName: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  memberSince: { fontSize: 12, color: colors.secondaryText, marginTop: 4 },
  infoCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginHorizontal: 16, marginTop: 16 },
  infoRowContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  infoRowIcon: { marginRight: 16, width: 24 },
  infoRowLabel: { fontSize: 12, color: colors.secondaryText, marginBottom: 2 },
  infoRowValue: { fontSize: 16, color: colors.text, fontWeight: '500', flexShrink: 1 },
  dottedLine: { height: 16, width: 1, backgroundColor: colors.border, marginVertical: 4, marginLeft: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 12 },
  detailsGrid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  detailItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  detailLabel: { color: colors.secondaryText, fontSize: 12, marginTop: 2, textAlign: 'center' },
  passengerDetailsContainer: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', marginVertical: 8 },
  passengerDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passengerDetailText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  commentText: { color: colors.secondaryText, fontStyle: 'italic', fontSize: 15 },
  mapContainer: { height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.border },
  mapLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card },
  routeInfoContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  routeInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeInfoText: { color: colors.text, fontSize: 16, fontWeight: '500' },
  offerSection: { margin: 16, marginTop: 24 },
  alreadyOfferedContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 12 },
  alreadyOfferedText: { flex: 1, color: colors.text, fontSize: 16 },
  otherOfferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  otherOfferAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  otherOfferName: { flex: 1, color: colors.text, fontSize: 16 },
  otherOfferPrice: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  chosenOffer: { backgroundColor: `${colors.primary}20`, paddingHorizontal: 8, borderRadius: 8 },
  chosenOfferText: { color: colors.primary, fontWeight: 'bold' },
  submitButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  modalCloseButton: { padding: 4 },
  priceInputContainer: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  priceInput: { color: colors.text, fontSize: 48, fontWeight: 'bold', paddingVertical: 16, textAlign: 'center' },
  currencySelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  currencyButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20, borderWidth: 1 },
  currencyButtonText: { fontSize: 16, fontWeight: 'bold' },
  commentInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, height: 100, textAlignVertical: 'top', color: colors.text, fontSize: 16, marginBottom: 16 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginHorizontal: 16, marginTop: 16, borderRadius: 12, borderWidth: 1, gap: 8 },
  completedBanner: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  cancelledBanner: { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' },
  statusBannerText: { fontSize: 16, fontWeight: 'bold' },
  completedBannerText: { color: '#2E7D32' },
  cancelledBannerText: { color: '#D32F2F' },
});