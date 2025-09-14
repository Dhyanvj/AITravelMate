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
import { Button, Card, Icon, Input } from 'react-native-elements';
import expenseService from '../../services/expenseService';

export default function BudgetModal({ visible, onClose, tripId, currentUser, onBudgetUpdated }) {
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && currentUser) {
      fetchBudgetSummary();
    }
  }, [visible, currentUser]);

  const fetchBudgetSummary = async () => {
    try {
      setLoading(true);
      const summary = await expenseService.getUserBudgetSummary(tripId, currentUser.id);
      setBudgetSummary(summary);
      setBudgetLimit(summary.budgetLimit.toString());
    } catch (error) {
      console.error('Error fetching budget summary:', error);
      Alert.alert('Error', 'Failed to load budget information');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!budgetLimit || parseFloat(budgetLimit) < 0) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }

    try {
      setSaving(true);
      await expenseService.setUserBudget(tripId, currentUser.id, parseFloat(budgetLimit));
      await fetchBudgetSummary();
      if (onBudgetUpdated) {
        onBudgetUpdated();
      }
      Alert.alert('Success', 'Budget updated successfully');
    } catch (error) {
      console.error('Error saving budget:', error);
      Alert.alert('Error', 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const renderBudgetOverview = () => {
    if (!budgetSummary) return null;

    return (
      <Card containerStyle={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Icon name="account-balance-wallet" type="material" size={24} color="#007AFF" />
          <Text style={styles.overviewTitle}>Budget Overview</Text>
        </View>

        <View style={styles.overviewStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Budget Limit</Text>
            <Text style={styles.statValue}>
              ${budgetSummary.budgetLimit.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={[
              styles.statValue,
              budgetSummary.isOverBudget && styles.overBudgetText
            ]}>
              ${budgetSummary.totalSpent.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Remaining</Text>
            <Text style={[
              styles.statValue,
              budgetSummary.remaining < 0 && styles.overBudgetText
            ]}>
              ${budgetSummary.remaining.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${Math.min(budgetSummary.percentage, 100)}%`,
                  backgroundColor: budgetSummary.isOverBudget ? '#FF3B30' : 
                                 budgetSummary.warningThreshold ? '#FF9500' : '#34C759'
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {budgetSummary.percentage.toFixed(1)}% of budget used
          </Text>
        </View>

        {budgetSummary.warningThreshold && (
          <View style={[
            styles.warningContainer,
            budgetSummary.isOverBudget ? styles.overBudgetWarning : styles.warningAlert
          ]}>
            <Icon 
              name={budgetSummary.isOverBudget ? "error" : "warning"} 
              type="material" 
              size={20} 
              color={budgetSummary.isOverBudget ? "#FF3B30" : "#FF9500"} 
            />
            <Text style={[
              styles.warningText,
              budgetSummary.isOverBudget ? styles.overBudgetWarningText : styles.warningAlertText
            ]}>
              {budgetSummary.isOverBudget 
                ? 'You have exceeded your budget!' 
                : 'You are approaching your budget limit'
              }
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const renderSpendingBreakdown = () => {
    if (!budgetSummary) return null;

    return (
      <Card containerStyle={styles.breakdownCard}>
        <View style={styles.breakdownHeader}>
          <Icon name="pie-chart" type="material" size={20} color="#007AFF" />
          <Text style={styles.breakdownTitle}>Spending Breakdown</Text>
        </View>

        <View style={styles.breakdownItem}>
          <View style={styles.breakdownInfo}>
            <Text style={styles.breakdownLabel}>Shared Expenses</Text>
            <Text style={styles.breakdownDescription}>
              Your portion of group expenses
            </Text>
          </View>
          <Text style={styles.breakdownAmount}>
            ${budgetSummary.sharedTotal.toFixed(2)}
          </Text>
        </View>

        <View style={styles.breakdownItem}>
          <View style={styles.breakdownInfo}>
            <Text style={styles.breakdownLabel}>Personal Expenses</Text>
            <Text style={styles.breakdownDescription}>
              Your individual spending
            </Text>
          </View>
          <Text style={styles.breakdownAmount}>
            ${budgetSummary.personalTotal.toFixed(2)}
          </Text>
        </View>

        <View style={styles.breakdownDivider} />

        <View style={styles.breakdownItem}>
          <View style={styles.breakdownInfo}>
            <Text style={[styles.breakdownLabel, styles.totalLabel]}>Total Spent</Text>
          </View>
          <Text style={[styles.breakdownAmount, styles.totalAmount]}>
            ${budgetSummary.totalSpent.toFixed(2)}
          </Text>
        </View>
      </Card>
    );
  };

  const renderBudgetSettings = () => {
    return (
      <Card containerStyle={styles.settingsCard}>
        <View style={styles.settingsHeader}>
          <Icon name="settings" type="material" size={20} color="#007AFF" />
          <Text style={styles.settingsTitle}>Budget Settings</Text>
        </View>

        <Input
          label="Budget Limit"
          placeholder="Enter your budget limit"
          value={budgetLimit}
          onChangeText={setBudgetLimit}
          keyboardType="numeric"
          containerStyle={styles.inputContainer}
          leftIcon={<Icon name="attach-money" type="material" size={20} color="#8E8E93" />}
          rightIcon={
            <TouchableOpacity onPress={() => setBudgetLimit('')}>
              <Icon name="clear" type="material" size={20} color="#8E8E93" />
            </TouchableOpacity>
          }
        />

        <View style={styles.budgetTips}>
          <Text style={styles.tipsTitle}>Budget Tips:</Text>
          <Text style={styles.tipText}>• Set a realistic budget based on your trip duration</Text>
          <Text style={styles.tipText}>• Consider both shared and personal expenses</Text>
          <Text style={styles.tipText}>• Leave some buffer for unexpected costs</Text>
          <Text style={styles.tipText}>• You'll get warnings at 80% of your budget</Text>
        </View>

        <Button
          title={saving ? 'Saving...' : 'Save Budget'}
          buttonStyle={styles.saveButton}
          onPress={handleSaveBudget}
          disabled={saving}
          icon={saving ? null : <Icon name="save" type="material" size={16} color="white" />}
        />
      </Card>
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
          <Text style={styles.headerTitle}>Budget Management</Text>
          <TouchableOpacity onPress={fetchBudgetSummary} disabled={loading}>
            <Icon name="refresh" type="material" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading budget information...</Text>
            </View>
          ) : (
            <>
              {renderBudgetOverview()}
              {renderSpendingBreakdown()}
              {renderBudgetSettings()}
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
  overviewCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  overBudgetText: {
    color: '#FF3B30',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  warningAlert: {
    backgroundColor: '#FFF3CD',
  },
  overBudgetWarning: {
    backgroundColor: '#F8D7DA',
  },
  warningText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  warningAlertText: {
    color: '#856404',
  },
  overBudgetWarningText: {
    color: '#721C24',
  },
  breakdownCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  breakdownDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    color: '#000',
  },
  settingsCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  budgetTips: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
  },
});
