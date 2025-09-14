import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Card, Icon } from 'react-native-elements';
import expenseService from '../../services/expenseService';

export default function DebtModal({ visible, onClose, tripId, members }) {
  const [debtSummary, setDebtSummary] = useState(null);
  const [settlementHistory, setSettlementHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchDebtData();
    }
  }, [visible]);

  const fetchDebtData = async () => {
    try {
      setLoading(true);
      const [debtData, history] = await Promise.all([
        expenseService.getDebtSummary(tripId),
        expenseService.getSettlementHistory(tripId)
      ]);
      setDebtSummary(debtData);
      setSettlementHistory(history || []);
    } catch (error) {
      console.error('Error fetching debt data:', error);
      Alert.alert('Error', 'Failed to load debt information');
    } finally {
      setLoading(false);
    }
  };

  const handleSettleDebt = (settlement) => {
    Alert.alert(
      'Settle Debt',
      `Mark that ${settlement.fromName} has paid ${settlement.toName} $${settlement.amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Settled',
          onPress: async () => {
            try {
              await expenseService.settleDebt(
                tripId,
                settlement.from,
                settlement.to,
                settlement.amount
              );
              await fetchDebtData();
              Alert.alert('Success', 'Debt marked as settled');
            } catch (error) {
              Alert.alert('Error', 'Failed to settle debt');
            }
          }
        }
      ]
    );
  };

  const renderDebtItem = (debt, isCredit = false) => {
    const member = members.find(m => m.user_id === debt.userId);
    return (
      <View key={debt.userId} style={styles.debtItem}>
        <View style={styles.debtInfo}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {(member?.profiles?.full_name || member?.profiles?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.debtDetails}>
            <Text style={styles.debtName}>
              {member?.profiles?.full_name || member?.profiles?.username}
            </Text>
            <Text style={styles.debtSubtext}>
              {isCredit ? 'Should receive' : 'Owes'}
            </Text>
          </View>
        </View>
        <View style={styles.debtAmount}>
          <Text style={[
            styles.amountText,
            isCredit ? styles.creditAmount : styles.debtAmountText
          ]}>
            {isCredit ? '+' : '-'}${debt.balance.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  const renderSettlementItem = (settlement) => {
    return (
      <View key={settlement.id} style={styles.settlementItem}>
        <View style={styles.settlementInfo}>
          <Text style={styles.settlementText}>
            <Text style={styles.settlementFrom}>{settlement.fromName}</Text>
            {' paid '}
            <Text style={styles.settlementTo}>{settlement.toName}</Text>
          </Text>
          <Text style={styles.settlementAmount}>
            ${settlement.amount.toFixed(2)}
          </Text>
        </View>
        <Text style={styles.settlementDate}>
          {new Date(settlement.settled_at).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Debt Management</Text>
          <TouchableOpacity onPress={fetchDebtData} disabled={loading}>
            <Icon name="refresh" type="material" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading debt information...</Text>
            </View>
          ) : (
            <>
              {/* Summary Cards */}
              <View style={styles.summaryContainer}>
                <Card containerStyle={[styles.summaryCard, styles.debtCard]}>
                  <View style={styles.summaryHeader}>
                    <Icon name="trending-down" type="material" size={24} color="#FF3B30" />
                    <Text style={styles.summaryTitle}>Total Debt</Text>
                  </View>
                  <Text style={styles.summaryAmount}>
                    ${debtSummary?.totalDebt?.toFixed(2) || '0.00'}
                  </Text>
                </Card>

                <Card containerStyle={[styles.summaryCard, styles.creditCard]}>
                  <View style={styles.summaryHeader}>
                    <Icon name="trending-up" type="material" size={24} color="#34C759" />
                    <Text style={styles.summaryTitle}>Total Credit</Text>
                  </View>
                  <Text style={styles.summaryAmount}>
                    ${debtSummary?.totalCredit?.toFixed(2) || '0.00'}
                  </Text>
                </Card>
              </View>

              {/* Suggested Settlements */}
              {debtSummary?.settlements && debtSummary.settlements.length > 0 && (
                <Card containerStyle={styles.card}>
                  <View style={styles.cardHeader}>
                    <Icon name="lightbulb-outline" type="material" size={20} color="#FF9500" />
                    <Text style={styles.cardTitle}>Suggested Settlements</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    These are the optimal payments to settle all debts
                  </Text>
                  
                  {debtSummary.settlements.map((settlement, index) => (
                    <View key={index} style={styles.settlementSuggestion}>
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionText}>
                          <Text style={styles.suggestionFrom}>{settlement.fromName}</Text>
                          {' should pay '}
                          <Text style={styles.suggestionTo}>{settlement.toName}</Text>
                        </Text>
                        <Text style={styles.suggestionAmount}>
                          ${settlement.amount.toFixed(2)}
                        </Text>
                      </View>
                      <Button
                        title="Mark as Settled"
                        buttonStyle={styles.settleButton}
                        onPress={() => handleSettleDebt(settlement)}
                        icon={<Icon name="check" type="material" size={16} color="white" />}
                      />
                    </View>
                  ))}
                </Card>
              )}

              {/* Debts and Credits */}
              <View style={styles.debtsCreditsContainer}>
                {debtSummary?.debts && debtSummary.debts.length > 0 && (
                  <Card containerStyle={styles.card}>
                    <View style={styles.cardHeader}>
                      <Icon name="person-remove" type="material" size={20} color="#FF3B30" />
                      <Text style={styles.cardTitle}>Who Owes Money</Text>
                    </View>
                    {debtSummary.debts.map(debt => renderDebtItem(debt, false))}
                  </Card>
                )}

                {debtSummary?.credits && debtSummary.credits.length > 0 && (
                  <Card containerStyle={styles.card}>
                    <View style={styles.cardHeader}>
                      <Icon name="person-add" type="material" size={20} color="#34C759" />
                      <Text style={styles.cardTitle}>Who Should Receive Money</Text>
                    </View>
                    {debtSummary.credits.map(credit => renderDebtItem(credit, true))}
                  </Card>
                )}
              </View>

              {/* Settlement History */}
              {settlementHistory.length > 0 && (
                <Card containerStyle={styles.card}>
                  <View style={styles.cardHeader}>
                    <Icon name="history" type="material" size={20} color="#8E8E93" />
                    <Text style={styles.cardTitle}>Settlement History</Text>
                  </View>
                  {settlementHistory.map(settlement => renderSettlementItem(settlement))}
                </Card>
              )}

              {/* Empty State */}
              {(!debtSummary || (debtSummary.debts.length === 0 && debtSummary.credits.length === 0)) && (
                <View style={styles.emptyState}>
                  <Icon name="account-balance" type="material" size={64} color="#C7C7CC" />
                  <Text style={styles.emptyText}>No debts to settle</Text>
                  <Text style={styles.emptySubtext}>All expenses are balanced</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
  },
  debtCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  creditCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  settlementSuggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
  },
  suggestionFrom: {
    fontWeight: '600',
    color: '#FF3B30',
  },
  suggestionTo: {
    fontWeight: '600',
    color: '#34C759',
  },
  suggestionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  settleButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  debtsCreditsContainer: {
    marginBottom: 16,
  },
  debtItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  debtInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  debtDetails: {
    flex: 1,
  },
  debtName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  debtSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  debtAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  debtAmountText: {
    color: '#FF3B30',
  },
  creditAmount: {
    color: '#34C759',
  },
  settlementItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settlementInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  settlementText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  settlementFrom: {
    fontWeight: '600',
    color: '#FF3B30',
  },
  settlementTo: {
    fontWeight: '600',
    color: '#34C759',
  },
  settlementAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  settlementDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
