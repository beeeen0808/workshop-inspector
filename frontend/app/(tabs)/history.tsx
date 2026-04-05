import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inspectionApi } from '../../src/services/api';
import { Inspection } from '../../src/types';

export default function HistoryScreen() {
  const router = useRouter();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInspections = async () => {
    try {
      const data = await inspectionApi.getAll(undefined, 100);
      setInspections(data);
    } catch (error) {
      console.log('Error loading inspections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInspections();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInspections();
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

  const getPassCount = (responses: any[]) => {
    return responses.filter(r => r.response === 'yes' || r.response === 'Good').length;
  };

  const renderInspection = ({ item }: { item: Inspection }) => {
    const passCount = getPassCount(item.check_responses);
    const totalCount = item.check_responses.length;
    const passRate = totalCount > 0 ? (passCount / totalCount) * 100 : 0;
    const statusColor = passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444';

    return (
      <TouchableOpacity
        style={styles.inspectionCard}
        onPress={() => router.push(`/inspection-detail/${item.inspection_id}`)}
      >
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Ionicons
            name={passRate >= 80 ? 'checkmark-circle' : passRate >= 50 ? 'alert-circle' : 'close-circle'}
            size={24}
            color={statusColor}
          />
        </View>
        <View style={styles.inspectionInfo}>
          <Text style={styles.machineName}>{item.machine_name}</Text>
          <Text style={styles.templateName}>{item.template_name || 'Custom Inspection'}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color="#64748b" />
            <Text style={styles.metaText}>{item.inspector_name}</Text>
            <Ionicons name="time-outline" size={12} color="#64748b" style={{ marginLeft: 12 }} />
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={[styles.score, { color: statusColor }]}>{Math.round(passRate)}%</Text>
          <Text style={styles.scoreLabel}>Pass</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : inspections.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={64} color="#334155" />
          <Text style={styles.emptyText}>No inspections yet</Text>
          <Text style={styles.emptySubtext}>Scan a machine QR code to start an inspection</Text>
        </View>
      ) : (
        <FlatList
          data={inspections}
          renderItem={renderInspection}
          keyExtractor={(item) => item.inspection_id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  inspectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  inspectionInfo: {
    flex: 1,
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  templateName: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  scoreContainer: {
    alignItems: 'center',
    marginLeft: 12,
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
    textAlign: 'center',
  },
});
