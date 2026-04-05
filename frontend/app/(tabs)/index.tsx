import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { machineApi } from '../../src/services/api';
import { Machine } from '../../src/types';

export default function MachinesScreen() {
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const loadMachines = async () => {
    try {
      const data = await machineApi.getAll(filter || undefined);
      setMachines(data);
    } catch (error) {
      console.log('Error loading machines:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMachines();
    }, [filter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadMachines();
  };

  const getCategoryIcon = (category: string) => {
    return category === 'woodworking' ? 'hammer' : 'cog';
  };

  const getCategoryColor = (category: string) => {
    return category === 'woodworking' ? '#f59e0b' : '#6366f1';
  };

  const renderMachine = ({ item }: { item: Machine }) => (
    <TouchableOpacity
      style={styles.machineCard}
      onPress={() => router.push(`/machine/${item.machine_id}`)}
    >
      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
        <Ionicons name={getCategoryIcon(item.category) as any} size={24} color={getCategoryColor(item.category)} />
      </View>
      <View style={styles.machineInfo}>
        <Text style={styles.machineName}>{item.name}</Text>
        <Text style={styles.machineCategory}>{item.category}</Text>
        {item.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Machines</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/new-machine')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, !filter && styles.filterButtonActive]}
          onPress={() => setFilter(null)}
        >
          <Text style={[styles.filterText, !filter && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'woodworking' && styles.filterButtonActive]}
          onPress={() => setFilter('woodworking')}
        >
          <Ionicons name="hammer" size={16} color={filter === 'woodworking' ? '#fff' : '#f59e0b'} />
          <Text style={[styles.filterText, filter === 'woodworking' && styles.filterTextActive]}>Woodworking</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'metalworking' && styles.filterButtonActive]}
          onPress={() => setFilter('metalworking')}
        >
          <Ionicons name="cog" size={16} color={filter === 'metalworking' ? '#fff' : '#6366f1'} />
          <Text style={[styles.filterText, filter === 'metalworking' && styles.filterTextActive]}>Metalworking</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : machines.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="construct-outline" size={64} color="#334155" />
          <Text style={styles.emptyText}>No machines added yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first machine</Text>
        </View>
      ) : (
        <FlatList
          data={machines}
          renderItem={renderMachine}
          keyExtractor={(item) => item.machine_id}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  machineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  machineInfo: {
    flex: 1,
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  machineCategory: {
    fontSize: 14,
    color: '#94a3b8',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#64748b',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
});
