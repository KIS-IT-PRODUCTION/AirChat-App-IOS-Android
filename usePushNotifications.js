import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './config/supabase';
import { useAuth } from './provider/AuthContext';
import { useUnreadCount } from './provider/Unread Count Context';
import { useNewOffers } from './provider/NewOffersContext';
import { useNewTrips } from './provider/NewTripsContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let isNavigating = false;

const handlePushNavigation = (navigationRef, data) => {
  if (isNavigating) return;

  if (navigationRef.current?.isReady()) {
    if (data?.roomId) {
      isNavigating = true;
      navigationRef.current.navigate('IndividualChat', {
        roomId: data.roomId,
        recipientId: data.recipientId,
        recipientName: data.recipientName,
        recipientAvatar: data.recipientAvatar,
        recipientLastSeen: data.recipientLastSeen,
      });
      setTimeout(() => { isNavigating = false; }, 1500);
    } else if (data?.screen === 'DriverRequest' && data?.transferId) {
      isNavigating = true;
      navigationRef.current.navigate('DriverRequest', { id: data.transferId });
      setTimeout(() => { isNavigating = false; }, 1500);
    }
  } else if (!navigationRef.current?.isReady()) {
    setTimeout(() => handlePushNavigation(navigationRef, data), 200);
  }
};

export const usePushNotifications = (navigationRef) => {
  const { session, profile } = useAuth();
  const { fetchUnreadCount } = useUnreadCount();
  const { fetchNewOffersCount } = useNewOffers();
  const { fetchNewTripsCount } = useNewTrips();

  const notificationListener = useRef();
  const responseListener = useRef();
  const hasHandledInitialPush = useRef(false);

  const registerForPushNotificationsAsync = useCallback(async () => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    let token;
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({});
      token = tokenResponse.data;
    } catch (e) {
      console.error('Error fetching Expo Push Token:', e);
      return;
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !profile || !navigationRef) return;

    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        await supabase.from('profiles').update({ expo_push_token: token }).eq('id', session.user.id);
      } else {
        await supabase.from('profiles').update({ expo_push_token: null }).eq('id', session.user.id);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const type = notification.request.content.data?.type;
      if (fetchUnreadCount) fetchUnreadCount();
      if (type === 'new_offer' && profile.role === 'client' && fetchNewOffersCount) fetchNewOffersCount();
      if (type === 'offer_accepted' && profile.role === 'driver' && fetchNewTripsCount) fetchNewTripsCount();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const notificationData = response.notification.request.content.data;
      handlePushNavigation(navigationRef, notificationData);
    });

    if (!hasHandledInitialPush.current) {
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response) {
          const notificationData = response.notification.request.content.data;
          handlePushNavigation(navigationRef, notificationData);
        }
      });
      hasHandledInitialPush.current = true;
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [session, profile, fetchUnreadCount, fetchNewOffersCount, fetchNewTripsCount, navigationRef, registerForPushNotificationsAsync]);

  return {};
};