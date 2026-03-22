/**
 * HomeScreen (Mobile)
 * Create a new room or join with a room code
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SERVER_URL = 'http://localhost:5000'; // Change to your server IP

export default function HomeScreen({ navigation }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/rooms/new`);
      const data = await response.json();
      navigation.navigate('Room', {
        roomId: data.roomId,
        userName: name.trim(),
      });
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }
    if (!roomCode.trim()) {
      Alert.alert('Room code required', 'Please enter a room ID or link.');
      return;
    }

    // Extract room ID from link if needed
    let roomId = roomCode.trim();
    const match = roomId.match(/\/room\/([^/?#]+)/);
    if (match) roomId = match[1];

    navigation.navigate('Room', { roomId, userName: name.trim() });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.header}>
            <Text style={styles.logoEmoji}>📹</Text>
            <Text style={styles.logoText}>ROKO App</Text>
            <Text style={styles.tagline}>Video calls for everyone</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Name input */}
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#555d73"
              value={name}
              onChangeText={setName}
              maxLength={30}
              autoCorrect={false}
            />

            {/* Create meeting */}
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={handleCreateRoom}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.btnPrimaryIcon}>+</Text>
                  <Text style={styles.btnPrimaryText}>New meeting</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or join with code</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Join room */}
            <TextInput
              style={styles.input}
              placeholder="Room code or link"
              placeholderTextColor="#555d73"
              value={roomCode}
              onChangeText={setRoomCode}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.btnSecondary, !roomCode.trim() && styles.btnDisabled]}
              onPress={handleJoinRoom}
              disabled={!roomCode.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.btnSecondaryText}>Join meeting</Text>
            </TouchableOpacity>
          </View>

          {/* Features */}
          <View style={styles.features}>
            {[
              ['🔒', 'Encrypted'],
              ['⚡', 'Low latency'],
              ['📱', 'Mobile first'],
              ['🌐', 'No install'],
            ].map(([icon, label]) => (
              <View key={label} style={styles.featureChip}>
                <Text style={styles.featureIcon}>{icon}</Text>
                <Text style={styles.featureLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Header
  header: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 48, marginBottom: 8 },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f0f2f8',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#8b92a8',
    marginTop: 6,
  },

  // Card
  card: {
    backgroundColor: '#181c27',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b92a8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#1e2333',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#f0f2f8',
    marginBottom: 16,
  },

  // Primary button
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f8ef7',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    gap: 8,
  },
  btnPrimaryIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 22,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Secondary button
  btnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e2333',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 15,
  },
  btnSecondaryText: {
    color: '#4f8ef7',
    fontSize: 15,
    fontWeight: '600',
  },

  btnDisabled: { opacity: 0.5 },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText: { color: '#555d73', fontSize: 12 },

  // Features
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#181c27',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featureIcon: { fontSize: 13 },
  featureLabel: { fontSize: 12, color: '#8b92a8' },
});
