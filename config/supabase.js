import 'react-native-url-polyfill/auto'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cgmcfltbzmbkrvdmmjdu.supabase.co'; // Paste your Project URL here
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbWNmbHRiem1ia3J2ZG1tamR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzY2MDMsImV4cCI6MjA2ODk1MjYwM30.LB33DbDYZHKEERMruZpqXZ0huoDrhkH37hq2a2BuCaE'; // Paste your anon key here

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, 
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});