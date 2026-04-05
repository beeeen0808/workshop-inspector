import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { machineApi } from '../src/services/api';

export default function NewMachine() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'woodworking' | 'metalworking'>('woodworking');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a machine name');
      return;
    }

    setLoading(true);
    try {
      const machine = await machineApi.create({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
      });
      router.replace(`/machine/${machine.machine_id}`);
    } catch (error) {
      Alert.alert('Error', 'Could not create machine. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Machine</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Machine Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Table Saw #1"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryButtons}>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  category === 'woodworking' && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory('woodworking')}
              >
                <Ionicons
                  name="hammer"
                  size={22}
                  color={category === 'woodworking' ? '#fff' : '#f59e0b'}
                />
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === 'woodworking' && styles.categoryButtonTextActive,
                  ]}
                >
                  Woodworking
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  category === 'metalworking' && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory('metalworking')}
              >
                <Ionicons
                  name="cog"
                  size={22}
                  color={category === 'metalworking' ? '#fff' : '#6366f1'}
                />
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === 'metalworking' && styles.categoryButtonTextActive,
                  ]}
                >
                  Metalworking
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Optional description of the machine"
              placeholderTextColor="#64748b"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Workshop A, Bay 3"
              placeholderTextColor="#64748b"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <TouchableOpacity
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle" size={22} color="#fff" />
                <Text style={styles.createButtonText}>Create Machine</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    fontSize: 16,
    color: '#f8fafc',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryButtonText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
