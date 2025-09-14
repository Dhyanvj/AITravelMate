import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Card, Icon } from 'react-native-elements';
import expenseService from '../../services/expenseService';
import groupTripService from '../../services/groupTripService';
import { supabase } from '../../services/supabase/supabaseClient';
import BudgetModal from '../expense/BudgetModal';
import DebtModal from '../expense/DebtModal';
import ExpenseForm from '../expense/ExpenseForm';

export default function ExpenseTab({ tripId, userRole }) {
  const [activeTab, setActiveTab] = useState('shared');
  const [expenses, setExpenses] = useState([]);
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [debtSummary, setDebtSummary] = useState(null);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'food',
    description: '',
    isPersonal: false,
    paidBy: '',
    participants: [],
    customSplits: []
  });

  useEffect(() => {
    fetchData();
  }, [tripId]);

  const fetchData = async () => {
    await Promise.all([
      fetchExpenses(),
      fetchMembers(),
      fetchCurrentUser(),
      fetchBudgetSummary(),
      fetchDebtSummary()
    ]);
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const sharedExpenses = await expenseService.getTripExpenses(tripId);
      setExpenses(sharedExpenses || []);
      
      if (currentUser) {
        const personalExpenses = await expenseService.getPersonalExpenses(tripId, currentUser.id);
        setPersonalExpenses(personalExpenses || []);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const membersData = await groupTripService.getTripMembers(tripId);
      setMembers(membersData || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchBudgetSummary = async () => {
    if (!currentUser) return;
    try {
      const summary = await expenseService.getUserBudgetSummary(tripId, currentUser.id);
      setBudgetSummary(summary);
    } catch (error) {
      console.error('Error fetching budget summary:', error);
    }
  };

  const fetchDebtSummary = async () => {
    try {
      const summary = await expenseService.getDebtSummary(tripId);
      setDebtSummary(summary);
    } catch (error) {
      console.error('Error fetching debt summary:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setExpenseForm({
      title: '',
      amount: '',
      category: 'food',
      description: '',
      isPersonal: false,
      paidBy: currentUser?.id || '',
      participants: [],
      customSplits: []
    });
  };

  const handleAddExpense = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditExpense = (expense) => {
    setSelectedExpense(expense);
    setExpenseForm({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description || '',
      isPersonal: expense.is_personal,
      paidBy: expense.paid_by,
      participants: expense.expense_splits?.map(split => split.user_id) || [],
      customSplits: expense.expense_splits?.map(split => ({
        userId: split.user_id,
        amount: parseFloat(split.amount_owed)
      })) || []
    });
    setShowEditModal(true);
  };

  const handleDeleteExpense = (expense) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await expenseService.deleteExpense(expense.id);
              await fetchExpenses();
              Alert.alert('Success', 'Expense deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  const saveExpense = async () => {
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.paidBy) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const expenseData = {
        trip_id: tripId,
        title: expenseForm.title,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        description: expenseForm.description,
        paid_by: expenseForm.paidBy,
        is_personal: expenseForm.isPersonal
      };

      let splits = [];
      if (!expenseForm.isPersonal && expenseForm.participants.length > 0) {
        if (expenseForm.customSplits.length > 0) {
          splits = expenseForm.customSplits;
        } else {
          splits = expenseService.calculateEqualSplits(
            parseFloat(expenseForm.amount),
            expenseForm.participants
          );
        }
      }

      if (selectedExpense) {
        await expenseService.updateExpense(selectedExpense.id, expenseData, splits);
        Alert.alert('Success', 'Expense updated successfully');
        setShowEditModal(false);
      } else {
        await expenseService.createExpense(expenseData, splits);
        Alert.alert('Success', 'Expense added successfully');
        setShowAddModal(false);
      }

      resetForm();
      setSelectedExpense(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const renderExpenseCard = (expense) => {
    const category = expenseService.getCategories().find(cat => cat.id === expense.category);
    const paidByUser = members.find(member => member.user_id === expense.paid_by);
    
    return (
      <Card key={expense.id} containerStyle={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={styles.expenseInfo}>
            <View style={[styles.categoryIcon, { backgroundColor: category?.color || '#DDA0DD' }]}>
              <Icon name={category?.icon || 'more-horiz'} type="material" color="white" size={20} />
            </View>
            <View style={styles.expenseDetails}>
              <Text style={styles.expenseTitle}>{expense.title}</Text>
              <Text style={styles.expenseCategory}>{category?.label}</Text>
              <Text style={styles.expenseDate}>
                {format(new Date(expense.created_at), 'MMM dd, yyyy')}
              </Text>
            </View>
          </View>
          <View style={styles.expenseAmount}>
            <Text style={styles.amountText}>${expense.amount.toFixed(2)}</Text>
            <Text style={styles.paidByText}>
              Paid by {paidByUser?.profiles?.full_name || paidByUser?.profiles?.username}
            </Text>
          </View>
        </View>
        
        {expense.description && (
          <Text style={styles.expenseDescription}>{expense.description}</Text>
        )}

        {!expense.is_personal && expense.expense_splits && (
          <View style={styles.splitsContainer}>
            <Text style={styles.splitsTitle}>Split between:</Text>
            {expense.expense_splits.map((split, index) => {
              const user = members.find(member => member.user_id === split.user_id);
              return (
                <View key={index} style={styles.splitItem}>
                  <Text style={styles.splitUser}>
                    {user?.profiles?.full_name || user?.profiles?.username}
                  </Text>
                  <Text style={styles.splitAmount}>
                    ${parseFloat(split.amount_owed).toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.expenseActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditExpense(expense)}
          >
            <Icon name="edit" type="material" size={16} color="#007AFF" />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteExpense(expense)}
          >
            <Icon name="delete" type="material" size={16} color="#FF3B30" />
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderBudgetSummary = () => {
    if (!budgetSummary) return null;

    return (
      <Card containerStyle={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <Icon name="account-balance-wallet" type="material" size={24} color="#007AFF" />
          <Text style={styles.budgetTitle}>Your Budget</Text>
        </View>
        
        <View style={styles.budgetStats}>
          <View style={styles.budgetStat}>
            <Text style={styles.budgetLabel}>Budget Limit</Text>
            <Text style={styles.budgetValue}>
              ${budgetSummary.budgetLimit.toFixed(2)}
            </Text>
          </View>
          <View style={styles.budgetStat}>
            <Text style={styles.budgetLabel}>Total Spent</Text>
            <Text style={[
              styles.budgetValue,
              budgetSummary.isOverBudget && styles.overBudgetText
            ]}>
              ${budgetSummary.totalSpent.toFixed(2)}
            </Text>
          </View>
          <View style={styles.budgetStat}>
            <Text style={styles.budgetLabel}>Remaining</Text>
            <Text style={[
              styles.budgetValue,
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
            {budgetSummary.percentage.toFixed(1)}% used
          </Text>
        </View>

        {budgetSummary.warningThreshold && (
          <View style={styles.warningContainer}>
            <Icon name="warning" type="material" size={16} color="#FF9500" />
            <Text style={styles.warningText}>
              {budgetSummary.isOverBudget ? 'Over budget!' : 'Approaching budget limit'}
            </Text>
          </View>
        )}

        <Button
          title="Set Budget"
          buttonStyle={styles.budgetButton}
          onPress={() => setShowBudgetModal(true)}
        />
      </Card>
    );
  };

  const renderDebtSummary = () => {
    if (!debtSummary || (debtSummary.debts.length === 0 && debtSummary.credits.length === 0)) {
      return null;
    }

    return (
      <Card containerStyle={styles.debtCard}>
        <View style={styles.debtHeader}>
          <Icon name="account-balance" type="material" size={24} color="#007AFF" />
          <Text style={styles.debtTitle}>Debt Summary</Text>
          <TouchableOpacity onPress={() => setShowDebtModal(true)}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {debtSummary.settlements.length > 0 && (
          <View style={styles.settlementsContainer}>
            <Text style={styles.settlementsTitle}>Suggested Settlements:</Text>
            {debtSummary.settlements.slice(0, 3).map((settlement, index) => (
              <View key={index} style={styles.settlementItem}>
                <Text style={styles.settlementText}>
                  {settlement.fromName} owes {settlement.toName} ${settlement.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expenses</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddExpense}>
          <Icon name="add" type="material" color="white" size={24} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.activeTab]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.activeTabText]}>
            Shared
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
          onPress={() => setActiveTab('personal')}
        >
          <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>
            Personal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>
            Summary
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'shared' && (
          <View>
            {expenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="receipt" type="material" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No shared expenses yet</Text>
                <Text style={styles.emptySubtext}>Add an expense to get started</Text>
              </View>
            ) : (
              expenses.map(expense => renderExpenseCard(expense))
            )}
          </View>
        )}

        {activeTab === 'personal' && (
          <View>
            {personalExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="person" type="material" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No personal expenses yet</Text>
                <Text style={styles.emptySubtext}>Track your personal spending</Text>
              </View>
            ) : (
              personalExpenses.map(expense => renderExpenseCard(expense))
            )}
          </View>
        )}

        {activeTab === 'summary' && (
          <View>
            {renderBudgetSummary()}
            {renderDebtSummary()}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Expense Modal */}
      <Modal
        visible={showAddModal || showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetForm();
            }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedExpense ? 'Edit Expense' : 'Add Expense'}
            </Text>
            <TouchableOpacity onPress={saveExpense} disabled={loading}>
              <Text style={[styles.saveText, loading && styles.disabledText]}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <ExpenseForm
              formData={expenseForm}
              setFormData={setExpenseForm}
              members={members}
              currentUser={currentUser}
              onSave={saveExpense}
              loading={loading}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Debt Management Modal */}
      <DebtModal
        visible={showDebtModal}
        onClose={() => setShowDebtModal(false)}
        tripId={tripId}
        members={members}
      />

      {/* Budget Management Modal */}
      <BudgetModal
        visible={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        tripId={tripId}
        currentUser={currentUser}
        onBudgetUpdated={fetchBudgetSummary}
      />
    </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  expenseCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  paidByText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  expenseDescription: {
    fontSize: 14,
    color: '#000',
    marginBottom: 12,
    lineHeight: 20,
  },
  splitsContainer: {
    marginBottom: 12,
  },
  splitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  splitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  splitUser: {
    fontSize: 14,
    color: '#000',
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  expenseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  actionText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  budgetCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  budgetStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  budgetStat: {
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  budgetValue: {
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
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
  },
  budgetButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  debtCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  debtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  debtTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  settlementsContainer: {
    marginBottom: 16,
  },
  settlementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  settlementItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settlementText: {
    fontSize: 14,
    color: '#000',
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledText: {
    color: '#8E8E93',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 32,
  },
});
