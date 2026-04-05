import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { machineApi, inspectionApi } from '../../src/services/api';
import { Machine, Inspection } from '../../src/types';

export default function MachineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMachine();
  }, [id]);

  const loadMachine = async () => {
    try {
      const [machineData, inspectionsData] = await Promise.all([
        machineApi.getById(id!),
        inspectionApi.getByMachine(id!, 5),
      ]);
      setMachine(machineData);
      setInspections(inspectionsData);
    } catch (error) {
      Alert.alert('Error', 'Could not load machine details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Machine',
      'Are you sure you want to delete this machine? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await machineApi.delete(id!);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Could not delete machine');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category: string) => {
    return category === 'woodworking' ? '#f59e0b' : '#6366f1';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!machine) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Machine Details</Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.machineHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(machine.category) + '20' }]}>
            <Ionicons
              name={machine.category === 'woodworking' ? 'hammer' : 'cog'}
              size={32}
              color={getCategoryColor(machine.category)}
            />
          </View>
          <Text style={styles.machineName}>{machine.name}</Text>
          <Text style={styles.machineCategory}>{machine.category}</Text>
        </View>

        {machine.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{machine.description}</Text>
          </View>
        )}

        {machine.location && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#64748b" />
            <Text style={styles.infoText}>{machine.location}</Text>
          </View>
        )}

        <View style={styles.qrSection}>
          <Text style={styles.sectionTitle}>QR Code</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={machine.qr_code_data}
              size={200}
              backgroundColor="#fff"
              color="#0f172a"
            />
          </View>
          <Text style={styles.qrHint}>Print and attach this QR code to the machine</Text>
        </View>

        <TouchableOpacity
          style={styles.inspectButton}
          onPress={() => router.push(`/inspection/${machine.machine_id}`)}
        >
          <Ionicons name="clipboard-outline" size={22} color="#fff" />
          <Text style={styles.inspectButtonText}>Start Inspection</Text>
        </TouchableOpacity>

        {inspections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Inspections</Text>
            {inspections.map((inspection) => (
              <TouchableOpacity
                key={inspection.inspection_id}
                style={styles.inspectionItem}
                onPress={() => router.push(`/inspection-detail/${inspection.inspection_id}`)}
              >
                <View style={styles.inspectionInfo}>
                  <Text style={styles.inspectionTemplate}>
                    {inspection.template_name || 'Custom Inspection'}
                  </Text>
                  <Text style={styles.inspectionMeta}>
                    {inspection.inspector_name} • {formatDate(inspection.created_at)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  machineHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  categoryBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  machineName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
  },
  machineCategory: {
    fontSize: 16,
    color: '#94a3b8',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#94a3b8',
  },
  qrSection: {
    marginBottom: 24,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 12,
  },
  qrHint: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  inspectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  inspectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  inspectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  inspectionInfo: {
    flex: 1,
  },
  inspectionTemplate: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f8fafc',
  },
  inspectionMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
});
