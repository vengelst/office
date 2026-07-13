import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth-context';

export default function DashboardScreen() {
  const { worker, logout } = useAuth();

  if (!worker) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Willkommen,</Text>
          <Text style={styles.name}>
            {worker.firstName} {worker.lastName}
          </Text>
        </View>
        <Text style={styles.workerNumber}>#{worker.workerNumber}</Text>
      </View>

      <View style={styles.clockSection}>
        <TouchableOpacity style={styles.clockButton} activeOpacity={0.8}>
          <Text style={styles.clockButtonText}>Einstempeln</Text>
          <Text style={styles.clockButtonHint}>
            Phase 2 – Zeiterfassung kommt bald
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Zugewiesene Projekte</Text>
        <ScrollView style={styles.projectList}>
          {worker.assignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Keine Projekte zugewiesen</Text>
            </View>
          ) : (
            worker.assignments.map((assignment) => (
              <View key={assignment.id} style={styles.projectCard}>
                <View style={styles.projectHeader}>
                  <Text style={styles.projectNumber}>
                    {assignment.project.projectNumber}
                  </Text>
                  {assignment.isLead && (
                    <View style={styles.leadBadge}>
                      <Text style={styles.leadBadgeText}>Leitung</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.projectTitle}>
                  {assignment.project.title}
                </Text>
                {assignment.project.customer && (
                  <Text style={styles.projectCustomer}>
                    {assignment.project.customer.companyName}
                  </Text>
                )}
                {assignment.roleName && (
                  <Text style={styles.projectRole}>{assignment.roleName}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={logout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#9ca3af',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    marginTop: 2,
  },
  workerNumber: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  clockSection: {
    marginBottom: 24,
  },
  clockButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  clockButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  clockButtonHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  section: {
    flex: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 12,
  },
  projectList: {
    flex: 1,
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  projectCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  projectNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  leadBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  leadBadgeText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f9fafb',
    marginBottom: 2,
  },
  projectCustomer: {
    fontSize: 13,
    color: '#9ca3af',
  },
  projectRole: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
});
