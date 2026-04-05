import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { machineApi, inspectionApi, templateApi } from '../../src/services/api';
import { Machine, Inspection, ChecklistTemplate } from '../../src/types';

export default function MachineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    loadMachine();
  }, [id]);

  const loadMachine = async () => {
    try {
      const [machineData, inspectionsData, allInspectionsData, templatesData] = await Promise.all([
        machineApi.getById(id!),
        inspectionApi.getByMachine(id!, 5),
        inspectionApi.getByMachine(id!, 1000), // Get all for export
        templateApi.getAll(),
      ]);
      setMachine(machineData);
      setInspections(inspectionsData);
      setAllInspections(allInspectionsData);
      setTemplates(templatesData);
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

  const setDefaultTemplate = async (templateId: string | null) => {
    try {
      await machineApi.update(id!, { default_template_id: templateId } as any);
      setMachine(prev => prev ? { ...prev, default_template_id: templateId || undefined } : null);
      setShowTemplateModal(false);
      Alert.alert('Success', templateId ? 'Default checklist set' : 'Default checklist removed');
    } catch (error) {
      Alert.alert('Error', 'Could not update default checklist');
    }
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

  const formatDateForFilename = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const getCategoryColor = (category: string) => {
    return category === 'woodworking' ? '#f59e0b' : '#6366f1';
  };

  const getStatusColor = (response?: string) => {
    if (!response) return '#64748b';
    if (response === 'yes' || response === 'Good') return '#10b981';
    if (response === 'no' || response === 'Poor' || response === 'Damaged') return '#ef4444';
    return '#f59e0b';
  };

  const generateAllInspectionsPDF = () => {
    if (!machine || allInspections.length === 0) return '';

    const inspectionsHtml = allInspections.map((inspection, idx) => {
      const passCount = inspection.check_responses.filter(
        r => r.response === 'yes' || r.response === 'Good'
      ).length;
      const total = inspection.check_responses.length;
      const passRate = total > 0 ? (passCount / total) * 100 : 0;
      const overallColor = passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444';

      const checksHtml = inspection.check_responses.map((check, i) => {
        const statusColor = getStatusColor(check.response);
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">${i + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">${check.text}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: ${statusColor}; font-weight: 500;">${check.response || '-'}</td>
          </tr>
        `;
      }).join('');

      return `
        <div style="page-break-inside: avoid; margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div>
              <h3 style="margin: 0; color: #1e293b; font-size: 16px;">Inspection #${idx + 1}</h3>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">${formatDate(inspection.created_at)}</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Inspector: ${inspection.inspector_name}</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Checklist: ${inspection.template_name || 'Custom'}</p>
            </div>
            <div style="padding: 10px 15px; background: ${overallColor}20; border-radius: 8px; text-align: center;">
              <span style="font-size: 18px; font-weight: bold; color: ${overallColor};">${Math.round(passRate)}%</span>
              <br/><span style="font-size: 10px; color: #64748b;">Pass Rate</span>
            </div>
          </div>
          
          ${inspection.check_responses.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
              <thead>
                <tr style="background: #e2e8f0;">
                  <th style="padding: 8px; text-align: left; font-size: 11px; width: 30px;">#</th>
                  <th style="padding: 8px; text-align: left; font-size: 11px;">Check Item</th>
                  <th style="padding: 8px; text-align: left; font-size: 11px; width: 100px;">Response</th>
                </tr>
              </thead>
              <tbody>${checksHtml}</tbody>
            </table>
          ` : ''}
          
          ${inspection.text_notes ? `
            <div style="background: white; padding: 10px; border-radius: 4px; margin-top: 10px;">
              <strong style="font-size: 11px; color: #64748b;">Notes:</strong>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;">${inspection.text_notes}</p>
            </div>
          ` : ''}
          
          ${inspection.photo_notes && inspection.photo_notes.length > 0 ? `
            <p style="font-size: 11px; color: #64748b; margin-top: 10px;">📷 ${inspection.photo_notes.length} photo(s) attached</p>
          ` : ''}
          
          ${inspection.voice_notes && inspection.voice_notes.length > 0 ? `
            <p style="font-size: 11px; color: #64748b; margin-top: 5px;">🎤 ${inspection.voice_notes.length} voice note(s) recorded</p>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>All Inspections - ${machine.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; padding: 30px; }
            .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6; }
            .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
            h1 { font-size: 28px; margin-top: 10px; }
            .meta { color: #64748b; font-size: 14px; margin-top: 5px; }
            .summary { display: flex; gap: 20px; margin-bottom: 30px; }
            .summary-card { flex: 1; background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
            .summary-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
            .summary-label { font-size: 12px; color: #64748b; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🔧 Machine Inspector</div>
            <h1>${machine.name}</h1>
            <p class="meta">${machine.category} • ${machine.location || 'No location set'}</p>
            <p class="meta">Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-value">${allInspections.length}</div>
              <div class="summary-label">Total Inspections</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${allInspections.length > 0 ? formatDateForFilename(allInspections[allInspections.length - 1].created_at) : '-'}</div>
              <div class="summary-label">First Inspection</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${allInspections.length > 0 ? formatDateForFilename(allInspections[0].created_at) : '-'}</div>
              <div class="summary-label">Latest Inspection</div>
            </div>
          </div>

          <h2 style="margin-bottom: 20px; color: #334155;">Inspection History</h2>
          ${inspectionsHtml}

          <div class="footer">
            <p>Machine Inspector - Complete Inspection Log</p>
            <p>${machine.name} • ${allInspections.length} inspection(s)</p>
          </div>
        </body>
      </html>
    `;
  };

  const exportAllInspections = async () => {
    if (!machine) return;
    
    if (allInspections.length === 0) {
      Alert.alert('No Inspections', 'There are no inspections to export for this machine.');
      return;
    }

    setExporting(true);
    try {
      const html = generateAllInspectionsPDF();
      
      if (Platform.OS === 'web') {
        // For web: Open print dialog which allows saving as PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        } else {
          Alert.alert('Error', 'Please allow pop-ups to export PDF');
        }
      } else {
        // For mobile: Use expo-print and expo-sharing
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });

        const fileName = `${machine.name.replace(/[^a-zA-Z0-9]/g, '_')}_All_Inspections_${new Date().toISOString().split('T')[0]}.pdf`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.moveAsync({
          from: uri,
          to: newUri,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Export All Inspections',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Success', `PDF saved to: ${newUri}`);
        }
      }
    } catch (error) {
      console.log('Export error:', error);
      Alert.alert('Error', 'Could not export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getDefaultTemplateName = () => {
    if (!machine?.default_template_id) return 'None set';
    const template = templates.find(t => t.template_id === machine.default_template_id);
    return template?.name || 'Unknown';
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

        {/* Default Template Setting */}
        <TouchableOpacity style={styles.settingCard} onPress={() => setShowTemplateModal(true)}>
          <View style={styles.settingIcon}>
            <Ionicons name="clipboard" size={22} color="#3b82f6" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Default Checklist</Text>
            <Text style={styles.settingValue}>{getDefaultTemplateName()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>

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

        {/* Download All Inspections Button */}
        <TouchableOpacity
          style={[styles.downloadAllButton, exporting && styles.buttonDisabled]}
          onPress={exportAllInspections}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <>
              <Ionicons name="download-outline" size={22} color="#3b82f6" />
              <View style={styles.downloadAllContent}>
                <Text style={styles.downloadAllTitle}>Download All Logs</Text>
                <Text style={styles.downloadAllSubtitle}>{allInspections.length} inspection(s) as PDF</Text>
              </View>
            </>
          )}
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

      {/* Template Selection Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Default Checklist</Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <Ionicons name="close" size={24} color="#f8fafc" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={[styles.templateOption, !machine.default_template_id && styles.templateOptionActive]}
                onPress={() => setDefaultTemplate(null)}
              >
                <Ionicons name="remove-circle-outline" size={22} color="#64748b" />
                <Text style={styles.templateOptionText}>No default (choose each time)</Text>
                {!machine.default_template_id && (
                  <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                )}
              </TouchableOpacity>
              {templates
                .filter(t => t.category === machine.category || t.category === 'general')
                .map((template) => (
                  <TouchableOpacity
                    key={template.template_id}
                    style={[styles.templateOption, machine.default_template_id === template.template_id && styles.templateOptionActive]}
                    onPress={() => setDefaultTemplate(template.template_id)}
                  >
                    <Ionicons name="clipboard-outline" size={22} color="#3b82f6" />
                    <View style={styles.templateOptionInfo}>
                      <Text style={styles.templateOptionText}>{template.name}</Text>
                      <Text style={styles.templateOptionMeta}>{template.check_items.length} checks</Text>
                    </View>
                    {machine.default_template_id === template.template_id && (
                      <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    marginBottom: 16,
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#94a3b8',
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3b82f620',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f8fafc',
  },
  settingValue: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
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
    marginBottom: 12,
  },
  inspectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  downloadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  downloadAllContent: {
    flex: 1,
    marginLeft: 12,
  },
  downloadAllTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  downloadAllSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 12,
  },
  templateOptionActive: {
    backgroundColor: '#10b98110',
  },
  templateOptionInfo: {
    flex: 1,
  },
  templateOptionText: {
    fontSize: 16,
    color: '#f8fafc',
  },
  templateOptionMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
});
